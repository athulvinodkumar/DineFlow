"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.verifyAuth);
// 1. Get restaurant settings
router.get('/', async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const restaurant = await prisma_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
            include: {
                adminUsers: {
                    select: { id: true, email: true, name: true },
                },
            },
        });
        if (!restaurant)
            return res.status(404).json({ success: false, error: 'Restaurant not found' });
        return res.json({ success: true, restaurant });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});
// 2. Update restaurant settings (Admin only)
router.put('/', (0, auth_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId;
        const { name, ownerName, phone, address, gstin, upiId, serviceChargePercent, taxPercent, billHeader, billFooter, showItemizedBillOnDisplay, } = req.body;
        const updated = await prisma_1.prisma.restaurant.update({
            where: { id: restaurantId },
            data: {
                name: name !== undefined ? name.trim() : undefined,
                ownerName: ownerName !== undefined ? ownerName.trim() : undefined,
                phone: phone !== undefined ? phone.trim() : undefined,
                address: address !== undefined ? address.trim() : undefined,
                gstin: gstin !== undefined ? (gstin ? gstin.trim() : null) : undefined,
                upiId: upiId !== undefined ? (upiId ? upiId.trim() : null) : undefined,
                serviceChargePercent: serviceChargePercent !== undefined ? Number(serviceChargePercent) : undefined,
                taxPercent: taxPercent !== undefined ? Number(taxPercent) : undefined,
                billHeader: billHeader !== undefined ? billHeader : undefined,
                billFooter: billFooter !== undefined ? billFooter : undefined,
                showItemizedBillOnDisplay: showItemizedBillOnDisplay !== undefined ? Boolean(showItemizedBillOnDisplay) : undefined,
            },
        });
        return res.json({ success: true, message: 'Settings updated successfully', restaurant: updated });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});
exports.default = router;
