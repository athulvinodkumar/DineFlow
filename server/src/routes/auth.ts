import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../prisma';
import { verifyAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dineflow-super-secret-jwt-key-2026-production';

// Rate limiting on login routes to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
});

// Helper to generate a unique short Restaurant ID: RST-XXXXX
const generateRestaurantCode = async (): Promise<string> => {
  let unique = false;
  let code = '';
  while (!unique) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    code = `RST-${randomDigits}`;
    const existing = await prisma.restaurant.findUnique({ where: { code } });
    if (!existing) unique = true;
  }
  return code;
};

// 1. Account Creation (Restaurant Owner Registration)
const registerSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(5, 'Address is required'),
  gstin: z.string().optional(),
  upiId: z.string().min(3, 'Valid UPI ID required (e.g. name@bank)'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

router.post('/register-restaurant', async (req: Request, res: Response) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const { restaurantName, ownerName, email, phone, address, gstin, upiId, adminPassword } = parseResult.data;

    const existingEmail = await prisma.restaurant.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'A restaurant with this email address already exists.',
      });
    }

    const code = await generateRestaurantCode();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create Restaurant and AdminUser in transaction
    const newRestaurant = await prisma.$transaction(async (tx) => {
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

    const token = jwt.sign(
      {
        restaurantId: newRestaurant.id,
        restaurantCode: newRestaurant.code,
        restaurantName: newRestaurant.name,
        role: 'ADMIN',
        userId: 'admin',
        name: ownerName,
        email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
  } catch (error: any) {
    console.error('Restaurant registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create restaurant account. Please try again.',
    });
  }
});

// 2. Staff Login (Restaurant ID + User ID + Password)
const staffLoginSchema = z.object({
  restaurantCode: z.string().min(1, 'Restaurant ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/staff-login', authLimiter, async (req: Request, res: Response) => {
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
    const restaurant = await prisma.restaurant.findFirst({
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
      const admin = await prisma.adminUser.findFirst({
        where: { restaurantId: restaurant.id },
      });

      if (admin) {
        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (isMatch) {
          const token = jwt.sign(
            {
              restaurantId: restaurant.id,
              restaurantCode: restaurant.code,
              restaurantName: restaurant.name,
              role: 'ADMIN',
              userId: 'admin',
              name: admin.name,
              email: admin.email,
            },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

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
    const staffUser = await prisma.staffUser.findFirst({
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

    const isMatch = await bcrypt.compare(password, staffUser.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid User ID or Password.',
      });
    }

    const token = jwt.sign(
      {
        restaurantId: restaurant.id,
        restaurantCode: restaurant.code,
        restaurantName: restaurant.name,
        role: staffUser.role,
        userId: staffUser.userId,
        name: staffUser.name,
        linkedBillingUserId: staffUser.linkedBillingUserId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Auto-determine redirect URL based on role
    let redirectUrl = '/billing';
    if (staffUser.role === 'WAITER') redirectUrl = '/waiter';
    if (staffUser.role === 'KITCHEN') redirectUrl = '/kitchen';
    if (staffUser.role === 'CUSTOMER_DISPLAY') redirectUrl = '/display';

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
  } catch (error: any) {
    console.error('Staff login error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during login. Please try again.',
    });
  }
});

// 3. Admin Login (Email + Password)
const adminLoginSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/admin-login', authLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = adminLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0].message,
      });
    }

    const { email, password } = parseResult.data;

    const admin = await prisma.adminUser.findUnique({
      where: { email },
      include: { restaurant: true },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      {
        restaurantId: admin.restaurant.id,
        restaurantCode: admin.restaurant.code,
        restaurantName: admin.restaurant.name,
        role: 'ADMIN',
        userId: 'admin',
        name: admin.name,
        email: admin.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
  } catch (error: any) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
});

// 4. Current User Session Details
router.get('/me', verifyAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { restaurantId, role, userId } = req.user!;
    const restaurant = await prisma.restaurant.findUnique({
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

    let userDetails = { ...req.user! };
    if (role !== 'ADMIN') {
      const staff = await prisma.staffUser.findFirst({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
  }
});

export default router;
