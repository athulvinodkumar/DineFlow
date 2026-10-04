import type { Request } from 'express';

export type UserRole = 'ADMIN' | 'BILLING' | 'WAITER' | 'KITCHEN' | 'CUSTOMER_DISPLAY';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'BILLING';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type OrderType = 'DINE_IN' | 'TAKEAWAY';
export type PaymentStatus = 'PENDING' | 'PAID';
export type PaymentMode = 'UPI' | 'CASH' | 'CARD';
export type PaymentSessionStatus = 'IDLE' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type DiscountType = 'NONE' | 'PERCENT' | 'FLAT';

export interface AuthUser {
  restaurantId: string;
  restaurantCode: string;
  restaurantName: string;
  role: UserRole;
  userId: string;
  name: string;
  email?: string;
  linkedBillingUserId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface PaymentDetails {
  upiId: string;
  restaurantName: string;
  amount: number;
  billNumber: string;
  transactionRef: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  transactionRef: string;
  amount: number;
  paymentMode: 'UPI' | 'CASH' | 'CARD';
  gatewayResponse?: any;
}
