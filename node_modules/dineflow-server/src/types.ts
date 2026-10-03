import { Request } from 'express';

export type UserRole = 'ADMIN' | 'BILLING' | 'WAITER' | 'KITCHEN' | 'CUSTOMER_DISPLAY';

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
