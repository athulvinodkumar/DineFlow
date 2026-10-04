import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { verifyAuth, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../../lib/types';

const router = Router();

// Menu view is open to all logged in staff; modifications require ADMIN
router.use(verifyAuth);

// 1. Get Categories
router.get('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const categories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { menuItems: true } },
      },
    });

    return res.json({ success: true, categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// 2. Create Category (Admin only)
router.post('/categories', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const { name, sortOrder } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const category = await prisma.category.create({
      data: {
        restaurantId,
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
      },
    });

    return res.status(201).json({ success: true, category });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// 3. Update Category (Admin only)
router.put('/categories/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;
    const { name, sortOrder } = req.body;

    const existing = await prisma.category.findFirst({ where: { id, restaurantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      },
    });

    return res.json({ success: true, category });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// 4. Delete Category (Admin only)
router.delete('/categories/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;

    const existing = await prisma.category.findFirst({ where: { id, restaurantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    await prisma.category.delete({ where: { id } });
    return res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// 5. Get Menu Items
router.get('/items', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const { categoryId, isVeg, isAvailable } = req.query;

    const whereClause: any = { restaurantId };
    if (categoryId) whereClause.categoryId = String(categoryId);
    if (isVeg !== undefined) whereClause.isVeg = isVeg === 'true';
    if (isAvailable !== undefined) whereClause.isAvailable = isAvailable === 'true';

    const items = await prisma.menuItem.findMany({
      where: whereClause,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, items });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch menu items' });
  }
});

// 6. Create Menu Item (Admin only)
const createItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  isVeg: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  taxPercent: z.number().min(0).default(5.0),
  imageUrl: z.string().optional(),
});

router.post('/items', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const parseResult = createItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { name, categoryId, description, price, isVeg, isAvailable, taxPercent, imageUrl } = parseResult.data;

    // Verify category belongs to this restaurant
    const category = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
    });
    if (!category) {
      return res.status(400).json({ success: false, error: 'Selected category does not exist in this restaurant' });
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId,
        name: name.trim(),
        description: description?.trim() || null,
        price,
        isVeg,
        isAvailable,
        taxPercent,
        imageUrl: imageUrl?.trim() || null,
      },
      include: { category: true },
    });

    return res.status(201).json({ success: true, item });
  } catch (error: any) {
    console.error('Create menu item error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create menu item' });
  }
});

// 7. Update Menu Item (Admin only, or toggle availability by Waiter/Kitchen if allowed)
router.put('/items/:id', requireRole(['ADMIN', 'BILLING', 'KITCHEN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;

    const existing = await prisma.menuItem.findFirst({ where: { id, restaurantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Menu item not found' });

    // Non-admins can only toggle availability
    if (req.user!.role !== 'ADMIN') {
      if (req.body.isAvailable !== undefined) {
        const item = await prisma.menuItem.update({
          where: { id },
          data: { isAvailable: Boolean(req.body.isAvailable) },
          include: { category: true },
        });
        return res.json({ success: true, item });
      }
      return res.status(403).json({ success: false, error: 'Only admins can modify menu pricing and details' });
    }

    const { name, categoryId, description, price, isVeg, isAvailable, taxPercent, imageUrl } = req.body;

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        categoryId: categoryId !== undefined ? categoryId : undefined,
        description: description !== undefined ? description.trim() : undefined,
        price: price !== undefined ? Number(price) : undefined,
        isVeg: isVeg !== undefined ? Boolean(isVeg) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
        taxPercent: taxPercent !== undefined ? Number(taxPercent) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
      },
      include: { category: true },
    });

    return res.json({ success: true, item });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update menu item' });
  }
});

// 8. Delete Menu Item (Admin only)
router.delete('/items/:id', requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const id = req.params.id as string;

    const existing = await prisma.menuItem.findFirst({ where: { id, restaurantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Menu item not found' });

    await prisma.menuItem.delete({ where: { id } });
    return res.json({ success: true, message: 'Menu item deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete menu item' });
  }
});

export default router;
