"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const paymentProvider_1 = require("../services/paymentProvider");
const sockets_1 = require("../sockets");
const router = (0, express_1.Router)();
router.use(auth_1.verifyAuth);
// Helper to generate unique bill number per restaurant: INV-YYYY-XXXX
const generateBillNumber = async (restaurantId) => {
    const currentYear = new Date().getFullYear();
    let unique = false;
    let billNumber = '';
    let attempt = 0;
    while (!unique && attempt < 20) {
        attempt++;
        const count = await prisma_1.prisma.bill.count({ where: { restaurantId } });
        const padded = String(count + attempt).padStart(4, '0');
        billNumber = `INV-${currentYear}-${padded}`;
        const existing = await prisma_1.prisma.bill.findFirst({ where: { restaurantId, billNumber } });
        if (!existing)
            unique = true;
    }
    if (!unique) {
        billNumber = `INV-${currentYear}-${Date.now().toString().slice(-6)}`;
    }
    return billNumber;
};
// 1. Get active running order & live calculation for a Table
router.get('/table/:tableId', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const tableId = req.params.tableId;
        const table = await prisma_1.prisma.restaurantTable.findFirst({
            where: { id: tableId, restaurantId },
        });
        if (!table)
            return res.status(404).json({ success: false, error: 'Table not found' });
        // Find active order
        const order = await prisma_1.prisma.order.findFirst({
            where: {
                tableId,
                restaurantId,
                status: { in: ['PENDING', 'PREPARING', 'READY', 'SERVED'] },
            },
            include: {
                items: {
                    where: { status: { not: 'CANCELLED' } },
                    include: { menuItem: true },
                },
                bill: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        const restaurant = await prisma_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        if (!order) {
            return res.json({
                success: true,
                table,
                order: null,
                billPreview: null,
            });
        }
        // Calculate subtotal
        const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const taxPercent = restaurant?.taxPercent ?? 5.0;
        const serviceChargePercent = restaurant?.serviceChargePercent ?? 5.0;
        const taxAmount = Number(((subtotal * taxPercent) / 100).toFixed(2));
        const serviceChargeAmount = Number(((subtotal * serviceChargePercent) / 100).toFixed(2));
        const grandTotal = Number((subtotal + taxAmount + serviceChargeAmount).toFixed(2));
        const billPreview = {
            tableName: table.tableNumber,
            orderId: order.id,
            items: order.items,
            subtotal,
            taxPercent,
            taxAmount,
            serviceChargePercent,
            serviceChargeAmount,
            discountType: 'NONE',
            discountValue: 0,
            discountAmount: 0,
            grandTotal,
        };
        return res.json({
            success: true,
            table,
            order,
            billPreview,
            existingBill: order.bill,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch table bill calculation' });
    }
});
// 2. Generate or update official Bill with dynamic discounts, taxes, and UPI QR URI
const generateBillSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1),
    discountType: zod_1.z.enum(['NONE', 'PERCENT', 'FLAT']).default('NONE'),
    discountValue: zod_1.z.number().min(0).default(0),
});
router.post('/generate', (0, auth_1.requireRole)(['BILLING', 'ADMIN']), async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const parseResult = generateBillSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { orderId, discountType, discountValue } = parseResult.data;
        const order = await prisma_1.prisma.order.findFirst({
            where: { id: orderId, restaurantId },
            include: {
                table: true,
                items: { where: { status: { not: 'CANCELLED' } } },
            },
        });
        if (!order)
            return res.status(404).json({ success: false, error: 'Order not found' });
        const restaurant = await prisma_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        if (!restaurant)
            return res.status(404).json({ success: false, error: 'Restaurant not found' });
        const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        // Compute Discount
        let discountAmount = 0;
        if (discountType === 'PERCENT') {
            discountAmount = Number(((subtotal * discountValue) / 100).toFixed(2));
        }
        else if (discountType === 'FLAT') {
            discountAmount = Math.min(discountValue, subtotal);
        }
        const discountedSubtotal = Math.max(0, subtotal - discountAmount);
        const taxPercent = restaurant.taxPercent;
        const serviceChargePercent = restaurant.serviceChargePercent;
        const taxAmount = Number(((discountedSubtotal * taxPercent) / 100).toFixed(2));
        const serviceChargeAmount = Number(((discountedSubtotal * serviceChargePercent) / 100).toFixed(2));
        const grandTotal = Number((discountedSubtotal + taxAmount + serviceChargeAmount).toFixed(2));
        // Check if bill already exists for this order
        let bill = await prisma_1.prisma.bill.findFirst({
            where: { orderId: order.id, restaurantId },
        });
        const billNumber = bill?.billNumber || (await generateBillNumber(restaurantId));
        const transactionRef = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const isExistingPending = bill && bill.paymentSessionStatus === 'PENDING';
        const cashierUserId = req.user.userId;
        const now = new Date();
        if (bill) {
            bill = await prisma_1.prisma.bill.update({
                where: { id: bill.id },
                data: {
                    subtotal,
                    taxPercent,
                    taxAmount,
                    serviceChargePercent,
                    serviceChargeAmount,
                    discountType,
                    discountValue,
                    discountAmount,
                    grandTotal,
                    transactionRef,
                    cashierUserId,
                    paymentSessionStatus: 'PENDING',
                    paymentInitiatedAt: now,
                },
            });
        }
        else {
            bill = await prisma_1.prisma.bill.create({
                data: {
                    restaurantId,
                    billNumber,
                    orderId: order.id,
                    tableName: order.table?.tableNumber || 'Takeaway',
                    subtotal,
                    taxPercent,
                    taxAmount,
                    serviceChargePercent,
                    serviceChargeAmount,
                    discountType,
                    discountValue,
                    discountAmount,
                    grandTotal,
                    paymentStatus: 'PENDING',
                    transactionRef,
                    cashierUserId,
                    paymentSessionStatus: 'PENDING',
                    paymentInitiatedAt: now,
                },
            });
        }
        // Generate UPI deep-link URI
        const upiUri = paymentProvider_1.defaultPaymentProvider.generateUpiUri({
            upiId: restaurant.upiId || 'dineflow@upi',
            restaurantName: restaurant.name,
            amount: grandTotal,
            billNumber: bill.billNumber,
            transactionRef: bill.transactionRef || transactionRef,
        });
        // Emit Socket.IO events for Customer Display
        const io = req.app.get('io');
        if (io) {
            const eventName = isExistingPending ? 'payment:updated' : 'payment:initiated';
            const paymentPayload = {
                billId: bill.id,
                billNumber: bill.billNumber,
                tableName: bill.tableName,
                amount: bill.grandTotal,
                subtotal: bill.subtotal,
                taxAmount: bill.taxAmount,
                serviceChargeAmount: bill.serviceChargeAmount,
                discountAmount: bill.discountAmount,
                discountType: bill.discountType,
                discountValue: bill.discountValue,
                cashierUserId: bill.cashierUserId,
                upiUri,
                items: order.items.map((i) => ({
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                })),
                restaurant: {
                    name: restaurant.name,
                    upiId: restaurant.upiId,
                    showItemizedBillOnDisplay: restaurant.showItemizedBillOnDisplay,
                },
                initiatedAt: bill.paymentInitiatedAt,
            };
            (0, sockets_1.emitToRestaurant)(io, restaurantId, eventName, paymentPayload);
        }
        return res.json({
            success: true,
            bill,
            upiUri,
            restaurant: {
                name: restaurant.name,
                address: restaurant.address,
                phone: restaurant.phone,
                gstin: restaurant.gstin,
                upiId: restaurant.upiId,
                billHeader: restaurant.billHeader,
                billFooter: restaurant.billFooter,
                showItemizedBillOnDisplay: restaurant.showItemizedBillOnDisplay,
            },
        });
    }
    catch (error) {
        console.error('Generate bill error:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate bill' });
    }
});
// 3. Confirm Payment (Cashier one-click button: UPI, Cash, or Card)
const payBillSchema = zod_1.z.object({
    paymentMode: zod_1.z.enum(['UPI', 'CASH', 'CARD']),
    transactionRef: zod_1.z.string().optional(),
});
router.post('/:id/pay', (0, auth_1.requireRole)(['BILLING', 'ADMIN']), async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const id = req.params.id;
        const parseResult = payBillSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { paymentMode, transactionRef } = parseResult.data;
        const bill = await prisma_1.prisma.bill.findFirst({
            where: { id, restaurantId },
            include: { order: true },
        });
        if (!bill)
            return res.status(404).json({ success: false, error: 'Bill not found' });
        if (bill.paymentStatus === 'PAID') {
            return res.status(400).json({ success: false, error: 'This bill has already been settled and marked as Paid.' });
        }
        const effectiveRef = transactionRef || bill.transactionRef || `REF-${Date.now()}`;
        // Execute payment and table clearance in atomic transaction
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Update Bill status
            const updatedBill = await tx.bill.update({
                where: { id },
                data: {
                    paymentStatus: 'PAID',
                    paymentMode,
                    paymentSessionStatus: 'CONFIRMED',
                    transactionRef: effectiveRef,
                    paidAt: new Date(),
                },
            });
            // 2. Create Payment record
            await tx.payment.create({
                data: {
                    restaurantId,
                    billId: bill.id,
                    amount: bill.grandTotal,
                    paymentMode,
                    transactionRef: effectiveRef,
                    status: 'SUCCESS',
                },
            });
            // 3. Mark Order as COMPLETED
            if (bill.orderId) {
                await tx.order.update({
                    where: { id: bill.orderId },
                    data: { status: 'COMPLETED' },
                });
                // 4. Free up the table!
                if (bill.order?.tableId) {
                    await tx.restaurantTable.update({
                        where: { id: bill.order.tableId },
                        data: { status: 'FREE', currentOrderId: null },
                    });
                }
            }
            return updatedBill;
        });
        const io = req.app.get('io');
        if (io) {
            (0, sockets_1.emitToRestaurant)(io, restaurantId, 'bill:paid', {
                billId: bill.id,
                billNumber: bill.billNumber,
                grandTotal: bill.grandTotal,
                paymentMode,
                tableId: bill.order?.tableId,
            });
            (0, sockets_1.emitToRestaurant)(io, restaurantId, 'payment:confirmed', {
                billId: bill.id,
                billNumber: bill.billNumber,
                cashierUserId: bill.cashierUserId,
                amount: bill.grandTotal,
                paymentMode,
            });
            if (bill.order?.tableId) {
                (0, sockets_1.emitToRestaurant)(io, restaurantId, 'table:status_changed', {
                    tableId: bill.order.tableId,
                    status: 'FREE',
                    orderId: null,
                });
            }
        }
        return res.json({
            success: true,
            message: `Bill ${bill.billNumber} successfully settled via ${paymentMode}. Table freed.`,
            bill: result,
        });
    }
    catch (error) {
        console.error('Bill payment settlement error:', error);
        return res.status(500).json({ success: false, error: 'Failed to process payment settlement' });
    }
});
// 4. Cancel Payment Session (Cashier closed QR dialog or canceled payment)
router.post('/:id/cancel-payment', (0, auth_1.requireRole)(['BILLING', 'ADMIN']), async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const id = req.params.id;
        const bill = await prisma_1.prisma.bill.findFirst({
            where: { id, restaurantId },
        });
        if (!bill)
            return res.status(404).json({ success: false, error: 'Bill not found' });
        const updated = await prisma_1.prisma.bill.update({
            where: { id },
            data: {
                paymentSessionStatus: 'CANCELLED',
            },
        });
        const io = req.app.get('io');
        if (io) {
            (0, sockets_1.emitToRestaurant)(io, restaurantId, 'payment:cancelled', {
                billId: bill.id,
                billNumber: bill.billNumber,
                cashierUserId: bill.cashierUserId,
            });
        }
        return res.json({ success: true, message: 'Payment session cancelled successfully', bill: updated });
    }
    catch (error) {
        console.error('Cancel payment error:', error);
        return res.status(500).json({ success: false, error: 'Failed to cancel payment session' });
    }
});
// 4. Waiter Requests Bill for a Table
router.post('/request-bill', (0, auth_1.requireRole)(['WAITER', 'ADMIN']), async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const { tableId } = req.body;
        if (!tableId)
            return res.status(400).json({ success: false, error: 'Table ID required' });
        const table = await prisma_1.prisma.restaurantTable.findFirst({
            where: { id: tableId, restaurantId },
        });
        if (!table)
            return res.status(404).json({ success: false, error: 'Table not found' });
        // Mark table status as BILLING
        const updatedTable = await prisma_1.prisma.restaurantTable.update({
            where: { id: tableId },
            data: { status: 'BILLING' },
        });
        const io = req.app.get('io');
        if (io) {
            (0, sockets_1.emitToRestaurant)(io, restaurantId, 'bill:requested', {
                tableId,
                tableNumber: table.tableNumber,
                waiterName: req.user.name,
            });
            (0, sockets_1.emitToRestaurant)(io, restaurantId, 'table:status_changed', {
                tableId,
                status: 'BILLING',
                orderId: table.currentOrderId,
            });
        }
        return res.json({
            success: true,
            message: `Bill requested for ${table.tableNumber}. Cashier notified.`,
            table: updatedTable,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to request bill' });
    }
});
// 5. Get Bills History with search and date filters
router.get('/', (0, auth_1.requireRole)(['BILLING', 'ADMIN']), async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const { startDate, endDate, status, search, limit = '100' } = req.query;
        const where = { restaurantId };
        if (status)
            where.paymentStatus = String(status);
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(String(startDate));
            if (endDate) {
                const end = new Date(String(endDate));
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }
        if (search) {
            where.OR = [
                { billNumber: { contains: String(search) } },
                { tableName: { contains: String(search) } },
            ];
        }
        const bills = await prisma_1.prisma.bill.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            include: {
                order: {
                    include: { items: true },
                },
            },
        });
        return res.json({ success: true, bills });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch bill history' });
    }
});
// 6. Get Single Bill detail for printable invoice
router.get('/:id', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const id = req.params.id;
        const bill = await prisma_1.prisma.bill.findFirst({
            where: { id, restaurantId },
            include: {
                order: {
                    include: { items: true },
                },
            },
        });
        if (!bill)
            return res.status(404).json({ success: false, error: 'Bill not found' });
        const restaurant = await prisma_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
        });
        return res.json({
            success: true,
            bill,
            restaurant,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to retrieve invoice details' });
    }
});
exports.default = router;
