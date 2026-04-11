# 360IMS — 360 Metal Roofing Supply

Full-stack internal inventory management and sales system for 360 Metal Roofing Supply (Austin, TX).
Replaces InFlow Inventory. Installable as a PWA on iPhone and Windows.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn-style components
- **PWA**: `vite-plugin-pwa` with service worker, offline fallback, iOS "Add to Home Screen"
- **Database**: Supabase (PostgreSQL, free tier) with Row Level Security on every table
- **Auth**: Supabase Auth (email/password), forced password change on first login
- **Email**: Resend API via Supabase Edge Function (from `orders@360metalroofingsupply.com`)
- **PDF**: `@react-pdf/renderer` for quotes, SOs, and POs
- **State**: Zustand for auth + company settings, React Hook Form where applicable
- **Backend API**: Supabase Edge Functions (Deno/TypeScript)
- **Hosting**: Vercel (frontend), Supabase (database + edge functions)

## Features

| Module | Capabilities |
| --- | --- |
| Auth | Email/password login, session persistence, password reset, forced change on first login |
| Dashboard | Today's sales, open quotes, unpaid A/R, low-stock alerts, recent activity, quick actions |
| Products | Full CRUD, SKU + category + UOM, CSV import/export, low-stock filter, detail with lot history |
| Inventory | FIFO lots, stock adjustments, valuation, stock levels report |
| Customers | Full CRUD (delete = admin only), assigned salesperson, detail with order history |
| Suppliers | Full CRUD, contact info, PO history, total spend |
| Purchase Orders | Draft → Sent → Partially Received → Received, receive workflow creates inventory lots |
| Sales Quotes | Draft → Sent → Accepted/Declined/Expired → Converted, PDF, email, convert to SO |
| Sales Orders | Draft → Confirmed → Invoiced → Fulfilled, payment status, FIFO fulfillment, commissions |
| Commissions | Auto-created on SO paid, period = month after payment, mark-paid workflow |
| Reports | Sales, commission, inventory, financial — all with Accrual/Cash toggle where applicable, CSV export, print |
| Settings | Company info, default rates, user management, permission overrides, email logs, integrations |
| Email System | Resend from `orders@360metalroofingsupply.com`, branded HTML, PDF attachments, full audit log |
| QBO Reconciliation | Supabase Edge Function returns fulfilled/invoiced SOs in a date range |

## Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── ui/          (Button, Input, Card, Modal, Badge, Table, Spinner)
│   │   ├── layout/      (Sidebar, TopNav, AppLayout)
│   │   ├── shared/      (ConfirmDelete, EmailModal, PageHeader, ProductPicker, ReportControls, SearchBar, RequireAuth)
│   ├── pages/
│   │   ├── auth/        (Login, ResetPassword, ChangePassword)
│   │   ├── products/    (list, form, detail, import)
│   │   ├── inventory/   (stock levels + adjustment modal)
│   │   ├── customers/   (list, form, detail)
│   │   ├── suppliers/   (list, form, detail)
│   │   ├── purchase-orders/
│   │   ├── quotes/
│   │   ├── sales-orders/
│   │   ├── reports/     (12 report pages)
│   │   ├── settings/    (company, users, email logs, integrations)
│   │   └── DashboardPage.jsx
│   ├── lib/             (supabase, resend, fifo, commission, pdf, permissions, format, csv, cn)
│   ├── hooks/           (usePermissions)
│   ├── store/           (auth, settings)
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   ├── migrations/001_initial.sql   (schema + RLS + FIFO/commission functions)
│   └── functions/
│       ├── qbo-reconcile/index.ts   (Edge Function for QBO comparison)
│       └── send-email/index.ts      (Edge Function that calls Resend)
├── public/              (offline.html, icons, favicon)
├── .env.example
├── vercel.json
└── vite.config.js
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...          # anon public key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...       # service role (server-side only)
RESEND_API_KEY=re_xxx                         # Resend API key (used in Edge Function only)
VITE_APP_NAME=360IMS
VITE_COMPANY_NAME=360 Metal Roofing Supply
VITE_DEFAULT_TAX_RATE=0.0825
```

## 1. Supabase Setup

1. **Create a Supabase project** at https://supabase.com (free tier is sufficient).
2. **Copy the project URL and anon key** from Settings → API into `.env.local`.
3. **Run the migration**: In the Supabase SQL editor, paste the contents of
   `supabase/migrations/001_initial.sql` and execute. This creates:
   - All 16 tables with proper foreign keys and indexes
   - Row Level Security policies for every table (role-based)
   - Helper functions: `is_admin()`, `is_admin_or_manager()`, `is_not_viewer()`, `current_user_role()`
   - `next_document_number()` — concurrent-safe year-scoped sequence (PO-YYYY-XXXX, SO-YYYY-XXXX, QT-YYYY-XXXX)
   - `fifo_fulfill_sales_order()` — atomic FIFO deduction from inventory lots
   - `receive_purchase_order_item()` — creates lots and updates PO status
   - `apply_stock_adjustment()` — manual stock adjustments with FIFO reduction
   - `create_commission_for_so()` — one-shot commission creation on SO paid
4. **Seed the first location**: Already inserted by the migration (`360MRS Austin`).
5. **Create the first admin user** (see section 5 below).

## 2. Resend + GoDaddy DNS Setup

### Resend account

1. Sign up at https://resend.com.
2. Add the domain `360metalroofingsupply.com`. Resend will give you **two DNS records**:
   - One **SPF TXT record** (include `resend.com` in your SPF)
   - One **DKIM TXT record** (name `resend._domainkey`)
3. Copy your API key from Resend dashboard.

### GoDaddy DNS records

Log in to GoDaddy → DNS Management for `360metalroofingsupply.com` → **Add Records**:

| Type | Name                  | Value (example — use what Resend shows you)                        |
| ---- | --------------------- | ------------------------------------------------------------------ |
| TXT  | `@` (or `send.`)     | `v=spf1 include:amazonses.com ~all` (Resend's SPF include)         |
| TXT  | `resend._domainkey`   | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...` (full DKIM public key)   |

