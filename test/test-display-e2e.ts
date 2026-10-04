const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

function createRealtimeSubscriber(baseUrl: string, restaurantId: string, token: string) {
  const handlers: Record<string, ((data: any) => void)[]> = {};
  let polling = true;
  let lastTimestamp = 0;

  const interval = setInterval(async () => {
    if (!polling) return;
    try {
      const res = await fetch(`${baseUrl}/api/realtime/poll?since=${lastTimestamp}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.events && Array.isArray(data.events)) {
          lastTimestamp = data.timestamp || Date.now();
          for (const ev of data.events) {
            const fns = handlers[ev.event] || [];
            fns.forEach((fn) => fn(ev.data));
          }
        }
      }
    } catch {}
  }, 100);

  return {
    on: (event: string, fn: (data: any) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    },
    disconnect: () => {
      polling = false;
      clearInterval(interval);
    },
  };
}

async function runDisplayE2ETests() {
  console.log('================================================================');
  console.log('🧪 RUNNING DINEFLOW CUSTOMER DISPLAY ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, details?: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
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
    const regDataA: any = await regResA.json();
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
    const staffRootData: any = await staffRootRes.json();
    assert(staffRootRes.status === 201 && staffRootData.success, 'Created Root (Billing)');

    // Create Waiter user "waiter1"
    const staffWaiterRes = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        userId: 'waiter1',
        name: 'Vicky Waiter',
        role: 'WAITER',
        password: 'password123',
      }),
    });
    const staffWaiterData: any = await staffWaiterRes.json();
    assert(staffWaiterRes.status === 201 && staffWaiterData.success, 'Created waiter1 (Waiter)');

    // -------------------------------------------------------------
    // Test 1: Admin configures paired Customer Display account
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Admin creates paired Customer Display (Display1 -> Root) ---');
    const staffDisplay1Res = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        userId: 'Display1',
        name: 'Main Counter QR Display',
        role: 'CUSTOMER_DISPLAY',
        linkedBillingUserId: 'Root',
        password: 'password123',
      }),
    });
    const staffDisplay1Data: any = await staffDisplay1Res.json();
    assert(
      staffDisplay1Res.status === 201 && staffDisplay1Data.success,
      'Admin successfully created Display1 with role CUSTOMER_DISPLAY'
    );
    assert(
      staffDisplay1Data.staff.linkedBillingUserId === 'Root',
      'Display1 correctly linked/paired to cashier user "Root"'
    );

    // -------------------------------------------------------------
    // Test 2: Display Login & REST Endpoints
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Display Login & Initial State ---');
    const loginDisplay1Res = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: restACode,
        userId: 'Display1',
        password: 'password123',
      }),
    });
    const display1Auth: any = await loginDisplay1Res.json();
    assert(loginDisplay1Res.status === 200 && display1Auth.role === 'CUSTOMER_DISPLAY', 'Display1 logged in');
    assert(display1Auth.redirectUrl === '/display', 'Display1 automatically routes to /display');
    const display1Token = display1Auth.token;

    // Login Cashier Root
    const loginRootRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: restACode,
        userId: 'Root',
        password: 'password123',
      }),
    });
    const rootAuth: any = await loginRootRes.json();
    const rootToken = rootAuth.token;

    // Login Waiter
    const loginWaiterRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: restACode,
        userId: 'waiter1',
        password: 'password123',
      }),
    });
    const waiterAuth: any = await loginWaiterRes.json();
    const waiterToken = waiterAuth.token;

    // Fetch initial display state
    const displayInitRes = await fetch(`${BASE_URL}/api/display/current`, {
      headers: { Authorization: `Bearer ${display1Token}` },
    });
    const displayInitData: any = await displayInitRes.json();
    assert(displayInitRes.status === 200 && displayInitData.success, 'GET /api/display/current succeeded');
    assert(displayInitData.pendingPayment === null, 'Display starts in IDLE state with no pending payment and no QR code');
    assert(displayInitData.restaurant?.name === 'Tandoor Garden Bistro', 'Display received restaurant branding');

    // Setup Realtime listener for Display1
    const subscriberDisplay1 = createRealtimeSubscriber(BASE_URL, restAId, display1Token);

    let lastInitiatedEvent: any = null;
    let lastUpdatedEvent: any = null;
    let lastConfirmedEvent: any = null;
    let lastCancelledEvent: any = null;

    subscriberDisplay1.on('payment:initiated', (data: any) => {
      lastInitiatedEvent = data;
    });
    subscriberDisplay1.on('payment:updated', (data: any) => {
      lastUpdatedEvent = data;
    });
    subscriberDisplay1.on('payment:confirmed', (data: any) => {
      lastConfirmedEvent = data;
    });
    subscriberDisplay1.on('payment:cancelled', (data: any) => {
      lastCancelledEvent = data;
    });

    // -------------------------------------------------------------
    // Test 3: Cashier initiates UPI Payment -> Display shows QR
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Cashier initiates payment -> Realtime event to Display ---');

    // Fetch table & menu
    const tablesRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const tablesData: any = await tablesRes.json();
    const table3 = tablesData.tables[0];

    const menuRes = await fetch(`${BASE_URL}/api/menu/items`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const menuData: any = await menuRes.json();
    const item1 = menuData.items[0];

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
    const order3Data: any = await order3Res.json();
    const order3Id = order3Data.order.id;

    // Cashier generates bill
    const billGenRes = await fetch(`${BASE_URL}/api/bills/generate`, {
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
    const billGenData: any = await billGenRes.json();
    const bill1Id = billGenData.bill.id;

    // Wait up to 500ms for realtime event
    await new Promise((r) => setTimeout(r, 500));

    assert(!!lastInitiatedEvent, 'Display received live "payment:initiated" event');
    assert(lastInitiatedEvent.billId === bill1Id, 'Event contains correct billId');
    assert(lastInitiatedEvent.cashierUserId === 'Root', 'Event paired to cashier "Root"');
    assert(typeof lastInitiatedEvent.upiUri === 'string' && lastInitiatedEvent.upiUri.startsWith('upi://pay?'), 'Event contains valid UPI deep-link URI');

    // -------------------------------------------------------------
    // Test 4: Dynamic Bill Modification (Discount) -> payment:updated
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Cashier adds discount -> payment:updated on Display ---');
    const billDiscountRes = await fetch(`${BASE_URL}/api/bills/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
      body: JSON.stringify({
        orderId: order3Id,
        discountType: 'FLAT',
        discountValue: 50,
      }),
    });
    const billDiscountData: any = await billDiscountRes.json();

    await new Promise((r) => setTimeout(r, 500));

    assert(!!lastUpdatedEvent, 'Display received live "payment:updated" event without a page refresh');
    assert(lastUpdatedEvent.discountAmount === 50, 'Updated event reflects the new ₹50 discount');
    assert(lastUpdatedEvent.amount === billDiscountData.bill.grandTotal, 'Amount matches updated discounted grand total');

    // -------------------------------------------------------------
    // Test 5: Payment Cancellation -> payment:cancelled -> return to IDLE
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Cashier cancels payment -> payment:cancelled -> Display returns to IDLE ---');
    const cancelRes = await fetch(`${BASE_URL}/api/bills/${bill1Id}/cancel-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
    });
    assert(cancelRes.status === 200, 'Cashier canceled payment session');

    await new Promise((r) => setTimeout(r, 500));

    assert(!!lastCancelledEvent, 'Display received live "payment:cancelled" event');
    assert(lastCancelledEvent.billId === bill1Id, 'Cancelled event matches the bill ID');

    // Verify GET /api/display/current returns null (IDLE)
    const afterCancelDisplayRes = await fetch(`${BASE_URL}/api/display/current`, {
      headers: { Authorization: `Bearer ${display1Token}` },
    });
    const afterCancelData: any = await afterCancelDisplayRes.json();
    assert(afterCancelData.pendingPayment === null, 'After cancellation, GET /api/display/current returns null (IDLE)');

    // -------------------------------------------------------------
    // Test 6: Payment Settlement -> payment:confirmed Celebration Screen
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Payment confirmed -> payment:confirmed Celebration Screen ---');
    // Re-initiate payment
    const reInitRes = await fetch(`${BASE_URL}/api/bills/generate`, {
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
    const reInitData: any = await reInitRes.json();

    // Cashier confirms payment
    const payRes = await fetch(`${BASE_URL}/api/bills/${reInitData.bill.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
      body: JSON.stringify({
        paymentMode: 'UPI',
        transactionRef: 'UPI-TXN-DISPLAY-TEST-777',
      }),
    });
    assert(payRes.status === 200, 'Cashier settled payment');

    await new Promise((r) => setTimeout(r, 500));

    assert(!!lastConfirmedEvent, 'Display received live "payment:confirmed" event');
    assert(lastConfirmedEvent.billId === reInitData.bill.id, 'Confirmed event matches settled bill');
    assert(lastConfirmedEvent.amount === reInitData.bill.grandTotal, 'Confirmed event includes settled amount for celebration screen');

    // -------------------------------------------------------------
    // Test 7: Realtime Channel Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Channel Tenant Authorization Security Check ---');

    // Verify unauthorized tenant channel access is rejected with 403 Forbidden
    const fakeChannelAuthRes = await fetch(`${BASE_URL}/api/realtime/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${display1Token}`,
      },
      body: JSON.stringify({
        channel_name: 'private-restaurant-OTHER-RESTAURANT-ID',
        socket_id: '123.456',
      }),
    });
    assert(
      fakeChannelAuthRes.status === 403,
      'Tenant isolation enforced: /api/realtime/auth rejected cross-tenant channel subscription with 403 Forbidden'
    );

    // Verify authorized channel succeeds
    const validChannelAuthRes = await fetch(`${BASE_URL}/api/realtime/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${display1Token}`,
      },
      body: JSON.stringify({
        channel_name: `private-restaurant-${restAId}`,
        socket_id: '123.456',
      }),
    });
    assert(
      validChannelAuthRes.status === 200,
      'Authorized tenant channel subscription successfully authenticated'
    );

    // -------------------------------------------------------------
    // Test 8: Vercel Cron Expired Payment Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Vercel Cron Payment Cleanup Endpoint ---');
    const cronRes = await fetch(`${BASE_URL}/api/cron/cleanup-payments`, {
      method: 'GET',
      headers: {
        'x-vercel-cron': '1',
        ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
      },
    });
    const cronData: any = await cronRes.json();
    assert(cronRes.status === 200 && cronData.success, 'Vercel Cron /api/cron/cleanup-payments endpoint ran successfully');

    subscriberDisplay1.disconnect();

    console.log('\n================================================================');
    console.log(`🎉 CUSTOMER DISPLAY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('💥 Customer Display test suite crashed with error:', error);
    process.exit(1);
  }
}

runDisplayE2ETests();
