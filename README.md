# DineFlow 🍽️
### Enterprise Multi-Tenant Restaurant Management, Waiter PWA, Kitchen Display & Billing POS

DineFlow is a modern, full-stack, multi-tenant restaurant management web platform built with **React 18 + Vite + Tailwind CSS**, **Node.js + Express**, **Prisma ORM with SQLite**, and **Socket.IO** for instantaneous real-time coordination across dining tables, waiters, kitchens, and cashiers.

Tailored for Indian restaurant operations, DineFlow supports **INR (₹) currency**, **GST tax calculations (CGST/SGST)**, and **dynamic NPCI UPI QR payments**.

---

## ⚡ Quick Start (One Command to Run Everything)

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)

### 2. Setup & Launch
From the root directory:

```bash
# 1. Install all dependencies across server and client
npm run install:all

# 2. Push database schema & populate demo seed data
npm run seed

# 3. Launch both backend server and client UI concurrently
npm run dev
```

The application will be live at:
- **Web Application:** [http://localhost:5173](http://localhost:5173) (or [http://localhost:5000](http://localhost:5000))
- **Backend API & WebSockets:** [http://localhost:5000](http://localhost:5000)

---

## 🔑 Demo Restaurant Credentials (Pre-Seeded)

DineFlow comes out of the box with a pre-configured demo restaurant **"Spice Route Bistro & Bar"** with 10 tables, 5 menu categories, and 17 signature dishes.

| Module | Login URL | Restaurant ID (Code) | User ID / Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Portal** | `/admin-login` (or `/login`) | `RST-10101` | `admin@spiceroute.com` | `admin123` | Owner dashboard & settings |
| **Billing Cashier** | `/login` | `RST-10101` | `Root` | `password123` | Counter POS & thermal printing |
| **Customer Display** | `/login` | `RST-10101` | `Display1` | `password123` | Linked to counter `Root` |
| **Floor Waiter** | `/login` | `RST-10101` | `waiter1` | `password123` | Mobile ordering PWA |
| **Kitchen KDS** | `/login` | `RST-10101` | `kitchen1` | `password123` | Dark mode kitchen tickets |

> 💡 **Tip:** On the `/login` page, you can also click the quick **Demo Autofill Pills** to sign in to any station with a single click.

---

## 🏢 Multi-Tenant Architecture & Role-Based Access Control (RBAC)

### 1. Zero Cross-Tenant Data Leakage
- Every record (`Category`, `MenuItem`, `RestaurantTable`, `Order`, `OrderItem`, `Bill`, `StaffUser`) belongs to a specific `restaurantId`.
- Every incoming request passes through the `verifyAuth` middleware, which parses the authenticated JWT and extracts the caller's `restaurantId` and `role`.
- Database queries automatically scope by `where: { restaurantId }`. One restaurant can never view, mutate, or access another restaurant's data.

### 2. Compound Staff Credential Isolation
- Staff credentials (`StaffUser`) enforce a compound unique constraint: `@@unique([restaurantId, userId])`.
- This allows **two different restaurants to both create a user named `Root` or `Display1`** without collision. Each staff member logs in using `[Restaurant ID] + [User ID] + [Password]`.

### 3. Role-Based Route Guards
- Users are automatically routed to their authorized station on login:
  - `BILLING` ➔ `/billing` (Cashier POS)
  - `CUSTOMER_DISPLAY` ➔ `/display` (Customer QR Display)
  - `WAITER` ➔ `/waiter` (Waiter Mobile PWA)
  - `KITCHEN` ➔ `/kitchen` (Kitchen Display System)
  - `ADMIN` ➔ `/admin` (Management Dashboard)
- Any attempt by a Customer Display or Waiter account to open forbidden routes is blocked on both frontend routes and backend APIs (`403 Forbidden`). Customer Display accounts can only access `/display` and `/api/display/current`.

---

## 📱 Modules Overview

### 1. Admin Management Panel (`/admin`)
- **Dashboard Metrics:** Today's gross sales (₹), order volume, active tables counter, and average order value.
- **7-Day Revenue Trend:** Interactive SVG bar chart showing daily revenue and orders.
- **Menu Management:** Category ordering, Item CRUD with veg/non-veg tags, pricing in ₹, tax percentages, and availability toggles.
- **Table Management:** Floor plan setup, table numbers, and seating capacities.
- **Staff Management:** Create, edit, toggle active status, reset passwords, and optionally pair Customer Display screens to specific Billing cashiers.
- **Restaurant Settings:** Configure UPI ID (VPA), GSTIN, GST rate %, service charge %, invoice header and footer text, and toggle "Show itemised bill summary on customer display".
- **Reports & CSV Export:** Download comprehensive billing and tax reports in standard CSV format.

### 2. Billing Software & POS (`/billing`)
- **Visual Table Grid:** Live status badges (🟢 Free, 🟡 Occupied, 🔵 Bill Requested with alert).
- **Tax & Discount Engine:** Calculates Subtotal, Discount (flat ₹ or %), CGST (2.5%), SGST (2.5%), and Service Charge (5%).
- **Payment Modes:** UPI QR, Cash, and Card settlements.
- **Printable Tax Invoices:** Built-in standard thermal receipt format (80mm) with itemized breakdown, tax details, and print shortcut (`Ctrl+P` / button).
- **Bill History:** Historical invoice search and re-printing.
- **Customer Display Sync:** Emits live payment events (`payment:initiated`, `payment:updated`, `payment:confirmed`, `payment:cancelled`) so paired customer screens reflect real-time pricing without page refresh.

### 3. Customer Display (QR Display) Software (`/display`)
- **Mobile-First & Clean Fullscreen:** Minimal, distraction-free screen designed for customer-facing tablets or smartphones at checkout.
- **Counter Pairing:** Displays can be linked to a specific cashier counter (e.g. `Display1` paired with `Root`) or unlinked (showing the restaurant's latest pending payment).
- **3 Dynamic States:**
  - **IDLE:** Calm restaurant branding, welcome greeting, and no QR code.
  - **PAYMENT PENDING:** Displays a large high-contrast UPI QR code (`upi://pay?pa=...`), ₹ amount with 2 decimal precision, bill number, and optional itemized summary. Live discounts and item modifications update instantaneously.
  - **PAYMENT SUCCESS:** Animated green tick celebration screen for ~5 seconds when cashier confirms receipt, then returns automatically to IDLE.
  - **CANCELLED:** Immediately wipes the QR and returns to IDLE if the cashier closes or cancels the payment modal.
- **Device-Friendly Capabilities:**
  - **Screen Wake Lock API:** Prevents tablet screen from going to sleep while waiting for customers.
  - **Fullscreen Toggle & PWA:** Installable as a standalone app with portrait and landscape responsiveness.
  - **Brightness-Safe High-Contrast QR:** Black QR on white container with quiet-zone margins for instant camera scanning.
  - **Discreet Logout:** 2-second long-press on the restaurant header prevents accidental guest clicks.
  - **Auto-Expiry:** Unsettled pending payments expire automatically after 15 minutes to prevent stale displays.
  - **Live Reconnect Recovery:** Queries `GET /api/display/current` on page load/reconnection with a subtle status indicator.

### 4. Waiter Mobile-First PWA (`/waiter`)
- **Mobile Touch Design:** Large touch targets, bottom bar navigation, installable PWA manifest.
- **Dining Workflow:** Select table ➔ browse menu with category pills and search ➔ toggle Veg / Non-Veg filter ➔ add items with cooking notes ("less spicy", "no onion").
- **KOT Generation:** Instant dispatch to kitchen via WebSockets.
- **KOT Additions:** Append new items to an existing running table order.
- **Live Status Progression:** Tracks item progression: `Pending` ➔ `Preparing` ➔ `Ready` ➔ `Served`.
- **Sound Alerts:** Audio chime and toast notification when kitchen marks an item `Ready`.
- **Request Bill:** Notifies cashier with one click and marks table as `BILLING`.

### 5. Kitchen Display System - KDS (`/kitchen`)
- **High-Contrast Dark Mode:** Designed for hot, fast-paced kitchen environments.
- **Ticket Sorting & Urgency Timers:** Oldest orders first with live running timers:
  - 🟢 Green: `< 10 minutes`
  - 🟡 Amber: `10 - 20 minutes`
  - 🔴 Red: `> 20 minutes` (Urgent blinking)
- **Audio Chime:** Native Web Audio API chime sounds automatically when a new KOT arrives without requiring page refresh.
- **Prep Workflow:** One-click "Start Cooking" and "Mark Ready" per item or per ticket batch.

### 6. Dynamic UPI QR Payments
- Encodes standard NPCI UPI deep-links:
  ```
  upi://pay?pa=<UPI_ID>&pn=<Restaurant_Name>&am=<Grand_Total>&cu=INR&tn=<Bill_Number>&tr=<Txn_Ref>
  ```
- Customer scans with Google Pay, PhonePe, Paytm, BHIM, or CRED.
- Amount is pre-filled down to 2 decimals and payee name is locked.
- Dynamic regeneration: If items or discounts change, the QR code updates automatically.
- One-click "Confirm Payment Received" frees the dining table and broadcasts updates to all stations.

---

## 💳 PaymentProvider Architecture & Gateway Extensibility

DineFlow's payment layer is architected behind a clean, decoupled `PaymentProvider` interface located at [`server/src/services/paymentProvider.ts`](file:///c:/Users/admin/Desktop/Project-1/server/src/services/paymentProvider.ts):

```typescript
export interface IPaymentProvider {
  name: string;
  generateUpiUri(details: PaymentDetails): string;
  verifyPayment(transactionRef: string, amount: number): Promise<PaymentVerificationResult>;
  handleWebhook?(payload: any, signature: string): Promise<PaymentVerificationResult>;
}
```

### Plugging in Payment Gateways (Razorpay / Cashfree)
1. **Webhook Integration:** Implement `handleWebhook` to verify HMAC SHA256 signatures for incoming payment events from Razorpay or Cashfree.
2. **Automated Settlement:** On receiving the `payment.captured` or `ORDER_PAID` webhook payload, invoke the internal `payBill` service with the gateway transaction reference.
3. **Dynamic QR Codes:** For automated QR confirmation, Razorpay Dynamic UPI QR or Cashfree Virtual Accounts can be generated by returning the gateway-provided QR string directly in `generateUpiUri`.

---

## 🧪 Automated End-to-End Acceptance Tests

DineFlow includes automated test suites verifying all core restaurant workflows and Customer Display criteria:

### 1. General Restaurant & KOT Flow (`test-e2e.ts`)
```bash
cd server
npx ts-node src/test-e2e.ts
```
- ✅ **Test 1:** Create restaurant account and receive unique short Restaurant ID (`RST-XXXXX`)
- ✅ **Test 2:** Admin creates staff credentials (`Root`, `waiter1`, `kitchen1`)
- ✅ **Test 3:** Log in as `Root` with Restaurant ID + User ID + Password ➔ land on `/billing`
- ✅ **Test 4:** Second restaurant creates user `Root` without conflict & verified zero cross-tenant data leakage
- ✅ **Test 5:** Waiter places order for Table 3 ➔ instant Socket.IO broadcast to kitchen ➔ Table status `OCCUPIED`
- ✅ **Test 6:** Kitchen marks item `READY` ➔ Waiter notified via WebSockets ➔ Waiter marks `SERVED`
- ✅ **Test 7:** Billing opens Table 3 bill ➔ generates UPI QR with exact pre-filled grand total
- ✅ **Test 8:** Cashier confirms payment ➔ Bill marked `PAID` ➔ Table 3 freed (`FREE`)
- ✅ **Test 9:** Waiter account denied access to Billing and Admin routes (`403 Forbidden`)

### 2. Customer Display Software Test Suite (`test-display-e2e.ts`)
```bash
cd server
npx ts-node src/test-display-e2e.ts
```
- ✅ **Test 1:** Admin creates Customer Display user `Display1` and pairs with billing user `Root`
- ✅ **Test 2:** Display1 signs in with Restaurant ID + User ID + Password ➔ lands in `IDLE` state with no QR
- ✅ **Test 3:** Billing cashier `Root` opens Table 3 bill and initiates UPI payment ➔ `payment:initiated` received within 1s with matching amount & bill number
- ✅ **Test 4:** Cashier applies 10% discount in Billing ➔ `payment:updated` emitted live and QR updates on display without refresh
- ✅ **Test 5:** Cashier confirms payment ➔ `payment:confirmed` emitted ➔ display transitions to success screen and resets to `IDLE`
- ✅ **Test 6:** Cashier initiates payment then cancels ➔ `payment:cancelled` emitted ➔ display returns to `IDLE` immediately
- ✅ **Test 7:** Pending payment recovery ➔ page reload on `/display` queries `GET /api/display/current` and restores active QR
- ✅ **Test 8:** Pairing isolation ➔ another cashier (`Root2`) initiates payment ➔ paired `Display1` ignores it; unlinked display receives it
- ✅ **Test 9:** RBAC route enforcement ➔ `CUSTOMER_DISPLAY` receives `403 Forbidden` on `/billing`, `/waiter`, `/kitchen`, `/admin`, `/orders`, `/tables`; `WAITER` receives `403 Forbidden` on `/api/display/current`
- ✅ **Test 10:** Multi-tenant isolation ➔ Restaurant B pending payment is never received by Restaurant A display

---

## 📁 Repository Structure

```
Project-1/
├── package.json              # Monorepo root scripts & concurrently runner
├── README.md                 # Complete system documentation
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                  # Environment configuration
│   ├── prisma/
│   │   ├── schema.prisma     # Multi-tenant SQLite Prisma schema
│   │   └── dineflow.db       # SQLite database file
│   └── src/
│       ├── index.ts          # Express + Socket.IO server entrypoint
│       ├── prisma.ts         # Prisma client singleton
│       ├── seed.ts           # Demo restaurant & staff seeder
│       ├── test-e2e.ts       # 9-point automated acceptance test runner
│       ├── test-display-e2e.ts # 10-point Customer Display automated test runner
│       ├── middleware/
│       │   └── auth.ts       # JWT verification & RBAC tenant isolation
│       ├── services/
│       │   └── paymentProvider.ts # UPI QR & gateway webhook abstraction
│       ├── sockets/
│       │   └── index.ts      # Socket.IO room routing & event emitter
│       └── routes/
│           ├── auth.ts       # Registration & station login
│           ├── display.ts    # Customer display current pending payment
│           ├── menu.ts       # Categories & menu items
│           ├── tables.ts     # Tables & floor layout
│           ├── orders.ts     # KOT orders & item status lifecycle
│           ├── bills.ts      # POS calculation, UPI QR & settlement
│           ├── staff.ts      # Admin staff credential management
│           ├── settings.ts   # Restaurant profile & tax config
│           └── reports.ts    # Dashboard analytics & CSV export
└── client/
    ├── package.json
    ├── vite.config.ts        # Vite proxy for /api and /socket.io
    ├── tailwind.config.js    # Custom brand colors & dark mode
    ├── index.html            # PWA-ready HTML entrypoint
    ├── public/
    │   └── manifest.json     # PWA manifest
    └── src/
        ├── App.tsx           # Router & role-guarded routes
        ├── main.tsx          # React DOM entrypoint
        ├── index.css         # Styling & thermal receipt print styles
        ├── types/            # TypeScript interfaces
        ├── context/
        │   ├── AuthContext.tsx    # Multi-tenant auth state & persistent session
        │   └── SocketContext.tsx  # Real-time WebSocket listener & alerts
        ├── utils/
        │   └── audio.ts      # Native Web Audio API sound synthesizer
        ├── components/
        │   └── common/
        │       ├── Navbar.tsx     # Station header & copyable Restaurant ID
        │       ├── RoleRoute.tsx  # RBAC route guard
        │       └── ToastContainer.tsx # Live notifications
        └── pages/
            ├── auth/
            │   ├── Login.tsx              # Station login with demo shortcuts
            │   ├── RegisterRestaurant.tsx # Account creation & ID modal
            │   └── AdminLogin.tsx         # Dedicated owner login
            ├── waiter/
            │   └── WaiterView.tsx         # Mobile-first waiter PWA
            ├── kitchen/
            │   └── KitchenDisplay.tsx     # High-contrast dark mode KDS
            ├── billing/
            │   └── BillingView.tsx        # POS table grid, UPI QR & invoice
            ├── display/
            │   └── CustomerDisplay.tsx    # Mobile-first dynamic UPI QR display
            └── admin/
                └── AdminDashboard.tsx     # Metrics, menu, staff & reports
```
