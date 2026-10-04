# DineFlow 🍽️
### Enterprise Multi-Tenant Restaurant Management, Waiter PWA, Kitchen Display & Billing POS
#### Unified Single-Project Full-Stack Application for Vercel Serverless & React + Vite

DineFlow is a modern, unified, full-stack multi-tenant restaurant management web platform engineered to deploy as **ONE single project on Vercel**. It combines a high-performance **React 18 + Vite** frontend with an **Express Serverless API** backend, **Prisma ORM with PostgreSQL**, and a resilient **Real-time Provider (Pusher Channels with automatic 3s HTTP polling fallback)**.

Built specifically for Indian restaurant operations, DineFlow supports **INR (₹) currency**, **GST tax calculations (CGST/SGST)**, and **dynamic NPCI UPI QR payments**.

---

## ⚡ Quick Start (One Command for Local Development)

### 1. Prerequisites
- **Node.js** (v18 or higher recommended; Node 20+ tested)
- **npm** (v9 or higher)

### 2. Setup & Launch
From the repository root:

```bash
# 1. Install dependencies and generate Prisma client
npm install

# 2. Run the unified development server (starts API on :5000 and Vite on :5173 with proxy)
npm run dev
```

The application will be live at:
- **Web Application:** [http://localhost:5173](http://localhost:5173)
- **API Server & Healthcheck:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🔑 Demo Restaurant Credentials (Pre-Seeded)

DineFlow includes a pre-configured demo restaurant **"Spice Route Bistro & Bar"** with 10 tables, 5 menu categories, and 17 signature dishes.

| Module | Login URL | Restaurant ID (Code) | User ID / Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Portal** | `/admin-login` (or `/login`) | `RST-10101` | `admin@spiceroute.com` | `admin123` | Owner dashboard & settings |
| **Billing Cashier** | `/login` | `RST-10101` | `Root` | `password123` | Counter POS & thermal printing |
| **Customer Display** | `/login` | `RST-10101` | `Display1` | `password123` | Linked to counter `Root` |
| **Floor Waiter** | `/login` | `RST-10101` | `waiter1` | `password123` | Mobile ordering PWA |
| **Kitchen KDS** | `/login` | `RST-10101` | `kitchen1` | `password123` | Dark mode kitchen tickets |

> 💡 **Tip:** On the `/login` page, you can click any of the **Demo Autofill Pills** to sign in to any station with a single click.

---

## 🏗️ Architecture: Unified Single-Project

DineFlow was restructured from separate frontend/backend folders into a single unified repository:

- **Root `package.json`**: Single dependency tree, single `node_modules`, unified build script (`prisma generate && vite build`).
- **Frontend (`/src`)**: React 18 SPA built with Vite to `/dist`. All API calls use relative paths (`/api/...`) through Vite's local proxy in development and Vercel routing in production.
- **Backend (`/api`)**: Express application exported as a stateless serverless handler (`/api/index.ts`) for Vercel Serverless Functions. Reuses all existing business logic, JWT authentication, and role checks.
- **Shared Code (`/lib`)**: Centralized Prisma singleton (`lib/prisma.ts`), NPCI UPI builder (`lib/upi.ts`), Zod schemas (`lib/schemas.ts`), status constants (`lib/constants.ts`), and Realtime Provider (`lib/realtime/`).
- **PostgreSQL Database (`/prisma`)**: Prisma configured for PostgreSQL (`DATABASE_URL` for runtime pooled connections, `DIRECT_URL` for direct migration connections). Includes pre-generated migration SQL in `prisma/migrations/0_init/migration.sql`.
- **Stateless Serverless Compatibility**:
  - **No WebSockets**: Socket.IO is replaced by a pluggable `RealtimeProvider` interface supporting hosted Pusher Channels with private channel security (`/api/realtime/auth`) and an automatic 3-second polling fallback (`/api/realtime/poll`).
  - **Zero Disk Writes**: No local filesystem dependencies; menu items and bills are safely persisted in PostgreSQL.
  - **Lazy Payment Expiry + Vercel Cron**: Abandoned payment sessions expire lazily on read (15 minutes) and are automatically purged every 5 minutes by a scheduled Vercel Cron job (`/api/cron/cleanup-payments`).

---

## 🚀 Step-by-Step Vercel Deployment Guide

Deploying DineFlow to Vercel takes less than 5 minutes as a single unified project:

### Step 1: Push to GitHub
Commit your repository and push it to your GitHub account:
```bash
git add .
git commit -m "Restructure into unified single project for Vercel"
git push origin main
```

### Step 2: Create a PostgreSQL Database
Create a hosted PostgreSQL database on **[Neon](https://neon.tech)**, **[Supabase](https://supabase.com)**, or **[Vercel Postgres](https://vercel.com/storage/postgres)**.

Obtain two connection strings:
1. **Pooled Connection String (`DATABASE_URL`)**: Includes PgBouncer / connection pooling (e.g. `postgresql://...neondb?sslmode=require&pgbouncer=true`).
2. **Direct Connection String (`DIRECT_URL`)**: Unpooled direct connection used by Prisma Migrate (e.g. `postgresql://...neondb?sslmode=require`).

### Step 3: Create a Free Pusher Channels App
1. Go to **[Pusher Channels](https://dashboard.pusher.com/)** and sign up for a free account.
2. Click **Create App**, give it a name (e.g. `dineflow-prod`), and select your closest cluster (e.g. `ap2` for India / Mumbai, `us2`, or `eu`).
3. Under **App Keys**, copy the following values:
   - `app_id`
   - `key`
   - `secret`
   - `cluster`

*(Note: If you do not configure Pusher keys, DineFlow will automatically operate using its built-in 3-second HTTP polling fallback).*

### Step 4: Import into Vercel
1. Log in to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... ➔ Project**.
2. Select your GitHub repository.
3. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./` (leave default repository root)
   - **Build Command:** `prisma generate && vite build` (configured automatically via `vercel.json`)
   - **Output Directory:** `dist`

### Step 5: Add Environment Variables in Vercel
In the Vercel project creation screen (or under **Project Settings ➔ Environment Variables**), add:

| Variable Name | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Pooled Postgres connection URL | `postgresql://user:pass@ep-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Direct unpooled Postgres URL | `postgresql://user:pass@ep.region.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secure random string for JWT auth | Any 32+ character random string |
| `CRON_SECRET` | Secret token to secure Vercel Cron | Any random string |
| `PUSHER_APP_ID` | Pusher App ID (Backend) | e.g. `1938210` |
| `PUSHER_KEY` | Pusher App Key (Backend) | e.g. `98a7sd6f5g4h3j2k1` |
| `PUSHER_SECRET` | Pusher Secret (Backend) | e.g. `1a2b3c4d5e6f7g8h9` |
| `PUSHER_CLUSTER` | Pusher Cluster (Backend) | e.g. `ap2` |
| `VITE_PUSHER_KEY` | Pusher App Key (Frontend) | *Must match PUSHER_KEY* |
| `VITE_PUSHER_CLUSTER` | Pusher Cluster (Frontend) | *Must match PUSHER_CLUSTER* |

### Step 6: Run Database Migrations & Seed
Run Prisma migrations and the seed script against your hosted database:

```bash
# Set your production database URL locally
export DATABASE_URL="your-production-database-url"
export DIRECT_URL="your-production-direct-url"

# Run PostgreSQL migration
npx prisma migrate deploy

# Seed demo restaurant & staff data
npm run seed
```

### Step 7: Deploy and Verify
Click **Deploy** in Vercel. Once completed:
1. Open the deployment URL.
2. Sign in as Admin (`admin@spiceroute.com` / `admin123` with Code `RST-10101`).
3. Test billing, waiter PWA, and customer display across browser tabs or mobile devices!

---

## 📋 Vercel Dashboard Manual Configuration Checklist

Before going live in production, verify these items in your Vercel Dashboard:

- [ ] **Root Directory is `./`**: Ensure Root Directory in **Settings ➔ General** is empty or set to `./` (do not set to `client` or `server`).
- [ ] **Build & Output Settings**:
  - Build Command: `prisma generate && vite build` (or leave override to default; `vercel.json` supplies it).
  - Output Directory: `dist`.
- [ ] **Environment Variables**:
  - `DATABASE_URL` and `DIRECT_URL` are added to **Production**, **Preview**, and **Development**.
  - `VITE_PUSHER_KEY` and `VITE_PUSHER_CLUSTER` are set (prefixed with `VITE_` so Vite bundles them into client code).
  - `CRON_SECRET` is configured.
- [ ] **Vercel Crons Enabled**:
  - In **Settings ➔ Crons**, verify `/api/cron/cleanup-payments` is listed with the schedule `*/5 * * * *`.
- [ ] **Post-deployment Verification**:
  - Visit `/api/health` ➔ should return `{ "status": "ok", "service": "DineFlow Serverless API" }`.
  - Visit `/billing` or `/display` directly and press browser Refresh ➔ should load the React route without a 404 error.

---

## 🛠️ Troubleshooting Common Errors

### 1. Prisma Client Not Generated on Vercel
- **Symptom:** Runtime error `@prisma/client did not initialize yet. Please run "prisma generate"`.
- **Fix:** In `package.json`, `"postinstall": "prisma generate"` and `"build": "prisma generate && vite build"` are configured. This guarantees Prisma Client generates before Vite builds and whenever Vercel installs dependencies.

### 2. 404 Error on Page Refresh for Deep Links (`/billing`, `/waiter`, etc.)
- **Symptom:** Navigating works via client-side clicks, but pressing browser refresh on `/billing` or `/display` shows `404 NOT_FOUND`.
- **Fix:** Handled in `vercel.json` via SPA rewrites:
  ```json
  {
    "source": "/((?!api/).*)",
    "destination": "/index.html"
  }
  ```
  All non-API paths are rewritten to `index.html` so React Router can handle client-side routing.

### 3. CORS or 401 Unauthorized Errors
- **Symptom:** Browser console shows `CORS header missing` or `401 Unauthorized` calling backend endpoints.
- **Fix:** Frontend code calls the API using relative paths only (e.g. `fetch('/api/auth/login')`). Since the frontend and backend share the exact same domain on Vercel, CORS is completely bypassed and same-origin cookies/tokens are transmitted securely.

### 4. Real-time Events Not Connecting
- **Symptom:** Status badge shows "Reconnecting..." or order changes don't broadcast instantly.
- **Fix:**
  - Verify that `PUSHER_KEY` and `VITE_PUSHER_KEY` match in your Vercel Environment Variables.
  - Verify that `PUSHER_CLUSTER` and `VITE_PUSHER_CLUSTER` match.
  - **Graceful Fallback:** If Pusher credentials are not provided or the network blocks WebSockets, DineFlow automatically falls back to an HTTP polling loop every 3 seconds (`/api/realtime/poll`), ensuring orders and payments always update reliably.

---

## 🧪 Acceptance Test Suite (63 Automated Tests)

Run the full end-to-end acceptance test suite locally:

```bash
npm test
```

This executes both test suites against a live local server instance:
1. **Core Restaurant & Order Lifecycle Tests (`test-e2e.ts` - 35 Tests)**:
   - Account creation & unique Restaurant ID generation (`RST-XXXXX`)
   - Staff creation (`Root`, `waiter1`, `kitchen1`) & compound unique constraints
   - Role-based route redirection & RBAC route guards
   - Multi-tenant data isolation (tables, orders, menu)
   - Waiter-to-Kitchen order flow (`Pending` ➔ `Preparing` ➔ `Ready` ➔ `Served`)
   - Bill calculation, discounts, NPCI-compliant UPI QR URI generation
   - Payment settlement & automatic table clearance
   - Admin metrics & CSV report export
2. **Customer Display Software Test Suite (`test-display-e2e.ts` - 28 Tests)**:
   - Display pairing with cashier (`Display1` paired to `Root`)
   - Display login and initial `IDLE` state
   - Real-time `payment:initiated` event with matching bill & UPI URI
   - Live discount update via `payment:updated` without page refresh
   - Cashier cancellation via `payment:cancelled` resetting display to `IDLE`
   - Payment confirmation via `payment:confirmed` triggering celebration screen
   - Channel security & tenant authorization check (`/api/realtime/auth` rejects cross-tenant subscriptions with `403 Forbidden`)
   - Vercel Cron payment cleanup endpoint (`/api/cron/cleanup-payments`)

---

## 📁 Repository File Tree

```
Project-1/
├── package.json              # Unified monorepo package.json & scripts
├── vercel.json               # Vercel Serverless rewrites, SPA routing & crons
├── vite.config.ts            # Vite config with /api dev proxy
├── tsconfig.json             # Root TypeScript configuration
├── tailwind.config.js        # Brand color tokens & print styles
├── postcss.config.js         # PostCSS plugins
├── index.html                # PWA entrypoint
├── .env.example              # Documented environment variables template
├── README.md                 # Complete system documentation
├── api/                      # Vercel Serverless Functions (Backend)
│   ├── index.ts              # Express app exported as serverless handler
│   ├── middleware/
│   │   └── auth.ts           # JWT authentication & role-based access control
│   └── routes/
│       ├── auth.ts           # Admin register, admin login, staff login, session
│       ├── staff.ts          # Staff CRUD & password reset
│       ├── menu.ts           # Categories & menu items CRUD
│       ├── tables.ts         # Dining tables & running orders
│       ├── orders.ts         # Orders, KOT batches, and item status transitions
│       ├── bills.ts          # Bill generation, UPI QR, settlements & discounts
│       ├── display.ts        # GET /api/display/current with lazy auto-expiry
│       ├── realtime.ts       # /api/realtime/auth & /api/realtime/poll fallback
│       ├── cron.ts           # /api/cron/cleanup-payments for Vercel Cron
│       ├── settings.ts       # Restaurant profile, tax rates & display settings
│       └── reports.ts        # Dashboard metrics & CSV report download
├── lib/                      # Shared Code (used by Frontend and Backend)
│   ├── prisma.ts             # Singleton Prisma Client with connection pooling
│   ├── types.ts              # Role, status, order, bill and auth types
│   ├── constants.ts          # Default values, status enums & roles
│   ├── schemas.ts            # Zod validation schemas
│   ├── upi.ts                # NPCI-compliant UPI deep-link URI builder
│   └── realtime/
│       ├── types.ts          # Realtime event definitions & payloads
│       └── server.ts         # RealtimeServer (Pusher + polling buffer)
├── prisma/
│   ├── schema.prisma         # Multi-tenant PostgreSQL schema
│   ├── seed.ts               # Demo restaurant seed script
│   └── migrations/
│       └── 0_init/
│           └── migration.sql # Complete PostgreSQL DDL
├── public/
│   ├── favicon.svg           # Brand favicon
│   └── manifest.json         # PWA web manifest
├── src/                      # Frontend Application (React 18 + Vite)
│   ├── main.tsx              # React entrypoint
│   ├── App.tsx               # Route declarations & role guards
│   ├── index.css             # Tailwind CSS & thermal receipt print styles
│   ├── context/
│   │   ├── AuthContext.tsx   # Auth state & user session
│   │   └── SocketContext.tsx # Realtime client (Pusher + 3s polling fallback)
│   ├── pages/
│   │   ├── admin/            # Owner Dashboard, Menu, Tables, Staff, Settings
│   │   ├── billing/          # Cashier POS, Bill Calculation & Thermal Print
│   │   ├── display/          # Customer-facing dynamic UPI QR Display
│   │   ├── kitchen/          # Kitchen Display System (KDS)
│   │   ├── waiter/           # Mobile Waiter PWA
│   │   └── auth/             # Login & Registration screens
│   ├── components/           # Navbar, ToastContainer, RoleRoute, etc.
│   └── utils/
│       └── audio.ts          # Web Audio API alert chime generator
└── test/
    ├── run-all-tests.ts      # Acceptance test runner
    ├── test-e2e.ts           # 35-point core restaurant test suite
    └── test-display-e2e.ts   # 28-point Customer Display test suite
```

---

## 📜 License
MIT License. Built for modern restaurant operations across India.
