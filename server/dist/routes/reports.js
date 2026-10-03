"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.verifyAuth);
router.use((0, auth_1.requireRole)(['ADMIN']));
// 1. Dashboard summary metrics & charts
router.get('/dashboard', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        // Start of today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        // 1. Today's settled bills
        const todayBills = await prisma_1.prisma.bill.findMany({
            where: {
                restaurantId,
                paymentStatus: 'PAID',
                createdAt: { gte: startOfToday },
            },
        });
        const todaySales = todayBills.reduce((sum, b) => sum + b.grandTotal, 0);
        const todayOrderCount = await prisma_1.prisma.order.count({
            where: {
                restaurantId,
                createdAt: { gte: startOfToday },
            },
        });
        // 2. Active tables (OCCUPIED or BILLING)
        const activeTablesCount = await prisma_1.prisma.restaurantTable.count({
            where: {
                restaurantId,
                status: { in: ['OCCUPIED', 'BILLING'] },
            },
        });
        const totalTablesCount = await prisma_1.prisma.restaurantTable.count({
            where: { restaurantId },
        });
        // 3. Top selling items (overall or last 30 days)
        const topItemsRaw = await prisma_1.prisma.orderItem.groupBy({
            by: ['name'],
            where: {
                order: { restaurantId, status: { not: 'CANCELLED' } },
            },
            _sum: {
                quantity: true,
            },
            orderBy: {
                _sum: {
                    quantity: 'desc',
                },
            },
            take: 5,
        });
        const topSellingItems = topItemsRaw.map((item) => ({
            name: item.name,
            totalQuantity: item._sum.quantity || 0,
        }));
        // 4. Sales chart (last 7 days breakdown)
        const last7DaysSales = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            const dayBills = await prisma_1.prisma.bill.findMany({
                where: {
                    restaurantId,
                    paymentStatus: 'PAID',
                    createdAt: { gte: dayStart, lte: dayEnd },
                },
            });
            const dayOrdersCount = await prisma_1.prisma.order.count({
                where: {
                    restaurantId,
                    createdAt: { gte: dayStart, lte: dayEnd },
                },
            });
            const daySales = dayBills.reduce((sum, b) => sum + b.grandTotal, 0);
            last7DaysSales.push({
                date: dayStart.toISOString().split('T')[0],
                day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                sales: Number(daySales.toFixed(2)),
                orders: dayOrdersCount,
            });
        }
        return res.json({
            success: true,
            metrics: {
                todaySales: Number(todaySales.toFixed(2)),
                todayOrders: todayOrderCount,
                activeTables: activeTablesCount,
                totalTables: totalTablesCount,
                averageOrderValue: todayOrderCount > 0 ? Number((todaySales / todayOrderCount).toFixed(2)) : 0,
            },
            topSellingItems,
            salesChart: last7DaysSales,
        });
    }
    catch (error) {
        console.error('Dashboard metrics error:', error);
        return res.status(500).json({ success: false, error: 'Failed to compute dashboard metrics' });
    }
});
// 2. Export Bills / Orders to CSV
router.get('/export-csv', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const { startDate, endDate } = req.query;
        const where = { restaurantId };
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
        const bills = await prisma_1.prisma.bill.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        // Generate CSV string
        const headers = ['Bill Number', 'Table', 'Subtotal (INR)', 'Tax Amount', 'Service Charge', 'Discount', 'Grand Total (INR)', 'Payment Status', 'Payment Mode', 'Date & Time'];
        const rows = bills.map((b) => [
            b.billNumber,
            `"${b.tableName || 'Takeaway'}"`,
            b.subtotal.toFixed(2),
            b.taxAmount.toFixed(2),
            b.serviceChargeAmount.toFixed(2),
            b.discountAmount.toFixed(2),
            b.grandTotal.toFixed(2),
            b.paymentStatus,
            b.paymentMode || 'N/A',
            `"${b.createdAt.toISOString()}"`,
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="dineflow-bills-${Date.now()}.csv"`);
        return res.send(csvContent);
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to generate CSV export' });
    }
});
exports.default = router;
