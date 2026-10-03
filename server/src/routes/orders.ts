import { Router, Response } from 'express';
import { z } from 'zod';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../prisma';
import { verifyAuth, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { emitToRestaurant } from '../sockets';

const router = Router();
router.use(verifyAuth);
router.use(requireRole(['ADMIN', 'BILLING', 'WAITER', 'KITCHEN']));

// Helper to generate order number
const generateOrderNumber = async (restaurantId: string): Promise<string> => {
  const count = await prisma.order.count({ where: { restaurantId } });
  return `ORD-${1000 + count + 1}`;
};

// 1. Get running active orders (sorted oldest first for KDS!)
router.get('/running', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ['PENDING', 'PREPARING', 'READY', 'SERVED'] },
      },
      include: {
        table: true,
        items: {
          include: { menuItem: true },
          orderBy: { createdAt: 'asc' },
        },
        bill: true,
      },
      orderBy: { createdAt: 'asc' }, // Oldest first for KDS!
    });

    return res.json({ success: true, orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch running orders' });
  }
});

// 2. Get all orders (with pagination and status filters)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const { status, tableId, limit = '50' } = req.query;

    const where: any = { restaurantId };
    if (status) where.status = String(status);
    if (tableId) where.tableId = String(tableId);

    const orders = await prisma.order.findMany({
      where,
      include: {
        table: true,
        items: { include: { menuItem: true } },
        bill: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    return res.json({ success: true, orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// 3. Create New Order (Waiter or Cashier)
const createOrderSchema = z.object({
  tableId: z.string().optional(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one item is required to place an order'),
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const waiterId = req.user!.userId;
    const waiterName = req.user!.name;

    const parseResult = createOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { tableId, orderType, notes, items } = parseResult.data;

    // Fetch menu items to get current price and name snapshot
    const itemIds = items.map((i) => i.menuItemId);
    const dbItems = await prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        restaurantId,
      },
    });

    if (dbItems.length !== itemIds.length) {
      return res.status(400).json({ success: false, error: 'One or more selected menu items do not exist' });
    }

    const itemMap = new Map(dbItems.map((item) => [item.id, item]));
    const orderNumber = await generateOrderNumber(restaurantId);

    // Create Order with Items in transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          restaurantId,
          orderNumber,
          tableId: tableId || null,
          waiterId,
          waiterName,
          orderType,
          notes: notes?.trim() || null,
          status: 'PENDING',
        },
      });

      // Insert order items
      for (const item of items) {
        const menuItem = itemMap.get(item.menuItemId)!;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: item.menuItemId,
            name: menuItem.name,
            price: menuItem.price,
            quantity: item.quantity,
            notes: item.notes?.trim() || null,
            status: 'PENDING',
            kotNumber: 1,
          },
        });
      }

      // If DINE_IN and tableId provided, update table status to OCCUPIED
      if (orderType === 'DINE_IN' && tableId) {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: { status: 'OCCUPIED', currentOrderId: order.id },
        });
      }

      return order;
    });

    // Fetch complete order with relations for response & socket broadcast
    const fullOrder = await prisma.order.findUnique({
      where: { id: newOrder.id },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    const io: SocketIOServer = req.app.get('io');
    if (io) {
      emitToRestaurant(io, restaurantId, 'order:created', fullOrder);
      if (tableId) {
        emitToRestaurant(io, restaurantId, 'table:status_changed', {
          tableId,
          status: 'OCCUPIED',
          orderId: newOrder.id,
        });
      }
    }

    return res.status(201).json({ success: true, order: fullOrder });
  } catch (error: any) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, error: 'Failed to place order' });
  }
});

// 4. Add KOT Items to an Existing Running Order (Waiter)
router.post('/:id/items', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one item must be added' });
    }

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Determine next KOT batch number
    const maxKot = order.items.reduce((max: number, i: any) => Math.max(max, i.kotNumber), 1);
    const nextKotNumber = maxKot + 1;

    const itemIds = items.map((i: any) => i.menuItemId);
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurantId },
    });

    const itemMap = new Map(dbItems.map((item) => [item.id, item]));

    const createdItems = [];
    for (const item of items) {
      const menuItem = itemMap.get(item.menuItemId);
      if (menuItem) {
        const orderItem = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            quantity: Number(item.quantity) || 1,
            notes: item.notes?.trim() || null,
            status: 'PENDING',
            kotNumber: nextKotNumber,
          },
          include: { menuItem: true },
        });
        createdItems.push(orderItem);
      }
    }

    // If order was ready/served, reset overall order status back to PREPARING
    if (order.status === 'READY' || order.status === 'SERVED') {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PREPARING' },
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    const io: SocketIOServer = req.app.get('io');
    if (io) {
      emitToRestaurant(io, restaurantId, 'order:kot_added', {
        orderId: order.id,
        order: updatedOrder,
        newItems: createdItems,
        kotNumber: nextKotNumber,
      });
    }

    return res.json({
      success: true,
      message: `KOT #${nextKotNumber} sent to kitchen`,
      order: updatedOrder,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to add items to order' });
  }
});

// 5. Update Order Item Status (e.g. Kitchen sets PREPARING or READY; Waiter sets SERVED)
router.patch('/:id/items/:itemId/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;
    const itemId = req.params.itemId as string;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: { items: true, table: true },
    });

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const orderItem = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId: id },
    });

    if (!orderItem) return res.status(404).json({ success: false, error: 'Order item not found' });

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status },
      include: { menuItem: true },
    });

    // Check if all non-cancelled items are READY or SERVED
    const allItems = await prisma.orderItem.findMany({ where: { orderId: id } });
    const nonCancelled = allItems.filter((i) => i.status !== 'CANCELLED');
    
    let newOrderStatus = order.status;
    if (nonCancelled.length > 0) {
      if (nonCancelled.every((i) => i.status === 'SERVED')) {
        newOrderStatus = 'SERVED';
      } else if (nonCancelled.every((i) => i.status === 'READY' || i.status === 'SERVED')) {
        newOrderStatus = 'READY';
      } else if (nonCancelled.some((i) => i.status === 'PREPARING' || i.status === 'READY')) {
        newOrderStatus = 'PREPARING';
      }
    }

    if (newOrderStatus !== order.status) {
      await prisma.order.update({
        where: { id },
        data: { status: newOrderStatus },
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    const io: SocketIOServer = req.app.get('io');
    if (io) {
      emitToRestaurant(io, restaurantId, 'order:item_status_updated', {
        orderId: id,
        itemId,
        status,
        item: updatedItem,
        order: updatedOrder,
        tableNumber: order.table?.tableNumber || 'Takeaway',
      });
    }

    return res.json({ success: true, item: updatedItem, order: updatedOrder });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update item status' });
  }
});

// 6. Batch update all items in an order (e.g. Kitchen marks whole order Ready or Preparing)
router.patch('/:id/batch-status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: { table: true },
    });

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Update all non-cancelled items
    await prisma.orderItem.updateMany({
      where: { orderId: id, status: { not: 'CANCELLED' } },
      data: { status },
    });

    await prisma.order.update({
      where: { id },
      data: { status },
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    });

    const io: SocketIOServer = req.app.get('io');
    if (io) {
      emitToRestaurant(io, restaurantId, 'order:item_status_updated', {
        orderId: id,
        status,
        order: updatedOrder,
        tableNumber: order.table?.tableNumber || 'Takeaway',
      });
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

export default router;
