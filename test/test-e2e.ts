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
    } catch {
      // Ignore network errors in test loop
    }
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

async function runE2ETests() {
  console.log('====================================================');
  console.log('🧪 RUNNING DINEFLOW END-TO-END ACCEPTANCE TEST SUITE');
  console.log('====================================================\n');

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
    // Test 1: Create a restaurant account and receive a Restaurant ID
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Create Restaurant Account & Receive Restaurant ID ---');
    const rest1Email = `darbar-${Date.now()}@restaurant.com`;
    const regRes1 = await fetch(`${BASE_URL}/api/auth/register-restaurant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName: 'Grand Darbar Royal Dine',
        ownerName: 'Kabir Khan',
        email: rest1Email,
        phone: '9876500001',
        address: '45 Heritage Palace Road, Jaipur',
        gstin: '08AABCG1234F1Z1',
        upiId: 'granddarbar@okhdfcbank',
        adminPassword: 'password123',
      }),
    });
    const regData1: any = await regRes1.json();
    assert(regRes1.status === 201 && regData1.success, 'Restaurant 1 created successfully');
    assert(
      typeof regData1.restaurant?.code === 'string' && regData1.restaurant.code.startsWith('RST-'),
      'Unique Restaurant ID generated and returned',
      `Got code: ${regData1.restaurant?.code}`
    );

    const rst1Code = regData1.restaurant.code;
    const rst1Token = regData1.token;
    const rst1Id = regData1.restaurant.id;

    // -------------------------------------------------------------
    // Test 2: As Admin, create Billing "Root", Waiter "waiter1", Kitchen "kitchen1"
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Admin creates staff credentials (Root, waiter1, kitchen1) ---');
    const staffResBilling = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst1Token}`,
      },
      body: JSON.stringify({
        userId: 'Root',
        name: 'Head Cashier Rajesh',
        role: 'BILLING',
        password: 'password123',
      }),
    });
    const staffDataBilling: any = await staffResBilling.json();
    assert(staffResBilling.status === 201 && staffDataBilling.success, 'Created Root (Billing) staff account');

    const staffResWaiter = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst1Token}`,
      },
      body: JSON.stringify({
        userId: 'waiter1',
        name: 'Floor Captain Vicky',
        role: 'WAITER',
        password: 'password123',
      }),
    });
    const staffDataWaiter: any = await staffResWaiter.json();
    assert(staffResWaiter.status === 201 && staffDataWaiter.success, 'Created waiter1 (Waiter) staff account');

    const staffResKitchen = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst1Token}`,
      },
      body: JSON.stringify({
        userId: 'kitchen1',
        name: 'Head Chef Ranveer',
        role: 'KITCHEN',
        password: 'password123',
      }),
    });
    const staffDataKitchen: any = await staffResKitchen.json();
    assert(staffResKitchen.status === 201 && staffDataKitchen.success, 'Created kitchen1 (Kitchen) staff account');

    // -------------------------------------------------------------
    // Test 3: Log in as each role and verify role isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Staff Login & Role Redirection Verification ---');

    // Login as Billing
    const loginRootRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: rst1Code,
        userId: 'Root',
        password: 'password123',
      }),
    });
    const rootData: any = await loginRootRes.json();
    assert(loginRootRes.status === 200 && rootData.role === 'BILLING', 'Root logged in with BILLING role');
    assert(rootData.redirectUrl === '/billing', 'Root redirected to /billing');
    const rootToken = rootData.token;

    // Login as Waiter
    const loginWaiterRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: rst1Code,
        userId: 'waiter1',
        password: 'password123',
      }),
    });
    const waiterData: any = await loginWaiterRes.json();
    assert(loginWaiterRes.status === 200 && waiterData.role === 'WAITER', 'waiter1 logged in with WAITER role');
    assert(waiterData.redirectUrl === '/waiter', 'waiter1 redirected to /waiter');
    const waiterToken = waiterData.token;

    // Login as Kitchen
    const loginKitchenRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: rst1Code,
        userId: 'kitchen1',
        password: 'password123',
      }),
    });
    const kitchenData: any = await loginKitchenRes.json();
    assert(loginKitchenRes.status === 200 && kitchenData.role === 'KITCHEN', 'kitchen1 logged in with KITCHEN role');
    assert(kitchenData.redirectUrl === '/kitchen', 'kitchen1 redirected to /kitchen');
    const kitchenToken = kitchenData.token;

    // Verify Waiter cannot access Admin routes
    const forbiddenRes = await fetch(`${BASE_URL}/api/reports/dashboard`, {
      headers: { Authorization: `Bearer ${waiterToken}` },
    });
    assert(forbiddenRes.status === 403, 'Waiter forbidden from accessing Admin Dashboard (RBAC enforced)');

    // -------------------------------------------------------------
    // Test 4: Multi-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Multi-Tenant Isolation Verification ---');
    const rest2Email = `chulha-${Date.now()}@restaurant.com`;
    const regRes2 = await fetch(`${BASE_URL}/api/auth/register-restaurant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName: 'Desi Chulha Dhaba',
        ownerName: 'Manpreet Singh',
        email: rest2Email,
        phone: '9876500002',
        address: 'NH-8 Highway, Gurugram',
        gstin: '07AABCM5678K1Z9',
        upiId: 'desichulha@okaxis',
        adminPassword: 'password123',
      }),
    });
    const regData2: any = await regRes2.json();
    const rst2Token = regData2.token;

    const rst1TablesRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rst1Token}` },
    });
    const rst1TablesData: any = await rst1TablesRes.json();

    const rst2TablesRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rst2Token}` },
    });
    const rst2TablesData: any = await rst2TablesRes.json();

    const rst1TableIds = new Set(rst1TablesData.tables.map((t: any) => t.id));
    const overlap = rst2TablesData.tables.some((t: any) => rst1TableIds.has(t.id));
    assert(!overlap, 'Strict Multi-Tenant Isolation: Restaurant 1 tables never visible to Restaurant 2');

    // -------------------------------------------------------------
    // Test 5: Full Order Flow (Waiter -> Kitchen -> Ready -> Bill -> Settlement)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Complete Order Flow with Real-time Events ---');

    // Get Table 3
    const t3 = rst1TablesData.tables[2] || rst1TablesData.tables[0];
    assert(t3.status === 'FREE', `Target table ${t3.tableNumber} is currently FREE`);

    // Fetch menu items
    const menuRes = await fetch(`${BASE_URL}/api/menu/items`, {
      headers: { Authorization: `Bearer ${waiterToken}` },
    });
    const menuData: any = await menuRes.json();
    const paneerTikka = menuData.items[0];
    const dalMakhani = menuData.items.find((i: any) => i.name.includes('Dal Makhani')) || menuData.items[1];

    // Set up Realtime listener for Kitchen
    const kitchenSubscriber = createRealtimeSubscriber(BASE_URL, rst1Id, kitchenToken);
    let orderReceivedViaRealtime = false;
    let receivedOrderId = '';

    kitchenSubscriber.on('order:created', (data: any) => {
      orderReceivedViaRealtime = true;
      receivedOrderId = data.id;
    });

    // Waiter places order for Table 3
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({
        tableId: t3.id,
        orderType: 'DINE_IN',
        items: [
          { menuItemId: paneerTikka.id, quantity: 2, notes: 'Crispy and less spicy' },
          { menuItemId: dalMakhani.id, quantity: 1, notes: 'Extra butter on top' },
        ],
      }),
    });
    const orderData: any = await orderRes.json();
    assert(orderRes.status === 201 && orderData.success, 'Waiter successfully placed order for Table 3');

    // Wait up to 500ms for realtime event
    await new Promise((r) => setTimeout(r, 500));
    assert(orderReceivedViaRealtime && receivedOrderId === orderData.order.id, 'Kitchen received live "order:created" broadcast');

    // Verify Table 3 status updated to OCCUPIED
    const t3UpdatedRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const t3UpdatedData: any = await t3UpdatedRes.json();
    const t3Updated = t3UpdatedData.tables.find((t: any) => t.id === t3.id);
    assert(t3Updated.status === 'OCCUPIED', 'Table 3 status updated to OCCUPIED in database');

    // Kitchen marks first item as PREPARING, second as READY
    const items = orderData.order.items;
    const item1 = items[0];
    const item2 = items[1];

    let itemReadyBroadcastReceived = false;
    kitchenSubscriber.on('order:item_status_updated', (data: any) => {
      if (data.status === 'READY') {
        itemReadyBroadcastReceived = true;
      }
    });

    const markPreparingRes = await fetch(`${BASE_URL}/api/orders/${orderData.order.id}/items/${item1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ status: 'PREPARING' }),
    });
    assert(markPreparingRes.status === 200, 'Kitchen marked item 1 as PREPARING');

    const markReadyRes = await fetch(`${BASE_URL}/api/orders/${orderData.order.id}/items/${item2.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ status: 'READY' }),
    });
    assert(markReadyRes.status === 200, 'Kitchen marked item 2 as READY');

    await new Promise((r) => setTimeout(r, 400));
    assert(itemReadyBroadcastReceived, 'Waiter received real-time broadcast that item is READY');

    // Waiter marks remaining items as SERVED
    await fetch(`${BASE_URL}/api/orders/${orderData.order.id}/items/${item1.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ status: 'SERVED' }),
    });
    await fetch(`${BASE_URL}/api/orders/${orderData.order.id}/items/${item2.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` },
      body: JSON.stringify({ status: 'SERVED' }),
    });

    // Waiter requests bill for Table 3
    const reqBillRes = await fetch(`${BASE_URL}/api/bills/request-bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({ tableId: t3.id }),
    });
    const reqBillData: any = await reqBillRes.json();
    assert(reqBillRes.status === 200 && reqBillData.table.status === 'BILLING', 'Waiter requested bill; Table status -> BILLING');

    // -------------------------------------------------------------
    // Test 6: Bill Calculation & UPI Deep Link Generation
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Bill Calculation, Discount, and UPI QR URI ---');

    const billCalcRes = await fetch(`${BASE_URL}/api/bills/table/${t3.id}`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const billCalcData: any = await billCalcRes.json();
    assert(billCalcRes.status === 200 && billCalcData.success, 'Cashier fetched live table bill calculation');

    const expectedSubtotal = 2 * paneerTikka.price + 1 * dalMakhani.price;
    assert(billCalcData.billPreview.subtotal === expectedSubtotal, `Subtotal verified: ₹${expectedSubtotal}`);

    // Generate Bill with 10% discount
    const genBillRes = await fetch(`${BASE_URL}/api/bills/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
      body: JSON.stringify({
        orderId: orderData.order.id,
        discountType: 'PERCENT',
        discountValue: 10,
      }),
    });
    const genBillData: any = await genBillRes.json();
    assert(genBillRes.status === 200 && genBillData.success, 'Official Bill generated successfully');
    assert(
      genBillData.bill.billNumber.startsWith('INV-'),
      `Generated unique bill number: ${genBillData.bill.billNumber}`
    );

    // Verify NPCI UPI Deep Link
    const upiUri: string = genBillData.upiUri;
    assert(
      upiUri.startsWith('upi://pay?'),
      'Valid NPCI-compliant UPI URI generated (upi://pay?...)'
    );
    assert(upiUri.includes('pa=granddarbar%40okhdfcbank') || upiUri.includes('pa=granddarbar@okhdfcbank'), 'UPI ID included correctly');
    assert(upiUri.includes(`am=${Number(genBillData.bill.grandTotal).toFixed(2)}`), 'Exact Bill grand total embedded in UPI string');

    // -------------------------------------------------------------
    // Test 7: Bill Payment Settlement & Table Auto-Clearance
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Payment Confirmation & Table Auto-Clearance ---');

    let billPaidViaRealtime = false;
    kitchenSubscriber.on('bill:paid', (data: any) => {
      if (data.billNumber === genBillData.bill.billNumber) {
        billPaidViaRealtime = true;
      }
    });

    const payRes = await fetch(`${BASE_URL}/api/bills/${genBillData.bill.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
      body: JSON.stringify({
        paymentMode: 'UPI',
        transactionRef: 'UPI-TXN-SUCCESS-TEST-999',
      }),
    });
    const payData: any = await payRes.json();
    assert(payRes.status === 200 && payData.bill.paymentStatus === 'PAID', 'Bill settled and marked as PAID');

    await new Promise((r) => setTimeout(r, 400));
    assert(billPaidViaRealtime, 'Live "bill:paid" broadcast sent to all stations');

    // Verify Table 3 is automatically restored to FREE
    const t3FinalRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const t3FinalData: any = await t3FinalRes.json();
    const t3Final = t3FinalData.tables.find((t: any) => t.id === t3.id);
    assert(t3Final.status === 'FREE' && t3Final.currentOrderId === null, 'Table 3 automatically freed for next guest');

    // -------------------------------------------------------------
    // Test 8: Admin Reports & Dashboard Metrics
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Admin Analytics, Metrics & CSV Export ---');
    const dashRes = await fetch(`${BASE_URL}/api/reports/dashboard`, {
      headers: { Authorization: `Bearer ${rst1Token}` },
    });
    const dashData: any = await dashRes.json();
    assert(dashRes.status === 200 && dashData.success, 'Admin Dashboard reports loaded');
    assert(dashData.metrics.todaySales >= genBillData.bill.grandTotal, 'Today sales metrics include settled bill');

    const csvRes = await fetch(`${BASE_URL}/api/reports/export-csv`, {
      headers: { Authorization: `Bearer ${rst1Token}` },
    });
    assert(csvRes.status === 200 && csvRes.headers.get('content-type')?.includes('text/csv'), 'CSV report exported successfully');
    const csvText = await csvRes.text();
    assert(csvText.includes(genBillData.bill.billNumber), 'Settled invoice present in CSV export file');

    kitchenSubscriber.disconnect();

    console.log('\n====================================================');
    console.log(`🎉 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('💥 Test suite crashed with error:', error);
    process.exit(1);
  }
}

runE2ETests();
