import io from 'socket.io-client';

const BASE_URL = 'http://localhost:5000';

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
    // Create Root (Billing)
    const staffResBilling = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst1Token}`,
      },
      body: JSON.stringify({
        userId: 'Root',
        name: 'Ramesh Cashier',
        role: 'BILLING',
        password: 'password123',
      }),
    });
    const staffBillingData: any = await staffResBilling.json();
    assert(staffResBilling.status === 201 && staffBillingData.staff?.userId === 'Root', 'Created Billing staff user "Root"');

    // Create waiter1 (Waiter)
    const staffResWaiter = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst1Token}`,
      },
      body: JSON.stringify({
        userId: 'waiter1',
        name: 'Mohit Waiter',
        role: 'WAITER',
        password: 'password123',
      }),
    });
    const staffWaiterData: any = await staffResWaiter.json();
    assert(staffResWaiter.status === 201 && staffWaiterData.staff?.userId === 'waiter1', 'Created Waiter staff user "waiter1"');

    // Create kitchen1 (Kitchen)
    const staffResKitchen = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst1Token}`,
      },
      body: JSON.stringify({
        userId: 'kitchen1',
        name: 'Chef Imran',
        role: 'KITCHEN',
        password: 'password123',
      }),
    });
    const staffKitchenData: any = await staffResKitchen.json();
    assert(staffResKitchen.status === 201 && staffKitchenData.staff?.userId === 'kitchen1', 'Created Kitchen staff user "kitchen1"');

    // -------------------------------------------------------------
    // Test 3: Log in as "Root" using Restaurant ID + User ID + Password -> land on Billing
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Log in as "Root" -> redirect to /billing ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: rst1Code,
        userId: 'Root',
        password: 'password123',
      }),
    });
    const loginData: any = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success, 'Staff login for "Root" succeeded');
    assert(loginData.role === 'BILLING', 'Role is BILLING');
    assert(loginData.redirectUrl === '/billing', 'Redirect URL is /billing');
    const rootToken = loginData.token;

    // -------------------------------------------------------------
    // Test 4: Second restaurant can also create "Root" without conflict, and isolated data
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Second restaurant creates "Root" without collision & strict data isolation ---');
    const rest2Email = `bistro-${Date.now()}@restaurant.com`;
    const regRes2 = await fetch(`${BASE_URL}/api/auth/register-restaurant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName: 'Bay Leaf Coastal Bistro',
        ownerName: 'Ananya Rao',
        email: rest2Email,
        phone: '9876500002',
        address: '12 Marine Drive, Kochi',
        upiId: 'bayleaf@okicici',
        adminPassword: 'password123',
      }),
    });
    const regData2: any = await regRes2.json();
    const rst2Code = regData2.restaurant.code;
    const rst2Token = regData2.token;

    // Create "Root" in Restaurant 2
    const staff2ResBilling = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rst2Token}`,
      },
      body: JSON.stringify({
        userId: 'Root',
        name: 'Kavita Cashier (Rest 2)',
        role: 'BILLING',
        password: 'password456',
      }),
    });
    const staff2BillingData: any = await staff2ResBilling.json();
    assert(staff2ResBilling.status === 201 && staff2BillingData.staff?.userId === 'Root', 'Second restaurant successfully created user "Root" without conflict');

    // Verify Restaurant 1 Root cannot see Restaurant 2 tables or data
    const rst2TablesRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rst2Token}` },
    });
    const rst2Tables: any = await rst2TablesRes.json();

    const rst1RootTablesRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const rst1RootTables: any = await rst1RootTablesRes.json();

    const tableIdsRst1 = new Set(rst1RootTables.tables.map((t: any) => t.id));
    const overlap = rst2Tables.tables.some((t: any) => tableIdsRst1.has(t.id));
    assert(!overlap, 'Strict Multi-Tenant Isolation: Zero overlap in table data between Restaurant 1 and Restaurant 2');

    // -------------------------------------------------------------
    // Test 5: On Waiter phone view, place order for Table 3, appears in Kitchen
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Waiter places order for Table 3 -> appears on Kitchen screen ---');
    // Login as waiter1
    const waiterLoginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: rst1Code,
        userId: 'waiter1',
        password: 'password123',
      }),
    });
    const waiterData: any = await waiterLoginRes.json();
    const waiterToken = waiterData.token;

    // Get Table 3
    const t3 = rst1RootTables.tables.find((t: any) => t.tableNumber === 'Table 3');
    assert(!!t3, 'Table 3 found in Restaurant 1');

    // Get menu items
    const menuRes = await fetch(`${BASE_URL}/api/menu/items`, {
      headers: { Authorization: `Bearer ${waiterToken}` },
    });
    const menuData: any = await menuRes.json();
    const paneerTikka = menuData.items.find((i: any) => i.name.includes('Paneer Tikka')) || menuData.items[0];
    const dalMakhani = menuData.items.find((i: any) => i.name.includes('Dal Makhani')) || menuData.items[1];

    // Set up Socket.IO client for Kitchen to verify real-time event delivery!
    const socket = io(BASE_URL);
    let orderReceivedViaSocket = false;
    let receivedOrderId = '';

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        socket.emit('join:restaurant', {
          restaurantId: rst1Id,
          role: 'KITCHEN',
        });
        resolve();
      });
    });

    socket.on('order:created', (data: any) => {
      orderReceivedViaSocket = true;
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

    // Give socket event 300ms to arrive
    await new Promise((r) => setTimeout(r, 400));
    assert(orderReceivedViaSocket && receivedOrderId === orderData.order.id, 'Kitchen received live "order:created" Socket.IO broadcast instantly');

    // Verify Table 3 status updated to OCCUPIED
    const t3UpdatedRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const t3UpdatedData: any = await t3UpdatedRes.json();
    const t3Updated = t3UpdatedData.tables.find((t: any) => t.id === t3.id);
    assert(t3Updated.status === 'OCCUPIED', 'Table 3 status updated to OCCUPIED');

    // -------------------------------------------------------------
    // Test 6: Kitchen marks item Ready, waiter is notified
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Kitchen marks item Ready -> Waiter notified ---');
    // Login as kitchen1
    const kitchenLoginRes = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantCode: rst1Code,
        userId: 'kitchen1',
        password: 'password123',
      }),
    });
    const kitchenData: any = await kitchenLoginRes.json();
    const kitchenToken = kitchenData.token;

    let readyNotifReceived = false;
    socket.on('order:item_status_updated', (data: any) => {
      if (data.status === 'READY') {
        readyNotifReceived = true;
      }
    });

    const firstItemId = orderData.order.items[0].id;
    const markReadyRes = await fetch(`${BASE_URL}/api/orders/${orderData.order.id}/items/${firstItemId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ status: 'READY' }),
    });
    const markReadyData: any = await markReadyRes.json();
    assert(markReadyRes.status === 200 && markReadyData.item?.status === 'READY', 'Kitchen successfully marked item as READY');

    await new Promise((r) => setTimeout(r, 400));
    assert(readyNotifReceived, 'Waiter received "order:item_status_updated" (READY) notification');

    // Waiter marks item as SERVED
    const markServedRes = await fetch(`${BASE_URL}/api/orders/${orderData.order.id}/items/${firstItemId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({ status: 'SERVED' }),
    });
    assert(markServedRes.status === 200, 'Waiter marked item as SERVED');

    // -------------------------------------------------------------
    // Test 7: Billing opens Table 3's bill and generates UPI QR with exact amount
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Billing opens Table 3 bill -> generates UPI QR with exact amount ---');
    const tableBillRes = await fetch(`${BASE_URL}/api/bills/table/${t3.id}`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const tableBillData: any = await tableBillRes.json();
    assert(tableBillData.success && !!tableBillData.billPreview, 'Billing retrieved active table order calculation');

    const expectedGrandTotal = tableBillData.billPreview.grandTotal;

    // Generate official bill with UPI QR deep link
    const genBillRes = await fetch(`${BASE_URL}/api/bills/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
      body: JSON.stringify({
        orderId: orderData.order.id,
        discountType: 'NONE',
        discountValue: 0,
      }),
    });
    const genBillData: any = await genBillRes.json();
    if (!genBillData.success) {
      console.log('genBillRes debug:', genBillRes.status, genBillData);
    }
    assert(genBillRes.status === 200 && genBillData.success, 'Official bill generated');
    assert(typeof genBillData.upiUri === 'string', 'UPI URI returned');
    assert(
      genBillData.upiUri?.includes(`am=${expectedGrandTotal.toFixed(2)}`),
      'UPI deep link contains exact pre-filled grand total amount',
      `URI: ${genBillData.upiUri}`
    );
    assert(
      genBillData.upiUri.includes(`pa=${encodeURIComponent('granddarbar@okhdfcbank')}`),
      'UPI deep link contains restaurant UPI ID (VPA)'
    );

    const generatedBillId = genBillData.bill.id;

    // -------------------------------------------------------------
    // Test 8: Confirm payment, bill marked Paid, table becomes free
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Confirm payment -> Bill marked PAID & Table 3 freed ---');
    let billPaidViaSocket = false;
    socket.on('bill:paid', (data: any) => {
      if (data.billId === generatedBillId) {
        billPaidViaSocket = true;
      }
    });

    const payRes = await fetch(`${BASE_URL}/api/bills/${generatedBillId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rootToken}`,
      },
      body: JSON.stringify({
        paymentMode: 'UPI',
        transactionRef: 'UPI-REF-TEST-998811',
      }),
    });
    const payData: any = await payRes.json();
    assert(payRes.status === 200 && payData.bill?.paymentStatus === 'PAID', 'Bill payment marked as PAID');

    await new Promise((r) => setTimeout(r, 400));
    assert(billPaidViaSocket, 'Live "bill:paid" broadcast sent to all stations');

    // Verify Table 3 is now FREE
    const t3FinalRes = await fetch(`${BASE_URL}/api/tables`, {
      headers: { Authorization: `Bearer ${rootToken}` },
    });
    const t3FinalData: any = await t3FinalRes.json();
    const t3Final = t3FinalData.tables.find((t: any) => t.id === t3.id);
    assert(t3Final.status === 'FREE', 'Table 3 status successfully reset to FREE');

    // -------------------------------------------------------------
    // Test 9: A waiter account cannot open billing or admin routes (access denied)
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Waiter account cannot access Billing or Admin routes ---');
    // Try to access admin reports with waiterToken -> Expect 403 Forbidden
    const adminRouteRes = await fetch(`${BASE_URL}/api/reports/dashboard`, {
      headers: { Authorization: `Bearer ${waiterToken}` },
    });
    assert(
      adminRouteRes.status === 403,
      'Backend rejects waiter accessing Admin route (/api/reports/dashboard) with 403 Forbidden'
    );

    // Try to access billing pay route with waiterToken -> Expect 403 Forbidden
    const billingPayRes = await fetch(`${BASE_URL}/api/bills/${generatedBillId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({ paymentMode: 'CASH' }),
    });
    assert(
      billingPayRes.status === 403,
      'Backend rejects waiter accessing Billing settlement route (/api/bills/:id/pay) with 403 Forbidden'
    );

    // Try to access staff creation with waiterToken -> Expect 403 Forbidden
    const staffCreateRes = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({
        userId: 'hacker',
        name: 'Hacker',
        role: 'ADMIN',
        password: 'password123',
      }),
    });
    assert(
      staffCreateRes.status === 403,
      'Backend rejects waiter creating staff with 403 Forbidden'
    );

    socket.disconnect();

    console.log('\n====================================================');
    console.log(`📊 FINAL TEST REPORT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runE2ETests();
