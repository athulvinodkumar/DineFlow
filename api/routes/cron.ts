import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { emitToRestaurant } from '../../lib/realtime/server';

const router = Router();
const PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

/**
 * GET/POST /api/cron/cleanup-payments
 * Triggered automatically by Vercel Crons every few minutes (or manually with CRON_SECRET).
 * Cleans up abandoned or expired payment sessions across all restaurants.
 */
const handlePaymentCleanup = async (req: Request, res: Response) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const isVercelCron = Boolean(req.headers['x-vercel-cron']);

    // Verify secret if configured
    if (cronSecret && !isVercelCron) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid CRON_SECRET' });
      }
    }

    const cutoff = new Date(Date.now() - PAYMENT_EXPIRY_MS);

    // Find all expired pending bills
    const expiredBills = await prisma.bill.findMany({
      where: {
        paymentStatus: 'PENDING',
        paymentSessionStatus: 'PENDING',
        paymentInitiatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        restaurantId: true,
        billNumber: true,
        cashierUserId: true,
      },
    });

    if (expiredBills.length === 0) {
      return res.json({
        success: true,
        message: 'No expired payment sessions to clean up',
        expiredCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Mark as CANCELLED in database
    const expiredIds = expiredBills.map((b) => b.id);
    await prisma.bill.updateMany({
      where: { id: { in: expiredIds } },
      data: { paymentSessionStatus: 'CANCELLED' },
    });

    // Notify displays and billing stations via realtime
    for (const bill of expiredBills) {
      await emitToRestaurant(bill.restaurantId, 'payment:cancelled', {
        billId: bill.id,
        billNumber: bill.billNumber,
        cashierUserId: bill.cashierUserId,
        reason: 'EXPIRED_SESSION_TIMEOUT',
      });
    }

    console.log(`🧹 Cron cleanup: Expired ${expiredBills.length} stale payment session(s)`);

    return res.json({
      success: true,
      message: `Cleaned up ${expiredBills.length} expired payment session(s)`,
      expiredCount: expiredBills.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron payment cleanup error:', error);
    return res.status(500).json({ success: false, error: 'Payment cleanup failed' });
  }
};

router.get('/cleanup-payments', handlePaymentCleanup);
router.post('/cleanup-payments', handlePaymentCleanup);

export default router;
