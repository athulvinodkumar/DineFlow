import { UserRole, TableStatus, OrderStatus, ItemStatus } from './types';

export const USER_ROLES: Record<UserRole, UserRole> = {
  ADMIN: 'ADMIN',
  BILLING: 'BILLING',
  WAITER: 'WAITER',
  KITCHEN: 'KITCHEN',
  CUSTOMER_DISPLAY: 'CUSTOMER_DISPLAY',
};

export const TABLE_STATUSES: Record<TableStatus, TableStatus> = {
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
  BILLING: 'BILLING',
};

export const ORDER_STATUSES: Record<OrderStatus, OrderStatus> = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const ITEM_STATUSES: Record<ItemStatus, ItemStatus> = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  CANCELLED: 'CANCELLED',
};

export const PAYMENT_EXPIRY_MINUTES = 15;
export const POLLING_FALLBACK_INTERVAL_MS = 3000;
