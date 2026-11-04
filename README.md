# JB PARFUMS ERP

ERP web application for JB PARFUMS.

## Current phase

The ERP frontend is gated by Neon Auth: it does not render the dashboard or load application modules until the Worker validates an authenticated ERP profile. Browser-local DEMO modules remain clearly identified and are not a substitute for database-backed production workflows.

## Currency policy

- Operational/base currency: USD ($).
- Configurable reference rate for conversions: C$ 36.60 per US$ 1 by default.
- Browser-local DEMO records are isolated to the current browser and are not synchronized.
- Official invoicing and NIO conversion are not enabled yet. Payroll values are NIO-only.

## Architecture

- Frontend: static HTML, CSS and JavaScript, built into `dist/`.
- Frontend hosting: Cloudflare Pages project `erp-perfume`, production branch `main`.
- API: standalone Cloudflare Worker `jb-parfums-erp-api`, called from the frontend through its configured API base URL.
- Database: Neon PostgreSQL, `erp_perfume` on the `development` branch during validation.
- Identity: Neon Managed Auth; the production Pages origin is allowlisted, JWT verification and ERP role checks run in the Worker, and the frontend stays locked until a valid profile is returned.
- Branding: JB monogram favicon and a subtle JB PARFUMS watermark on invoice preview/print.
- Files: private Cloudflare R2 bucket `erp-perfume-assets`, bound to the Worker as `ERP_ASSETS`.
- CI/CD: GitHub Actions builds and deploys the Worker from `main`; Pages continues to publish the static frontend.
- Browser automation: Playwright with Chromium.
- Optional AI repair: disabled by default.

## Backend scope

The current feature branch adds these Worker API routes:
- `GET /api/config`, `GET /api/health`, and `GET /api/auth/profile` — configuration, health and identity.
- `GET /api/hr/employees` and `POST /api/hr/employees` — protected employee list and creation.
- `GET /api/erp/bootstrap` — initial products, suppliers, customers and Kardex data for the authorized user.
- `GET/POST/PATCH/DELETE /api/catalog/products` — product master with soft deactivation and history-aware deletion.
- `GET/POST /api/catalog/suppliers` and `GET/POST /api/catalog/customers` — protected business contacts.
- `POST /api/inventory/movements` — stock entry, exit and adjustment with locked stock update, Kardex record and audit event in one database statement.

The frontend in this branch now loads the product catalog, suppliers, customers and inventory from Neon Development. Product creation starts at zero stock; stock changes only through Kardex. Product and contact writes are parameterized, role-checked and audited. HR employee list/create remains connected and its section stays enabled.

Orders, purchase orders and receipts, supplier bills/payables, sales invoices/receivables, expenses, cash/bank balances, profitability/capital dashboards, and attendance/leave/payroll remain DEMO or unimplemented. The new Worker source has not been deployed: the active Worker is still deployed from `main`. Do not record real sales, purchases or financial transactions in those modules yet.

## Main and database workflow

- Feature work is prepared on an isolated Git branch and reviewed through a pull request before any merge to `main`.
- Cloudflare Pages production continues to publish `main`; a feature pull request may receive its own preview deployment.
- The API Worker initially connects only to Neon `development`.
- Neon `production` is not configured or used by this integration. A production database cutover requires a separate review and explicit authorization.
- Secrets are never committed to GitHub.

## Procurement and finance prototype

The feature branch `feature/erp-procurement-finance-catalog` introduces a browser-local DEMO flow for purchase orders, partial receipts, supplier bills, profitability and capital/ cash-flow views. Purchase orders do not post stock, cash or payables; receipt records post only the quantities physically received. Supplier invoices are recorded separately from inventory movements.

The branch also adds a commercial product description and a printable catalog limited to active products with stock. The catalog excludes internal costs and supplier information. Product master records always begin with zero stock; opening quantities must be posted through Kardex or a purchase-order receipt. Paid operating expenses require a matching cash/bank account and create one cash-outflow entry. Profitability allocates invoice discounts across product lines and includes delivery charges in total invoice revenue, while delivery is not assigned to a specific SKU. The print view can be saved as PDF; product photography, image/JPG export, Excel export and direct attachment sharing remain pending because product media and the associated file workflow are not yet integrated.

Migrations `0002_procurement_finance_extensions.sql` and `0003_catalog_metadata.sql` have been applied to Neon `development` only. They add purchase-order/receipt tables, historical invoice unit costs and catalog metadata. The corresponding catalog and inventory API code is being reviewed on this feature branch; it is not live until the Worker is deployed from an approved merge. Neon `production` is untouched. Purchase/finance screens remain DEMO until their own API persistence and end-to-end tests are complete.

## Build and tests

```sh
npm install
npm run build
npm test
```

See [Backend setup](docs/backend-setup.md) for the Worker deployment and secret configuration.

## Static production deployment

Cloudflare Pages publishes only the static `dist/` output from `main`. API routes are served by the standalone Worker at `https://jb-parfums-erp-api.jaredblancoh19.workers.dev`; no Pages Functions are used. A Pages deployment does not provision the Worker or copy database secrets. See [Backend setup](docs/backend-setup.md) for the one-time GitHub Actions token and Worker database secret requirements.
