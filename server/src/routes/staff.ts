import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma';
import { verifyAuth, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All staff management routes require ADMIN role
router.use(verifyAuth);
router.use(requireRole(['ADMIN']));

// 1. List staff for the current restaurant
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const staff = await prisma.staffUser.findMany({
      where: { restaurantId },
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
        linkedBillingUserId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, staff });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch staff members' });
  }
});

// 2. Create staff user
const createStaffSchema = z.object({
  userId: z.string().min(2, 'User ID must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['BILLING', 'WAITER', 'KITCHEN', 'CUSTOMER_DISPLAY']),
  linkedBillingUserId: z.string().nullable().optional(),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = createStaffSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const restaurantId = req.user!.restaurantId;
    const { userId, name, role, linkedBillingUserId, password } = parseResult.data;

    // Check if userId already exists *within this restaurant*
    const existing = await prisma.staffUser.findFirst({
      where: {
        restaurantId,
        userId: { equals: userId.trim() },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `User ID "${userId}" already exists in your restaurant. Please choose a different ID.`,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newStaff = await prisma.staffUser.create({
      data: {
        restaurantId,
        userId: userId.trim(),
        name: name.trim(),
        role,
        linkedBillingUserId: role === 'CUSTOMER_DISPLAY' && linkedBillingUserId ? linkedBillingUserId.trim() : null,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
        linkedBillingUserId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Staff user "${name}" (${role}) created successfully`,
      staff: newStaff,
    });
  } catch (error: any) {
    console.error('Create staff error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create staff member' });
  }
});

// 3. Update staff user (name, role, linkedBillingUserId, active status)
const updateStaffSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['BILLING', 'WAITER', 'KITCHEN', 'CUSTOMER_DISPLAY']).optional(),
  linkedBillingUserId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const staffId = req.params.id as string;

    const parseResult = updateStaffSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const existing = await prisma.staffUser.findFirst({
      where: { id: staffId, restaurantId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const dataToUpdate: any = { ...parseResult.data };
    if (dataToUpdate.linkedBillingUserId !== undefined) {
      dataToUpdate.linkedBillingUserId = dataToUpdate.linkedBillingUserId ? dataToUpdate.linkedBillingUserId.trim() : null;
    }

    const updated = await prisma.staffUser.update({
      where: { id: staffId },
      data: dataToUpdate,
      select: {
        id: true,
        userId: true,
        name: true,
        role: true,
        linkedBillingUserId: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return res.json({ success: true, message: 'Staff member updated successfully', staff: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update staff member' });
  }
});

// 4. Reset password
const resetPasswordSchema = z.object({
  newPassword: z.string().min(4, 'Password must be at least 4 characters'),
});

router.post('/:id/reset-password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const staffId = req.params.id as string;

    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const existing = await prisma.staffUser.findFirst({
      where: { id: staffId, restaurantId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const passwordHash = await bcrypt.hash(parseResult.data.newPassword, 10);
    await prisma.staffUser.update({
      where: { id: staffId },
      data: { passwordHash },
    });

    return res.json({ success: true, message: `Password reset successfully for ${existing.name}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// 5. Delete staff member
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const staffId = req.params.id as string;

    const existing = await prisma.staffUser.findFirst({
      where: { id: staffId, restaurantId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    await prisma.staffUser.delete({
      where: { id: staffId },
    });

    return res.json({ success: true, message: `Staff member ${existing.name} deleted` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete staff member' });
  }
});

export default router;
