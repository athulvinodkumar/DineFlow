import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { verifyAuth, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../../lib/types';
import { defaultPaymentProvider } from '../../lib/upi';

const router = Router();

// Display endpoints are strictly accessible by CUSTOMER_DISPLAY (and ADMIN for preview/supervision)
router.use(verifyAuth);
router.use(requireRole(['CUSTOMER_DISPLAY', 'ADMIN']));

const PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

/**
 * GET /api/display/current
 * Fetches the active pending payment for the display.
 * - Isolated strictly by restaurantId.
 * - If linked to a billing cashier (linkedBillingUserId), only returns pending payments for that cashier.
 * - If unlinked, returns the restaurant's latest pending payment.
 * - Automatically expires payments older than 15 minutes lazily upon read.
 */
router.get('/current', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { restaurantId, role, userId } = req.user!;

    // 1. Fetch restaurant details
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        upiId: true,
        showItemizedBillOnDisplay: true,
      },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    // 2. Determine linkedBillingUserId for this display
    let linkedBillingUserId = req.user!.linkedBillingUserId;
    if (role === 'CUSTOMER_DISPLAY') {
      const staff = await prisma.staffUser.findFirst({
        where: { restaurantId, userId },
        select: { linkedBillingUserId: true },
      });
      if (staff) {
        linkedBillingUserId = staff.linkedBillingUserId;
      }
    }

    // 3. Define expiration cutoff: 15 minutes ago
    const fifteenMinutesAgo = new Date(Date.now() - PAYMENT_EXPIRY_MS);

    // Lazily cancel any expired pending payments for this restaurant
    try {
      await prisma.bill.updateMany({
        where: {
          restaurantId,
          paymentStatus: 'PENDING',
          paymentSessionStatus: 'PENDING',
          paymentInitiatedAt: { lt: fifteenMinutesAgo },
        },
        data: {
          paymentSessionStatus: 'CANCELLED',
        },
      });
    } catch (lazyErr) {
      // Non-blocking
    }

    // 4. Query active pending bill
    const whereClause: any = {
      restaurantId,
      paymentStatus: 'PENDING',
      paymentSessionStatus: 'PENDING',
      paymentInitiatedAt: {
        gte: fifteenMinutesAgo,
      },
    };

    if (linkedBillingUserId) {
      whereClause.cashierUserId = linkedBillingUserId;
    }

    const pendingBill = await prisma.bill.findFirst({
      where: whereClause,
      orderBy: { paymentInitiatedAt: 'desc' },
      include: {
        order: {
          include: {
            items: {
              where: { status: { not: 'CANCELLED' } },
            },
          },
        },
      },
    });

    if (!pendingBill) {
      return res.json({
        success: true,
        pendingPayment: null,
        restaurant: {
          name: restaurant.name,
          upiId: restaurant.upiId,
          showItemizedBillOnDisplay: restaurant.showItemizedBillOnDisplay,
        },
      });
    }

    // 5. Generate UPI QR URI
    const upiUri = defaultPaymentProvider.generateUpiUri({
      upiId: restaurant.upiId || 'dineflow@upi',
      restaurantName: restaurant.name,
      amount: pendingBill.grandTotal,
      billNumber: pendingBill.billNumber,
      transactionRef: pendingBill.transactionRef || `TXN-${Date.now()}`,
    });

    const items = pendingBill.order?.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    })) || [];

    return res.json({
      success: true,
      pendingPayment: {
        billId: pendingBill.id,
        billNumber: pendingBill.billNumber,
        tableName: pendingBill.tableName,
        amount: pendingBill.grandTotal,
        subtotal: pendingBill.subtotal,
        taxAmount: pendingBill.taxAmount,
        serviceChargeAmount: pendingBill.serviceChargeAmount,
        discountAmount: pendingBill.discountAmount,
        discountType: pendingBill.discountType,
        discountValue: pendingBill.discountValue,
        cashierUserId: pendingBill.cashierUserId,
        upiUri,
        items,
        initiatedAt: pendingBill.paymentInitiatedAt,
      },
      restaurant: {
        name: restaurant.name,
        upiId: restaurant.upiId,
        showItemizedBillOnDisplay: restaurant.showItemizedBillOnDisplay,
      },
    });
  } catch (error: any) {
    console.error('Fetch current display payment error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch display payment' });
  }
});

export default router;
