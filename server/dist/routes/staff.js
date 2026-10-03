"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All staff management routes require ADMIN role
router.use(auth_1.verifyAuth);
router.use((0, auth_1.requireRole)(['ADMIN']));
// 1. List staff for the current restaurant
router.get('/', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const staff = await prisma_1.prisma.staffUser.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch staff members' });
    }
});
// 2. Create staff user
const createStaffSchema = zod_1.z.object({
    userId: zod_1.z.string().min(2, 'User ID must be at least 2 characters'),
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    role: zod_1.z.enum(['BILLING', 'WAITER', 'KITCHEN', 'CUSTOMER_DISPLAY']),
    linkedBillingUserId: zod_1.z.string().nullable().optional(),
    password: zod_1.z.string().min(4, 'Password must be at least 4 characters'),
});
router.post('/', async (req, res) => {
    try {
        const parseResult = createStaffSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0].message,
            });
        }
        const restaurantId = req.user.restaurantId;
        const { userId, name, role, linkedBillingUserId, password } = parseResult.data;
        // Check if userId already exists *within this restaurant*
        const existing = await prisma_1.prisma.staffUser.findFirst({
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
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const newStaff = await prisma_1.prisma.staffUser.create({
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
    }
    catch (error) {
        console.error('Create staff error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create staff member' });
    }
});
// 3. Update staff user (name, role, linkedBillingUserId, active status)
const updateStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    role: zod_1.z.enum(['BILLING', 'WAITER', 'KITCHEN', 'CUSTOMER_DISPLAY']).optional(),
    linkedBillingUserId: zod_1.z.string().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
});
router.put('/:id', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const staffId = req.params.id;
        const parseResult = updateStaffSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0].message,
            });
        }
        const existing = await prisma_1.prisma.staffUser.findFirst({
            where: { id: staffId, restaurantId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        const dataToUpdate = { ...parseResult.data };
        if (dataToUpdate.linkedBillingUserId !== undefined) {
            dataToUpdate.linkedBillingUserId = dataToUpdate.linkedBillingUserId ? dataToUpdate.linkedBillingUserId.trim() : null;
        }
        const updated = await prisma_1.prisma.staffUser.update({
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
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update staff member' });
    }
});
// 4. Reset password
const resetPasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(4, 'Password must be at least 4 characters'),
});
router.post('/:id/reset-password', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const staffId = req.params.id;
        const parseResult = resetPasswordSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0].message,
            });
        }
        const existing = await prisma_1.prisma.staffUser.findFirst({
            where: { id: staffId, restaurantId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        const passwordHash = await bcryptjs_1.default.hash(parseResult.data.newPassword, 10);
        await prisma_1.prisma.staffUser.update({
            where: { id: staffId },
            data: { passwordHash },
        });
        return res.json({ success: true, message: `Password reset successfully for ${existing.name}` });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});
// 5. Delete staff member
router.delete('/:id', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const staffId = req.params.id;
        const existing = await prisma_1.prisma.staffUser.findFirst({
            where: { id: staffId, restaurantId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        await prisma_1.prisma.staffUser.delete({
            where: { id: staffId },
        });
        return res.json({ success: true, message: `Staff member ${existing.name} deleted` });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to delete staff member' });
    }
});
exports.default = router;