Optionally add a DMARC record:

| Type | Name     | Value                                                 |
| ---- | -------- | ----------------------------------------------------- |
| TXT  | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:admin@...`        |

DNS propagation takes 5–30 minutes. Verify in Resend dashboard.

### Configure Edge Function secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set RESEND_FROM_ADDRESS=orders@360metalroofingsupply.com
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOi...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

## 3. Deploy Edge Functions

From the project root:

```bash
supabase functions deploy qbo-reconcile
supabase functions deploy send-email
```

## 4. Vercel Deployment

1. Connect this repo to Vercel.
2. Set the environment variables (from `.env.example`) in Vercel's dashboard.
3. Vercel auto-detects Vite. `vercel.json` handles SPA rewrites and SW headers.
4. Deploy. The PWA will be installable on Safari (iOS) via "Add to Home Screen" after 3 visits,
   and on Edge/Chrome (Windows) via the browser's install button.

Local dev:

```bash
npm install
npm run dev
```

## 5. Create the First Admin User

Since the first user can't be invited from within the app, create them directly:

1. In the **Supabase Dashboard → Authentication → Users**, click "Add user" and create
   an account with email + password.
2. Copy the new user's UUID.
3. Run this SQL in Supabase SQL editor (replace UUID + name):

```sql
insert into public.users (id, full_name, email, role, commission_rate, is_active, must_change_password)
values (
  'paste-uuid-here',
  'Bryan Wiest',
  'bryan@360metalroofingsupply.com',
  'admin',
  0.1000,
  true,
  false
);
```

4. Sign in at `/login`. You now have full admin access and can invite the other 4 users from
   Settings → Users.

## 6. How Claude Code Calls `/qbo-reconcile`

The QBO reconciliation endpoint returns all fulfilled/invoiced sales orders for a date range so
the data can be compared to QuickBooks Online invoices. It is **not** called from the app UI —
it is intended for Claude Code to invoke from a separate terminal session.

**Endpoint**: `POST $SUPABASE_URL/functions/v1/qbo-reconcile`
**Auth**: `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY`
**Body**: `{ "start_date": "2026-04-01", "end_date": "2026-04-30" }`

### Example call

```bash
curl -X POST \
  "$SUPABASE_URL/functions/v1/qbo-reconcile" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2026-04-01","end_date":"2026-04-30"}'
