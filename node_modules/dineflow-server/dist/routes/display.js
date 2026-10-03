"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const paymentProvider_1 = require("../services/paymentProvider");
const router = (0, express_1.Router)();
// Display endpoints are strictly accessible by CUSTOMER_DISPLAY (and ADMIN for preview/supervision)
router.use(auth_1.verifyAuth);
router.use((0, auth_1.requireRole)(['CUSTOMER_DISPLAY', 'ADMIN']));
/**
 * GET /api/display/current
 * Fetches the active pending payment for the display.
 * - Isolated strictly by restaurantId.
 * - If linked to a billing cashier (linkedBillingUserId), only returns pending payments for that cashier.
 * - If unlinked, returns the restaurant's latest pending payment.
 * - Automatically expires payments older than 15 minutes.
 */
router.get('/current', async (req, res) => {
    try {
        const { restaurantId, role, userId } = req.user;
        // 1. Fetch restaurant details
        const restaurant = await prisma_1.prisma.restaurant.findUnique({
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
        let linkedBillingUserId = req.user.linkedBillingUserId;
        if (role === 'CUSTOMER_DISPLAY') {
            const staff = await prisma_1.prisma.staffUser.findFirst({
                where: { restaurantId, userId },
                select: { linkedBillingUserId: true },
            });
            if (staff) {
                linkedBillingUserId = staff.linkedBillingUserId;
            }
        }
        // 3. Define expiration cutoff: 15 minutes ago
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        // 4. Query active pending bill
        const whereClause = {
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
        const pendingBill = await prisma_1.prisma.bill.findFirst({
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
        const upiUri = paymentProvider_1.defaultPaymentProvider.generateUpiUri({
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
    }
    catch (error) {
        console.error('Fetch current display payment error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch display payment' });
    }
});
exports.default = router;
