"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const BASE_URL = 'http://localhost:5000';
async function runDisplayE2ETests() {
    console.log('================================================================');
    console.log('🧪 RUNNING DINEFLOW CUSTOMER DISPLAY ACCEPTANCE TEST SUITE');
    console.log('================================================================\n');
    let passed = 0;
    let failed = 0;
    const assert = (condition, testName, details) => {
        if (condition) {
            console.log(`✅ [PASS] ${testName}`);
            passed++;
        }
        else {
            console.error(`❌ [FAIL] ${testName}${details ? ` - ${details}` : ''}`);
            failed++;
        }
    };
    try {
        // -------------------------------------------------------------
        // SETUP: Create Restaurant A and Base Staff
        // -------------------------------------------------------------
        console.log('--- Setup: Creating Restaurant A (Tandoor Garden) ---');
        const restEmailA = `tandoor-${Date.now()}@restaurant.com`;
        const regResA = await fetch(`${BASE_URL}/api/auth/register-restaurant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantName: 'Tandoor Garden Bistro',
                ownerName: 'Sunil Mehta',
                email: restEmailA,
                phone: '9876543210',
                address: 'MG Road, Indiranagar, Bengaluru',
                gstin: '29ABCDE1234F1Z5',
                upiId: 'tandoorgarden@okaxis',
                adminPassword: 'password123',
            }),
        });
        const regDataA = await regResA.json();
        assert(regResA.status === 201 && regDataA.success, 'Restaurant A created');
        const restACode = regDataA.restaurant.code;
        const restAId = regDataA.restaurant.id;
        const adminAToken = regDataA.token;
        // Create Billing user "Root" in Restaurant A
        const staffRootRes = await fetch(`${BASE_URL}/api/staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminAToken}`,
            },
            body: JSON.stringify({
                userId: 'Root',
                name: 'Rajesh Cashier',
                role: 'BILLING',
                password: 'password123',
            }),
        });
        const staffRootData = await staffRootRes.json();
        assert(staffRootRes.status === 201 && staffRootData.staff?.userId === 'Root', 'Created Billing staff user "Root"');
        // Create Waiter user "waiter1" in Restaurant A
        const staffWaiterRes = await fetch(`${BASE_URL}/api/staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminAToken}`,
            },
            body: JSON.stringify({
                userId: 'waiter1',
                name: 'Amit Waiter',
                role: 'WAITER',
                password: 'password123',
            }),
        });
        const staffWaiterData = await staffWaiterRes.json();
        assert(staffWaiterRes.status === 201 && staffWaiterData.staff?.userId === 'waiter1', 'Created Waiter staff user "waiter1"');
        // Login as Root
        const rootLoginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantCode: restACode,
                userId: 'Root',
                password: 'password123',
            }),
        });
        const rootLoginData = await rootLoginRes.json();
        const rootToken = rootLoginData.token;
        // Login as Waiter
        const waiterLoginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantCode: restACode,
                userId: 'waiter1',
                password: 'password123',
            }),
        });
        const waiterLoginData = await waiterLoginRes.json();
        const waiterToken = waiterLoginData.token;
        // Fetch tables & menu
        const tablesRes = await fetch(`${BASE_URL}/api/tables`, {
            headers: { Authorization: `Bearer ${rootToken}` },
        });
        const tablesData = await tablesRes.json();
        const table3 = tablesData.tables.find((t) => t.tableNumber === 'Table 3') || tablesData.tables[2];
        const table2 = tablesData.tables.find((t) => t.tableNumber === 'Table 2') || tablesData.tables[1];
        const menuRes = await fetch(`${BASE_URL}/api/menu/items`, {
            headers: { Authorization: `Bearer ${rootToken}` },
        });
        const menuData = await menuRes.json();
        const item1 = menuData.items[0];
        // =============================================================
        // Acceptance Test 1: Admin creates Customer Display user "Display1" linked to "Root"
        // =============================================================
        console.log('\n--- Acceptance Test 1: Admin creates Customer Display user "Display1" linked to "Root" ---');
        const displayCreateRes = await fetch(`${BASE_URL}/api/staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminAToken}`,
            },
            body: JSON.stringify({
                userId: 'Display1',
                name: 'Counter 1 Display Screen',
                role: 'CUSTOMER_DISPLAY',
                linkedBillingUserId: 'Root',
                password: 'password123',
            }),
        });
        const displayCreateData = await displayCreateRes.json();
        assert(displayCreateRes.status === 201 && displayCreateData.success, 'Admin successfully created Customer Display staff user');
        assert(displayCreateData.staff?.role === 'CUSTOMER_DISPLAY', 'Role is CUSTOMER_DISPLAY');
        assert(displayCreateData.staff?.linkedBillingUserId === 'Root', 'Display is linked to billing user "Root"');
        // =============================================================
        // Acceptance Test 2: Log in as Display1 -> IDLE state with no QR
        // =============================================================
        console.log('\n--- Acceptance Test 2: Log in as Display1 -> Redirected to /display, IDLE state with no QR ---');
        const displayLoginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantCode: restACode,
                userId: 'Display1',
                password: 'password123',
            }),
        });
        const displayLoginData = await displayLoginRes.json();
        assert(displayLoginRes.status === 200 && displayLoginData.success, 'Login succeeded for Display1');
        assert(displayLoginData.role === 'CUSTOMER_DISPLAY', 'Display user role verified as CUSTOMER_DISPLAY');
        assert(displayLoginData.redirectUrl === '/display', 'Display user automatically redirected to /display');
        const displayToken = displayLoginData.token;
        // Fetch initial display state via GET /api/display/current
        const displayInitRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        const displayInitData = await displayInitRes.json();
        assert(displayInitRes.status === 200 && displayInitData.success, 'GET /api/display/current succeeded');
        assert(displayInitData.pendingPayment === null, 'Display starts in IDLE state with no pending payment and no QR code');
        assert(displayInitData.restaurant?.name === 'Tandoor Garden Bistro', 'Display received restaurant branding');
        // Setup Socket.IO listener for Display1
        const socketDisplay1 = (0, socket_io_client_1.default)(BASE_URL);
        await new Promise((resolve) => {
            socketDisplay1.on('connect', () => {
                socketDisplay1.emit('join:restaurant', {
                    restaurantId: restAId,
                    role: 'CUSTOMER_DISPLAY',
                    userId: 'Display1',
                });
                resolve();
            });
        });
        let lastInitiatedEvent = null;
        let lastUpdatedEvent = null;
        let lastConfirmedEvent = null;
        let lastCancelledEvent = null;
        socketDisplay1.on('payment:initiated', (data) => {
            lastInitiatedEvent = data;
        });
        socketDisplay1.on('payment:updated', (data) => {
            lastUpdatedEvent = data;
        });
        socketDisplay1.on('payment:confirmed', (data) => {
            lastConfirmedEvent = data;
        });
        socketDisplay1.on('payment:cancelled', (data) => {
            lastCancelledEvent = data;
        });
        // Place order for Table 3
        const order3Res = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${waiterToken}`,
            },
            body: JSON.stringify({
                tableId: table3.id,
                orderType: 'DINE_IN',
                items: [{ menuItemId: item1.id, quantity: 2, notes: 'Special' }],
            }),
        });
        const order3Data = await order3Res.json();
        const order3Id = order3Data.order.id;
        // =============================================================
        // Acceptance Test 3: In Billing as Root, click Pay via UPI -> Display shows QR within ~1s
        // =============================================================
        console.log('\n--- Acceptance Test 3: Root clicks Pay via UPI -> Display receives live payment:initiated within 1s ---');
        const startUpiTime = Date.now();
        lastInitiatedEvent = null;
        const genBillRes = await fetch(`${BASE_URL}/api/bills/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
            body: JSON.stringify({
                orderId: order3Id,
                discountType: 'NONE',
                discountValue: 0,
            }),
        });
        const genBillData = await genBillRes.json();
        assert(genBillRes.status === 200 && genBillData.success, 'Root initiated bill generation and UPI payment');
        // Wait up to 1 second for socket event to arrive
        for (let i = 0; i < 10; i++) {
            if (lastInitiatedEvent)
                break;
            await new Promise((r) => setTimeout(r, 100));
        }
        const elapsedMs = Date.now() - startUpiTime;
        assert(!!lastInitiatedEvent, `Display received live "payment:initiated" event (${elapsedMs}ms <= 1000ms)`);
        assert(lastInitiatedEvent?.cashierUserId === 'Root', 'Event indicates initiator cashierUserId is "Root"');
        assert(Number(lastInitiatedEvent?.amount).toFixed(2) === Number(genBillData.bill.grandTotal).toFixed(2), `QR amount matches exact bill grand total (₹${lastInitiatedEvent?.amount})`);
        assert(typeof lastInitiatedEvent?.upiUri === 'string' && lastInitiatedEvent.upiUri.startsWith('upi://pay?'), 'Valid NPCI UPI QR string formatted and sent to display');
        assert(lastInitiatedEvent.upiUri.includes(`am=${Number(genBillData.bill.grandTotal).toFixed(2)}`), 'UPI deep-link includes exact amount to 2 decimal places');
        const bill3Id = genBillData.bill.id;
        // =============================================================
        // Acceptance Test 4: Apply discount in Billing -> Display QR & amount update live
        // =============================================================
        console.log('\n--- Acceptance Test 4: Apply discount in Billing -> Display updates live via payment:updated ---');
        lastUpdatedEvent = null;
        const discountRes = await fetch(`${BASE_URL}/api/bills/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
            body: JSON.stringify({
                orderId: order3Id,
                discountType: 'PERCENT',
                discountValue: 15,
            }),
        });
        const discountData = await discountRes.json();
        for (let i = 0; i < 10; i++) {
            if (lastUpdatedEvent)
                break;
            await new Promise((r) => setTimeout(r, 100));
        }
        assert(!!lastUpdatedEvent, 'Display received live "payment:updated" Socket.IO event without a page refresh');
        assert(lastUpdatedEvent?.discountValue === 15, 'Discount percentage updated to 15%');
        assert(Number(lastUpdatedEvent?.amount).toFixed(2) === Number(discountData.bill.grandTotal).toFixed(2), `Display updated amount reflects discount: ₹${lastUpdatedEvent?.amount} vs previous ₹${lastInitiatedEvent?.amount}`);
        assert(lastUpdatedEvent.upiUri.includes(`am=${Number(discountData.bill.grandTotal).toFixed(2)}`), 'New QR code reflects discounted amount');
        // =============================================================
        // Acceptance Test 5: Confirm payment -> Display shows success, then returns to IDLE
        // =============================================================
        console.log('\n--- Acceptance Test 5: Confirm payment -> Display receives payment:confirmed and returns to IDLE ---');
        lastConfirmedEvent = null;
        const payRes = await fetch(`${BASE_URL}/api/bills/${bill3Id}/pay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
            body: JSON.stringify({ paymentMode: 'UPI', transactionRef: 'UPI-TXN-ACCEPTANCE-5' }),
        });
        const payData = await payRes.json();
        assert(payRes.status === 200 && payData.bill?.paymentStatus === 'PAID', 'Cashier confirmed payment received');
        for (let i = 0; i < 10; i++) {
            if (lastConfirmedEvent)
                break;
            await new Promise((r) => setTimeout(r, 100));
        }
        assert(!!lastConfirmedEvent, 'Display received "payment:confirmed" event to trigger success screen');
        assert(lastConfirmedEvent?.billId === bill3Id, 'Confirmed event matches bill ID');
        // Query GET /api/display/current to verify display state is cleared of pending payments
        const displayAfterPayRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        const displayAfterPayData = await displayAfterPayRes.json();
        assert(displayAfterPayData.pendingPayment === null, 'Display current pending payment is null (returns to IDLE with no QR)');
        // =============================================================
        // Acceptance Test 6: Start a payment, then cancel it -> Display goes back to IDLE
        // =============================================================
        console.log('\n--- Acceptance Test 6: Start payment then cancel -> Display returns to IDLE ---');
        // Place order for Table 2
        const order2Res = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${waiterToken}`,
            },
            body: JSON.stringify({
                tableId: table2.id,
                orderType: 'DINE_IN',
                items: [{ menuItemId: item1.id, quantity: 1 }],
            }),
        });
        const order2Data = await order2Res.json();
        // Start payment
        lastInitiatedEvent = null;
        const startPay2Res = await fetch(`${BASE_URL}/api/bills/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
            body: JSON.stringify({
                orderId: order2Data.order.id,
                discountType: 'NONE',
                discountValue: 0,
            }),
        });
        const startPay2Data = await startPay2Res.json();
        const bill2Id = startPay2Data.bill.id;
        for (let i = 0; i < 10; i++) {
            if (lastInitiatedEvent)
                break;
            await new Promise((r) => setTimeout(r, 100));
        }
        assert(!!lastInitiatedEvent, 'Payment initiated for Table 2');
        // Cashier cancels payment session
        lastCancelledEvent = null;
        const cancelRes = await fetch(`${BASE_URL}/api/bills/${bill2Id}/cancel-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
        });
        const cancelData = await cancelRes.json();
        assert(cancelRes.status === 200 && cancelData.success, 'Cashier canceled payment session');
        for (let i = 0; i < 10; i++) {
            if (lastCancelledEvent)
                break;
            await new Promise((r) => setTimeout(r, 100));
        }
        assert(!!lastCancelledEvent, 'Display received "payment:cancelled" event');
        const displayAfterCancelRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        const displayAfterCancelData = await displayAfterCancelRes.json();
        assert(displayAfterCancelData.pendingPayment === null, 'Display returns immediately to IDLE state with QR removed');
        // =============================================================
        // Acceptance Test 7: Start payment, refresh display page -> QR still shown correctly
        // =============================================================
        console.log('\n--- Acceptance Test 7: Start payment and refresh display -> QR still shown correctly ---');
        const restartPay2Res = await fetch(`${BASE_URL}/api/bills/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
            body: JSON.stringify({
                orderId: order2Data.order.id,
                discountType: 'NONE',
                discountValue: 0,
            }),
        });
        const restartPay2Data = await restartPay2Res.json();
        // Simulate display page refresh: fetching GET /api/display/current
        const displayRefreshRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        const displayRefreshData = await displayRefreshRes.json();
        assert(displayRefreshRes.status === 200 && !!displayRefreshData.pendingPayment, 'GET /api/display/current returns active pending payment on page reload');
        assert(displayRefreshData.pendingPayment?.billNumber === restartPay2Data.bill.billNumber, `Bill number matches: ${displayRefreshData.pendingPayment?.billNumber}`);
        assert(Number(displayRefreshData.pendingPayment?.amount).toFixed(2) === Number(restartPay2Data.bill.grandTotal).toFixed(2), 'Exact amount restored on refresh');
        assert(typeof displayRefreshData.pendingPayment?.upiUri === 'string' && displayRefreshData.pendingPayment.upiUri.includes('upi://pay?'), 'UPI QR URI restored properly on refresh without stale data');
        // =============================================================
        // Acceptance Test 8: A different billing user (not linked) starts payment -> Display1 does NOT show it
        // =============================================================
        console.log('\n--- Acceptance Test 8: Unlinked cashier starts payment -> Display1 does NOT show it ---');
        // Create second billing cashier "Cashier2"
        const cashier2Res = await fetch(`${BASE_URL}/api/staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminAToken}`,
            },
            body: JSON.stringify({
                userId: 'Cashier2',
                name: 'Pooja Cashier (Counter 2)',
                role: 'BILLING',
                password: 'password123',
            }),
        });
        const cashier2Data = await cashier2Res.json();
        assert(cashier2Res.status === 201, 'Created second cashier "Cashier2"');
        // Login as Cashier2
        const cashier2LoginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantCode: restACode,
                userId: 'Cashier2',
                password: 'password123',
            }),
        });
        const cashier2LoginData = await cashier2LoginRes.json();
        const cashier2Token = cashier2LoginData.token;
        // Clear Table 2 pending bill from Root first
        await fetch(`${BASE_URL}/api/bills/${bill2Id}/cancel-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${rootToken}`,
            },
        });
        // Cashier2 initiates a payment on Table 2
        const cashier2BillRes = await fetch(`${BASE_URL}/api/bills/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${cashier2Token}`,
            },
            body: JSON.stringify({
                orderId: order2Data.order.id,
                discountType: 'NONE',
                discountValue: 0,
            }),
        });
        const cashier2BillData = await cashier2BillRes.json();
        assert(cashier2BillRes.status === 200 && cashier2BillData.success, 'Cashier2 generated bill');
        // Now query Display1 (which is linked exclusively to "Root")
        const display1CheckRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        const display1CheckData = await display1CheckRes.json();
        assert(display1CheckData.pendingPayment === null, 'Display1 (paired with "Root") correctly ignores payment initiated by "Cashier2"');
        // =============================================================
        // Acceptance Test 9: Strict RBAC: Customer Display cannot access other routes; Waiter cannot access /display
        // =============================================================
        console.log('\n--- Acceptance Test 9: Role Restrictions & Route Guards ---');
        // Display1 attempts to access Admin Reports -> 403 Forbidden
        const dAdminRes = await fetch(`${BASE_URL}/api/reports/dashboard`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        assert(dAdminRes.status === 403, 'Customer Display rejected from Admin routes with 403 Forbidden');
        // Display1 attempts to access Kitchen orders -> 403 Forbidden
        const dKitchenRes = await fetch(`${BASE_URL}/api/orders/running`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        assert(dKitchenRes.status === 403, 'Customer Display rejected from Kitchen routes with 403 Forbidden');
        // Display1 attempts to settle a bill -> 403 Forbidden
        const dPayRes = await fetch(`${BASE_URL}/api/bills/${bill2Id}/pay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${displayToken}`,
            },
            body: JSON.stringify({ paymentMode: 'CASH' }),
        });
        assert(dPayRes.status === 403, 'Customer Display rejected from Billing settlement with 403 Forbidden');
        // Display1 attempts to place an order -> 403 Forbidden
        const dOrderRes = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${displayToken}`,
            },
            body: JSON.stringify({
                tableId: table2.id,
                orderType: 'DINE_IN',
                items: [{ menuItemId: item1.id, quantity: 1 }],
            }),
        });
        assert(dOrderRes.status === 403, 'Customer Display rejected from placing Orders with 403 Forbidden');
        // Waiter attempts to access Display endpoint -> 403 Forbidden
        const waiterDisplayRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${waiterToken}` },
        });
        assert(waiterDisplayRes.status === 403, 'Waiter rejected from Customer Display endpoints with 403 Forbidden');
        // Billing cashier attempts to access Display endpoint -> 403 Forbidden
        const cashierDisplayRes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${rootToken}` },
        });
        assert(cashierDisplayRes.status === 403, 'Billing cashier rejected from Customer Display endpoints with 403 Forbidden');
        // =============================================================
        // Acceptance Test 10: Multi-Tenant Isolation: Restaurant B never leaks payments to Restaurant A display
        // =============================================================
        console.log('\n--- Acceptance Test 10: Multi-Tenant Isolation between Restaurant A & B ---');
        // Create Restaurant B
        const restEmailB = `coastal-${Date.now()}@restaurant.com`;
        const regResB = await fetch(`${BASE_URL}/api/auth/register-restaurant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantName: 'Coastal Catch Seafood',
                ownerName: 'Deepak Nair',
                email: restEmailB,
                phone: '9876543299',
                address: 'Beach Road, Mangalore',
                gstin: '29ZZZDE1234F1Z8',
                upiId: 'coastalcatch@okicici',
                adminPassword: 'password123',
            }),
        });
        const regDataB = await regResB.json();
        const adminBToken = regDataB.token;
        // Create Root in Restaurant B
        const staffBRes = await fetch(`${BASE_URL}/api/staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminBToken}`,
            },
            body: JSON.stringify({
                userId: 'Root',
                name: 'Rohan Cashier (Rest B)',
                role: 'BILLING',
                password: 'password123',
            }),
        });
        const staffBData = await staffBRes.json();
        // Login as Restaurant B Root
        const loginBRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantCode: regDataB.restaurant.code,
                userId: 'Root',
                password: 'password123',
            }),
        });
        const loginBData = await loginBRes.json();
        const tokenB = loginBData.token;
        // Fetch Restaurant B tables & items
        const tablesBRes = await fetch(`${BASE_URL}/api/tables`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        const tablesBData = await tablesBRes.json();
        const tableB1 = tablesBData.tables[0];
        const menuBRes = await fetch(`${BASE_URL}/api/menu/items`, {
            headers: { Authorization: `Bearer ${tokenB}` },
        });
        const menuBData = await menuBRes.json();
        const itemB1 = menuBData.items[0];
        // Restaurant B places order & starts payment
        const orderBRes = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenB}`,
            },
            body: JSON.stringify({
                tableId: tableB1.id,
                orderType: 'DINE_IN',
                items: [{ menuItemId: itemB1.id, quantity: 3 }],
            }),
        });
        const orderBData = await orderBRes.json();
        lastInitiatedEvent = null; // Reset Restaurant A Display1 listener
        const genBillBRes = await fetch(`${BASE_URL}/api/bills/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenB}`,
            },
            body: JSON.stringify({
                orderId: orderBData.order.id,
                discountType: 'NONE',
                discountValue: 0,
            }),
        });
        const genBillBData = await genBillBRes.json();
        assert(genBillBRes.status === 200, 'Restaurant B initiated UPI payment for its order');
        // Verify Restaurant A Display1 received ZERO events
        await new Promise((r) => setTimeout(r, 400));
        assert(lastInitiatedEvent === null, 'Socket room isolation: Restaurant A Display1 did NOT receive payment broadcast from Restaurant B');
        // Verify REST API check on Restaurant A Display1
        const checkDisplayARes = await fetch(`${BASE_URL}/api/display/current`, {
            headers: { Authorization: `Bearer ${displayToken}` },
        });
        const checkDisplayAData = await checkDisplayARes.json();
        assert(checkDisplayAData.pendingPayment === null, 'Data isolation: Restaurant A Display1 never sees pending payment from Restaurant B');
        socketDisplay1.disconnect();
        console.log('\n================================================================');
        console.log(`📊 CUSTOMER DISPLAY ACCEPTANCE SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('================================================================\n');
        if (failed > 0) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error('Fatal display test error:', error);
        process.exit(1);
    }
}
runDisplayE2ETests();