```

### Response

```json
{
  "start_date": "2026-04-01",
  "end_date": "2026-04-30",
  "count": 12,
  "total_value": 48250.33,
  "orders": [
    {
      "so_number": "SO-2026-0001",
      "customer_name": "Lone Star Roofing",
      "customer_email": "contact@lonestar.com",
      "invoice_date": "2026-04-02",
      "subtotal": 3800.00,
      "freight_charge": 150.00,
      "sales_tax_amount": 313.50,
      "credit_card_fee_amount": 0.00,
      "total": 4263.50,
      "payment_status": "paid",
      "status": "fulfilled",
      "salesperson_name": "Bryan Wiest",
      "salesperson_email": "bryan@360metalroofingsupply.com"
    }
  ]
}
```

### What to compare against QBO

When Claude Code compares 360IMS data to QuickBooks Online:

1. Match each 360IMS `so_number` to the QBO invoice (QBO invoice number should equal `so_number`).
2. Verify `total` matches.
3. Verify `invoice_date` matches.
4. Flag any 360IMS invoice that is missing in QBO (and vice versa).
5. Flag any amount mismatches greater than $0.01.

## Role Permissions Matrix

Defaults (admin can override per user in Settings → Users):

| Action                          | admin | manager | salesperson | viewer |
|---------------------------------|-------|---------|-------------|--------|
| View all records                | ✔    | ✔      | ✔          | ✔     |
| Create/edit customers/suppliers | ✔    | ✔      | ✔          |        |
| Delete customers/suppliers      | ✔    |         |             |        |
| Create/edit quotes/SOs/POs      | ✔    | ✔      | ✔ (own)    |        |
| Delete quotes/SOs/POs           | ✔    |         |             |        |
| Send documents via email        | ✔    | ✔      | ✔          |        |
| Convert quote ↔ SO              | ✔    | ✔      | ✔          |        |
| Mark SO fulfilled / paid        | ✔    | ✔      | ✔          |        |
| Manage products / inventory     | ✔    | ✔      |             |        |
| View own commission             | ✔    | ✔      | ✔          |        |
| View all commissions            | ✔    | ✔      |             |        |
| Mark commission as paid         | ✔    |         |             |        |
| View profit/margin reports      | ✔    | ✔      |             |        |
| Manage users + settings         | ✔    |         |             |        |

RLS policies in `001_initial.sql` enforce these at the database level; the UI mirrors them via
`src/lib/permissions.js` + `src/hooks/usePermissions.js`.

## FIFO Inventory Logic

- Every received PO line creates a `inventory_lots` row with `quantity_received`, `quantity_remaining`, and `unit_cost`.
- When a Sales Order is marked **Fulfilled**, the server-side function `fifo_fulfill_sales_order()` consumes lots in order of `received_date ASC, created_at ASC`, reducing `quantity_remaining` and writing the blended cost into `sales_order_items.fifo_cost`.
- Lots are **never deleted** — only `quantity_remaining` is reduced. This preserves the full cost history.
- Manual stock adjustments use `apply_stock_adjustment()` which creates a new lot (positive delta) or consumes lots FIFO (negative delta).
- Freight on POs is recorded separately and does **not** affect per-unit FIFO cost. Edit the product's default cost manually if you need landed costs (e.g. overseas shipments).

## Commission Logic

- Commissions are created **only when a Sales Order is marked paid** (prevents double-creation via a unique constraint on `sales_order_id`).
- Formula:
  - `COGS = SUM(quantity * fifo_cost)` across all SO line items
  - `net_profit = subtotal − COGS − freight_charge − sales_tax_amount − credit_card_fee_amount`
  - `commission_amount = net_profit × salesperson.commission_rate`
- `commission_period` = first day of the month **after** `payment_date`, formatted `YYYY-MM`.
- Mark-paid flow is in Sales Order detail → "Mark Paid" button.

## PWA Installation

- **iPhone (Safari)**: Visit the deployed app, tap Share → "Add to Home Screen". After 3 visits, a standard browser prompt appears automatically.
- **Windows (Edge/Chrome)**: Click the install icon in the address bar.
- The PWA caches the app shell and uses network-first for Supabase API calls. An offline fallback page is shown when there is no connection.

## Notes & Conventions

- All monetary values are stored as `numeric(12,2)` or `numeric(12,4)` — never float.
- Document numbers (QT, SO, PO) are generated by a server-side atomic function; no client-side UUIDs used.
- Delete operations always require confirmation via modal (`ConfirmDelete`).
- All dates on records are `date`; timestamps use `timestamptz`.
- Activity log (`activity_log` table) records user actions for the dashboard "Recent Activity" widget.
- Empty states exist on every list page with a call-to-action to create the first record.
- Loading spinners + toasts on every async operation.

## License

Internal use only — 360 Metal Roofing Supply.
