"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'dineflow-super-secret-jwt-key-2026-production';
// Rate limiting on login routes to prevent brute-force
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
});
// Helper to generate a unique short Restaurant ID: RST-XXXXX
const generateRestaurantCode = async () => {
    let unique = false;
    let code = '';
    while (!unique) {
        const randomDigits = Math.floor(10000 + Math.random() * 90000);
        code = `RST-${randomDigits}`;
        const existing = await prisma_1.prisma.restaurant.findUnique({ where: { code } });
        if (!existing)
            unique = true;
    }
    return code;
};
// 1. Account Creation (Restaurant Owner Registration)
const registerSchema = zod_1.z.object({
    restaurantName: zod_1.z.string().min(2, 'Restaurant name must be at least 2 characters'),
    ownerName: zod_1.z.string().min(2, 'Owner name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits'),
    address: zod_1.z.string().min(5, 'Address is required'),
    gstin: zod_1.z.string().optional(),
    upiId: zod_1.z.string().min(3, 'Valid UPI ID required (e.g. name@bank)'),
    adminPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
router.post('/register-restaurant', async (req, res) => {
    try {
        const parseResult = registerSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0].message,
            });
        }
        const { restaurantName, ownerName, email, phone, address, gstin, upiId, adminPassword } = parseResult.data;
        const existingEmail = await prisma_1.prisma.restaurant.findUnique({ where: { email } });
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                error: 'A restaurant with this email address already exists.',
            });
        }
        const code = await generateRestaurantCode();
        const passwordHash = await bcryptjs_1.default.hash(adminPassword, 10);
        // Create Restaurant and AdminUser in transaction
        const newRestaurant = await prisma_1.prisma.$transaction(async (tx) => {
            const restaurant = await tx.restaurant.create({
                data: {
                    code,
                    name: restaurantName,
                    ownerName,
                    email,
                    phone,
                    address,
                    gstin: gstin || null,
                    upiId: upiId || `${restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`,
                    billHeader: `Welcome to ${restaurantName}!`,
                    billFooter: 'Thank you for dining with us! Please visit again.',
                },
            });
            await tx.adminUser.create({
                data: {
                    restaurantId: restaurant.id,
                    email,
                    name: ownerName,
                    passwordHash,
                    role: 'ADMIN',
                },
            });
            // Seed starter categories & default tables for convenience
            const starters = await tx.category.create({
                data: { restaurantId: restaurant.id, name: 'Starters', sortOrder: 1 },
            });
            const mains = await tx.category.create({
                data: { restaurantId: restaurant.id, name: 'Main Course', sortOrder: 2 },
            });
            const beverages = await tx.category.create({
                data: { restaurantId: restaurant.id, name: 'Beverages', sortOrder: 3 },
            });
            await tx.menuItem.createMany({
                data: [
                    {
                        restaurantId: restaurant.id,
                        categoryId: starters.id,
                        name: 'Crispy Paneer Tikka',
                        description: 'Tandoor-roasted cottage cheese cubes marinated in spiced yogurt',
                        price: 240,
                        isVeg: true,
                        taxPercent: 5.0,
                    },
                    {
                        restaurantId: restaurant.id,
                        categoryId: mains.id,
                        name: 'Dal Makhani Special',
                        description: 'Slow-cooked black lentils simmered with butter and fresh cream',
                        price: 290,
                        isVeg: true,
                        taxPercent: 5.0,
                    },
                    {
                        restaurantId: restaurant.id,
                        categoryId: mains.id,
                        name: 'Butter Chicken Masala',
                        description: 'Succulent chicken in creamy tomato butter gravy',
                        price: 360,
                        isVeg: false,
                        taxPercent: 5.0,
                    },
                    {
                        restaurantId: restaurant.id,
                        categoryId: beverages.id,
                        name: 'Fresh Mint Lime Soda',
                        description: 'Refreshing sweet and salty soda with fresh mint leaves',
                        price: 90,
                        isVeg: true,
                        taxPercent: 5.0,
                    },
                ],
            });
            // Create 6 default tables
            for (let i = 1; i <= 6; i++) {
                await tx.restaurantTable.create({
                    data: {
                        restaurantId: restaurant.id,
                        tableNumber: `Table ${i}`,
                        capacity: i % 2 === 0 ? 4 : 2,
                        status: 'FREE',
                    },
                });
            }
            return restaurant;
        });
        const token = jsonwebtoken_1.default.sign({
            restaurantId: newRestaurant.id,
            restaurantCode: newRestaurant.code,
            restaurantName: newRestaurant.name,
            role: 'ADMIN',
            userId: 'admin',
            name: ownerName,
            email,
        }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(201).json({
            success: true,
            message: 'Restaurant account created successfully!',
            restaurant: {
                id: newRestaurant.id,
                code: newRestaurant.code,
                name: newRestaurant.name,
                ownerName: newRestaurant.ownerName,
                email: newRestaurant.email,
                upiId: newRestaurant.upiId,
            },
            token,
            role: 'ADMIN',
        });
    }
    catch (error) {
        console.error('Restaurant registration error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create restaurant account. Please try again.',
        });
    }
});
// 2. Staff Login (Restaurant ID + User ID + Password)
const staffLoginSchema = zod_1.z.object({
    restaurantCode: zod_1.z.string().min(1, 'Restaurant ID is required'),
    userId: zod_1.z.string().min(1, 'User ID is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
router.post('/staff-login', authLimiter, async (req, res) => {
    try {
        const parseResult = staffLoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0].message,
            });
        }
        const { restaurantCode, userId, password } = parseResult.data;
        // Find restaurant by code (case-insensitive)
        const restaurant = await prisma_1.prisma.restaurant.findFirst({
            where: {
                code: { equals: restaurantCode.trim() },
            },
        });
        if (!restaurant) {
            return res.status(401).json({
                success: false,
                error: 'Invalid Restaurant ID. Please check the code provided by your admin.',
            });
        }
        // Check if logging in as Admin using Restaurant ID + 'admin'
        if (userId.trim().toLowerCase() === 'admin') {
            const admin = await prisma_1.prisma.adminUser.findFirst({
                where: { restaurantId: restaurant.id },
            });
            if (admin) {
                const isMatch = await bcryptjs_1.default.compare(password, admin.passwordHash);
                if (isMatch) {
                    const token = jsonwebtoken_1.default.sign({
                        restaurantId: restaurant.id,
                        restaurantCode: restaurant.code,
                        restaurantName: restaurant.name,
                        role: 'ADMIN',
                        userId: 'admin',
                        name: admin.name,
                        email: admin.email,
                    }, JWT_SECRET, { expiresIn: '7d' });
                    return res.json({
                        success: true,
                        role: 'ADMIN',
                        redirectUrl: '/admin',
                        token,
                        restaurant: {
                            id: restaurant.id,
                            code: restaurant.code,
                            name: restaurant.name,
                            upiId: restaurant.upiId,
                        },
                        user: {
                            userId: 'admin',
                            name: admin.name,
                            role: 'ADMIN',
                        },
                    });
                }
            }
        }
        // Find staff user within this restaurant
        const staffUser = await prisma_1.prisma.staffUser.findFirst({
            where: {
                restaurantId: restaurant.id,
                userId: { equals: userId.trim() },
            },
        });
        if (!staffUser) {
            return res.status(401).json({
                success: false,
                error: 'Invalid User ID or Password for this restaurant.',
            });
        }
        if (!staffUser.isActive) {
            return res.status(403).json({
                success: false,
                error: 'This account has been deactivated. Please contact your restaurant manager.',
            });
        }
        const isMatch = await bcryptjs_1.default.compare(password, staffUser.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid User ID or Password.',
            });
        }
        const token = jsonwebtoken_1.default.sign({
            restaurantId: restaurant.id,
            restaurantCode: restaurant.code,
            restaurantName: restaurant.name,
            role: staffUser.role,
            userId: staffUser.userId,
            name: staffUser.name,
            linkedBillingUserId: staffUser.linkedBillingUserId,
        }, JWT_SECRET, { expiresIn: '7d' });
        // Auto-determine redirect URL based on role
        let redirectUrl = '/billing';
        if (staffUser.role === 'WAITER')
            redirectUrl = '/waiter';
        if (staffUser.role === 'KITCHEN')
            redirectUrl = '/kitchen';
        if (staffUser.role === 'CUSTOMER_DISPLAY')
            redirectUrl = '/display';
        return res.json({
            success: true,
            role: staffUser.role,
            redirectUrl,
            token,
            restaurant: {
                id: restaurant.id,
                code: restaurant.code,
                name: restaurant.name,
                upiId: restaurant.upiId,
            },
            user: {
                userId: staffUser.userId,
                name: staffUser.name,
                role: staffUser.role,
                linkedBillingUserId: staffUser.linkedBillingUserId,
            },
        });
    }
    catch (error) {
        console.error('Staff login error:', error);
        return res.status(500).json({
            success: false,
            error: 'An unexpected error occurred during login. Please try again.',
        });
    }
});
// 3. Admin Login (Email + Password)
const adminLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
router.post('/admin-login', authLimiter, async (req, res) => {
    try {
        const parseResult = adminLoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                success: false,
                error: parseResult.error.errors[0].message,
            });
        }
        const { email, password } = parseResult.data;
        const admin = await prisma_1.prisma.adminUser.findUnique({
            where: { email },
            include: { restaurant: true },
        });
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.',
            });
        }
        const isMatch = await bcryptjs_1.default.compare(password, admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.',
            });
        }
        const token = jsonwebtoken_1.default.sign({
            restaurantId: admin.restaurant.id,
            restaurantCode: admin.restaurant.code,
            restaurantName: admin.restaurant.name,
            role: 'ADMIN',
            userId: 'admin',
            name: admin.name,
            email: admin.email,
        }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            success: true,
            role: 'ADMIN',
            redirectUrl: '/admin',
            token,
            restaurant: {
                id: admin.restaurant.id,
                code: admin.restaurant.code,
                name: admin.restaurant.name,
                upiId: admin.restaurant.upiId,
            },
            user: {
                userId: 'admin',
                name: admin.name,
                role: 'ADMIN',
                email: admin.email,
            },
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.',
        });
    }
});
// 4. Current User Session Details
router.get('/me', auth_1.verifyAuth, async (req, res) => {
    try {
        const { restaurantId, role, userId } = req.user;
        const restaurant = await prisma_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: {
                id: true,
                code: true,
                name: true,
                ownerName: true,
                email: true,
                phone: true,
                address: true,
                gstin: true,
                upiId: true,
                serviceChargePercent: true,
                taxPercent: true,
                billHeader: true,
                billFooter: true,
                showItemizedBillOnDisplay: true,
            },
        });
        if (!restaurant) {
            return res.status(404).json({ success: false, error: 'Restaurant not found' });
        }
        let userDetails = { ...req.user };
        if (role !== 'ADMIN') {
            const staff = await prisma_1.prisma.staffUser.findFirst({
                where: { restaurantId, userId },
                select: { linkedBillingUserId: true },
            });
            if (staff) {
                userDetails.linkedBillingUserId = staff.linkedBillingUserId;
            }
        }
        return res.json({
            success: true,
            user: userDetails,
            restaurant,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
    }
});
exports.default = router;
