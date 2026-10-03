"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting DineFlow seed process...');
    // Clean up existing demo data if exists
    const existingRestaurant = await prisma.restaurant.findUnique({
        where: { code: 'RST-10101' },
    });
    if (existingRestaurant) {
        console.log('Cleaning up existing demo restaurant RST-10101...');
        await prisma.restaurant.delete({ where: { id: existingRestaurant.id } });
    }
    const adminPasswordHash = await bcryptjs_1.default.hash('admin123', 10);
    const staffPasswordHash = await bcryptjs_1.default.hash('password123', 10);
    // 1. Create Demo Restaurant
    const restaurant = await prisma.restaurant.create({
        data: {
            code: 'RST-10101',
            name: 'Spice Route Bistro & Bar',
            ownerName: 'Vikramaditya Sharma',
            email: 'admin@spiceroute.com',
            phone: '+91 98765 43210',
            address: 'Shop 14-16, Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
            gstin: '29ABCDE1234F1Z5',
            upiId: 'spiceroutebistro@okhdfcbank',
            serviceChargePercent: 5.0,
            taxPercent: 5.0, // 2.5% CGST + 2.5% SGST
            billHeader: 'Welcome to Spice Route Bistro & Bar\nFinest Indian & Fusion Delicacies',
            billFooter: 'FSSAI Lic: 11223344556677\nThank you for dining with us! Follow us @SpiceRouteBistro',
        },
    });
    console.log(`✅ Created Restaurant: ${restaurant.name} (Code: ${restaurant.code})`);
    // 2. Create Admin User
    await prisma.adminUser.create({
        data: {
            restaurantId: restaurant.id,
            email: 'admin@spiceroute.com',
            name: 'Vikramaditya Sharma (Owner)',
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
        },
    });
    // 3. Create Staff Users: Billing: Root, Waiter: waiter1, Kitchen: kitchen1
    const billingUser = await prisma.staffUser.create({
        data: {
            restaurantId: restaurant.id,
            userId: 'Root',
            name: 'Rajesh Kumar (Head Cashier)',
            role: 'BILLING',
            passwordHash: staffPasswordHash,
            isActive: true,
        },
    });
    const waiterUser = await prisma.staffUser.create({
        data: {
            restaurantId: restaurant.id,
            userId: 'waiter1',
            name: 'Arjun Verma (Floor Captain)',
            role: 'WAITER',
            passwordHash: staffPasswordHash,
            isActive: true,
        },
    });
    const kitchenUser = await prisma.staffUser.create({
        data: {
            restaurantId: restaurant.id,
            userId: 'kitchen1',
            name: 'Chef Sanjeev (Master Kitchen)',
            role: 'KITCHEN',
            passwordHash: staffPasswordHash,
            isActive: true,
        },
    });
    const displayUser = await prisma.staffUser.create({
        data: {
            restaurantId: restaurant.id,
            userId: 'Display1',
            name: 'Counter 1 QR Display',
            role: 'CUSTOMER_DISPLAY',
            linkedBillingUserId: 'Root',
            passwordHash: staffPasswordHash,
            isActive: true,
        },
    });
    console.log(`✅ Created Staff Users: Billing (${billingUser.userId}), Waiter (${waiterUser.userId}), Kitchen (${kitchenUser.userId}), Customer Display (${displayUser.userId} -> linked to ${displayUser.linkedBillingUserId})`);
    // 4. Create 10 Tables
    const createdTables = [];
    for (let i = 1; i <= 10; i++) {
        const table = await prisma.restaurantTable.create({
            data: {
                restaurantId: restaurant.id,
                tableNumber: `Table ${i}`,
                capacity: i <= 4 ? 2 : i <= 8 ? 4 : 8,
                status: 'FREE',
            },
        });
        createdTables.push(table);
    }
    console.log(`✅ Created 10 restaurant tables (Table 1 to Table 10)`);
    // 5. Create Categories & Menu Items
    const starters = await prisma.category.create({
        data: { restaurantId: restaurant.id, name: 'Starters & Appetizers', sortOrder: 1 },
    });
    const mains = await prisma.category.create({
        data: { restaurantId: restaurant.id, name: 'Main Course Delights', sortOrder: 2 },
    });
    const riceBreads = await prisma.category.create({
        data: { restaurantId: restaurant.id, name: 'Biryani & Fresh Breads', sortOrder: 3 },
    });
    const desserts = await prisma.category.create({
        data: { restaurantId: restaurant.id, name: 'Artisan Desserts', sortOrder: 4 },
    });
    const beverages = await prisma.category.create({
        data: { restaurantId: restaurant.id, name: 'Mocktails & Beverages', sortOrder: 5 },
    });
    // Menu items list
    const menuItemsData = [
        // Starters
        {
            categoryId: starters.id,
            name: 'Tandoori Paneer Tikka',
            description: 'Charcoal-grilled cottage cheese marinated in Kashmiri chillies, mustard oil and hung curd',
            price: 260,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: starters.id,
            name: 'Chicken Malai Tikka',
            description: 'Melt-in-mouth chicken chunks tossed with cardamom, rich cream, and crushed black peppercorns',
            price: 340,
            isVeg: false,
            taxPercent: 5.0,
        },
        {
            categoryId: starters.id,
            name: 'Crispy Corn Chaat',
            description: 'Golden fried American sweet corn tossed with lime, chaat masala, and spring onions',
            price: 190,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: starters.id,
            name: 'Mutton Seekh Kebab',
            description: 'Finely minced spiced lamb skewer roasted over charcoal, served with mint chutney',
            price: 420,
            isVeg: false,
            taxPercent: 5.0,
        },
        // Mains
        {
            categoryId: mains.id,
            name: 'Butter Chicken Masala',
            description: 'Tender tandoori chicken simmered in a silky tomato, cashew and butter gravy with kasuri methi',
            price: 380,
            isVeg: false,
            taxPercent: 5.0,
        },
        {
            categoryId: mains.id,
            name: 'Paneer Butter Masala',
            description: 'Rich cubes of fresh malai paneer bathed in velvety tomato cream sauce',
            price: 310,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: mains.id,
            name: 'Dal Makhani Special',
            description: 'Whole black lentils slow-cooked overnight with churned butter and mild spices',
            price: 270,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: mains.id,
            name: 'Kadhai Prawns Curry',
            description: 'Juicy coastal prawns stir-fried with bell peppers, crushed coriander seeds and spicy kadhai masala',
            price: 490,
            isVeg: false,
            taxPercent: 5.0,
        },
        // Rice & Breads
        {
            categoryId: riceBreads.id,
            name: 'Hyderabadi Dum Chicken Biryani',
            description: 'Fragrant basmati rice layered with spiced marinated chicken, saffron, and caramelized onions',
            price: 370,
            isVeg: false,
            taxPercent: 5.0,
        },
        {
            categoryId: riceBreads.id,
            name: 'Royal Nizami Veg Biryani',
            description: 'Fresh seasonal vegetables cooked with basmati rice, aromatic spices and kewra water',
            price: 290,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: riceBreads.id,
            name: 'Butter Garlic Naan',
            description: 'Crisp and fluffy tandoor leavened bread brushed with melted garlic butter and cilantro',
            price: 75,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: riceBreads.id,
            name: 'Tandoori Roti',
            description: 'Whole wheat bread crisp-baked on the walls of clay tandoor',
            price: 40,
            isVeg: true,
            taxPercent: 5.0,
        },
        // Desserts
        {
            categoryId: desserts.id,
            name: 'Gulab Jamun with Kesari Rabdi',
            description: 'Warm fried milk dumplings served atop rich saffron-infused condensed rabdi',
            price: 150,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: desserts.id,
            name: 'Sizzling Chocolate Brownie',
            description: 'Gooey walnut brownie on a hot sizzling iron platter served with vanilla bean ice cream',
            price: 220,
            isVeg: true,
            taxPercent: 5.0,
        },
        // Beverages
        {
            categoryId: beverages.id,
            name: 'Alphonso Mango Lassi',
            description: 'Thick creamy churned yogurt blended with sweet Ratnagiri Alphonso mango pulp',
            price: 120,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: beverages.id,
            name: 'Fresh Mint Lime Soda',
            description: 'Sparkling soda with squeezed fresh lime juice, crushed mint, and rock salt',
            price: 85,
            isVeg: true,
            taxPercent: 5.0,
        },
        {
            categoryId: beverages.id,
            name: 'Cold Coffee with Ice Cream',
            description: 'Chilled Arabica espresso shake crowned with a scoop of vanilla ice cream and chocolate drizzle',
            price: 160,
            isVeg: true,
            taxPercent: 5.0,
        },
    ];
    const createdMenuItems = [];
    for (const item of menuItemsData) {
        const mi = await prisma.menuItem.create({
            data: {
                restaurantId: restaurant.id,
                ...item,
            },
        });
        createdMenuItems.push(mi);
    }
    console.log(`✅ Created ${createdMenuItems.length} menu items across 5 categories`);
    // 6. Create Historical Completed Bills for Reports & Analytics
    console.log('Generating historical sales data for reports & analytics...');
    for (let d = 6; d >= 1; d--) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - d);
        pastDate.setHours(13, 30, 0, 0);
        const subtotal = 1200 + d * 350;
        const taxAmount = Number(((subtotal * 5) / 100).toFixed(2));
        const serviceChargeAmount = Number(((subtotal * 5) / 100).toFixed(2));
        const grandTotal = Number((subtotal + taxAmount + serviceChargeAmount).toFixed(2));
        await prisma.bill.create({
            data: {
                restaurantId: restaurant.id,
                billNumber: `INV-2026-000${d}`,
                tableName: `Table ${d}`,
                subtotal,
                taxPercent: 5.0,
                taxAmount,
                serviceChargePercent: 5.0,
                serviceChargeAmount,
                discountType: 'NONE',
                discountValue: 0,
                discountAmount: 0,
                grandTotal,
                paymentStatus: 'PAID',
                paymentMode: d % 2 === 0 ? 'UPI' : 'CARD',
                transactionRef: `TXN-PAST-${d}-${Date.now()}`,
                paidAt: pastDate,
                createdAt: pastDate,
            },
        });
    }
    console.log('✨ DineFlow seeding complete!');
    console.log('----------------------------------------------------');
    console.log(`🏪 Restaurant: Spice Route Bistro & Bar`);
    console.log(`🔑 Restaurant ID (Code): RST-10101`);
    console.log(`👤 Admin Login: admin@spiceroute.com / admin123 (or Code RST-10101 + admin / admin123)`);
    console.log(`💰 Billing Login: Code: RST-10101 | User: Root | Pass: password123`);
    console.log(`📱 Waiter Login:  Code: RST-10101 | User: waiter1 | Pass: password123`);
    console.log(`👨‍🍳 Kitchen Login: Code: RST-10101 | User: kitchen1 | Pass: password123`);
    console.log(`🖥️  Display Login: Code: RST-10101 | User: Display1 | Pass: password123 (Linked to Root)`);
    console.log('----------------------------------------------------');
}
main()
    .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
