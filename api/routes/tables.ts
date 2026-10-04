import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { verifyAuth, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../../lib/types';

const router = Router();
router.use(verifyAuth);
router.use(requireRole(['ADMIN', 'BILLING', 'WAITER', 'KITCHEN']));

// 1. Get all tables with live active order status
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
      include: {
        orders: {
          where: {
            status: { in: ['PENDING', 'PREPARING', 'READY', 'SERVED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            items: true,
            bill: true,
          },
        },
      },
    });

    // Format output with currentOrder
    const formattedTables = tables.map((t) => {
      const activeOrder = t.orders.length > 0 ? t.orders[0] : null;
      return {
        id: t.id,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        status: t.status,
        currentOrderId: activeOrder?.id || null,
        currentOrder: activeOrder,
      };
    });

    return res.json({ success: true, tables: formattedTables });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch tables' });
  }
});

// 2. Create Table (Admin only)
router.post('/', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const { tableNumber, capacity } = req.body;

    if (!tableNumber || !tableNumber.trim()) {
      return res.status(400).json({ success: false, error: 'Table number/name is required' });
    }

    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId,
        tableNumber: tableNumber.trim(),
        capacity: Number(capacity) || 4,
        status: 'FREE',
      },
    });

    return res.status(201).json({ success: true, table });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to create table' });
  }
});

// 3. Update Table
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;
    const { tableNumber, capacity, status } = req.body;

    const existing = await prisma.restaurantTable.findFirst({ where: { id, restaurantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Table not found' });

    const table = await prisma.restaurantTable.update({
      where: { id },
      data: {
        tableNumber: tableNumber ? tableNumber.trim() : undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    return res.json({ success: true, table });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update table' });
  }
});

// 4. Delete Table (Admin only)
router.delete('/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;

    const existing = await prisma.restaurantTable.findFirst({ where: { id, restaurantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Table not found' });

    await prisma.restaurantTable.delete({ where: { id } });
    return res.json({ success: true, message: 'Table removed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete table' });
  }
});

export default router;
