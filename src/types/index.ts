export type UserRole = 'ADMIN' | 'BILLING' | 'WAITER' | 'KITCHEN' | 'CUSTOMER_DISPLAY';

export interface User {
  id?: string;
  userId: string;
  name: string;
  role: UserRole;
  email?: string;
  linkedBillingUserId?: string | null;
}

export interface Restaurant {
  id: string;
  code: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  gstin?: string | null;
  upiId?: string | null;
  serviceChargePercent: number;
  taxPercent: number;
  billHeader?: string | null;
  billFooter?: string | null;
  showItemizedBillOnDisplay?: boolean;
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  _count?: { menuItems: number };
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  category?: Category;
  name: string;
  description?: string | null;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  taxPercent: number;
  imageUrl?: string | null;
}

export interface TableItem {
  id: string;
  tableNumber: string;
  capacity: number;
  status: 'FREE' | 'OCCUPIED' | 'BILLING';
  currentOrderId: string | null;
  currentOrder?: Order | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem?: MenuItem;
  name: string;
  price: number;
  quantity: number;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  notes?: string | null;
  kotNumber: number;
  createdAt: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  orderNumber: string;
  tableId?: string | null;
  table?: { tableNumber: string; capacity: number } | null;
  waiterId?: string | null;
  waiterName?: string | null;
  orderType: 'DINE_IN' | 'TAKEAWAY';
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  items: OrderItem[];
  bill?: Bill | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  restaurantId: string;
  billNumber: string;
  orderId?: string | null;
  tableName?: string | null;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  serviceChargePercent: number;
  serviceChargeAmount: number;
  discountType: 'NONE' | 'PERCENT' | 'FLAT';
  discountValue: number;
  discountAmount: number;
  grandTotal: number;
  paymentStatus: 'PENDING' | 'PAID';
  paymentMode?: 'UPI' | 'CASH' | 'CARD' | null;
  paymentSessionStatus?: 'IDLE' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  cashierUserId?: string | null;
  paymentInitiatedAt?: string | null;
  transactionRef?: string | null;
  paidAt?: string | null;
  createdAt: string;
  order?: Order | null;
}

export interface StaffMember {
  id: string;
  userId: string;
  name: string;
  role: UserRole;
  linkedBillingUserId?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DashboardMetrics {
  todaySales: number;
  todayOrders: number;
  activeTables: number;
  totalTables: number;
  averageOrderValue: number;
}

export interface SalesChartDay {
  date: string;
  day: string;
  sales: number;
  orders: number;
}
