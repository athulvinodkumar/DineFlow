import { z } from 'zod';

export const registerRestaurantSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  gstin: z.string().optional().nullable(),
  upiId: z.string().optional().nullable(),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const staffLoginSchema = z.object({
  restaurantCode: z.string().min(1, 'Restaurant ID / Code is required'),
  userId: z.string().min(1, 'Staff User ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createStaffSchema = z.object({
  userId: z.string().min(2, 'Staff User ID must be at least 2 characters'),
  name: z.string().min(2, 'Staff Name must be at least 2 characters'),
  role: z.enum(['BILLING', 'WAITER', 'KITCHEN', 'CUSTOMER_DISPLAY']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  linkedBillingUserId: z.string().optional().nullable(),
});

export const createMenuItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().optional().nullable(),
  price: z.number().min(0, 'Price must be non-negative'),
  isVeg: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  taxPercent: z.number().min(0).default(5.0),
  imageUrl: z.string().optional().nullable(),
});

export const createOrderSchema = z.object({
  tableId: z.string().optional().nullable(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  notes: z.string().optional().nullable(),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive(),
      notes: z.string().optional().nullable(),
    })
  ).min(1, 'Order must contain at least 1 item'),
});

export const generateBillSchema = z.object({
  orderId: z.string(),
  discountType: z.enum(['NONE', 'PERCENT', 'FLAT']).default('NONE'),
  discountValue: z.number().min(0).default(0),
});

export const payBillSchema = z.object({
  paymentMode: z.enum(['UPI', 'CASH', 'CARD']),
  transactionRef: z.string().optional(),
});
