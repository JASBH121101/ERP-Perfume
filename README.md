# JB PARFUMS ERP

ERP web application for JB PARFUMS.

## Current status

The application is authenticated through Neon Auth. The frontend remains locked until the Cloudflare Worker validates the session and resolves an ERP profile and role.

The Development API uses Neon `development`. Neon `production` has now received the clean application migration chain `0001`–`0023` and its schema matches Development. Neither branch has real commercial records loaded. Production cutover is still gated on the separate Production Worker secret, initial owner sign-up/verification, live API checks and Pages promotion. See [Production cutover](docs/production-cutover.md).

## Connected operational modules

The current UI, Worker API and database schema include:

- **Products and catalog:** product records, SKU/barcode, category, pricing, purchase cost, additional cost, calculated unit cost, minimum stock, activation state and private product images.
- **Inventory:** initial stock, manual entries, exits and adjustments, stock validation, movement history (kardex), stock changes from order/invoice flows and audit events.
- **Commercial:** customers, orders, order items, invoices, invoice items and invoice payments.
- **Procurement:** suppliers, database-generated purchase-order codes, multi-line orders, approval transitions, partial/full receipts, landed-cost updates, kardex movements, supplier invoices and payable payments.
- **Finance:** expenses, cash/bank accounts, cash entries, accounts receivable/payable views and financial summaries.
- **HR:** employees, attendance, leave requests, payroll periods and payroll items.
- **DGI support:** configurable compliance reference data, support-document metadata and private file storage.

These are database-backed workflows, not browser-local DEMO datasets. However, they still require end-to-end runtime verification and operational testing before real business use.

## Known scope boundaries

- Purchase orders use a PostgreSQL sequence and a unique constraint to assign non-repeating `JB-OC-YYYY-NNNNNN` codes. Creating an order does not affect stock or cash; only physical receipts change inventory.
- Invoice preview/print is an **internal, non-fiscal document**. The DGI support module archives evidence and displays reference indicators; it does not certify or authorize fiscal electronic invoicing.
- Payroll amounts are maintained in NIO. Commercial currency conversion supports USD and NIO using the configured exchange rate; historical operations retain their recorded rate.
- Product images and DGI support files are stored in the private Cloudflare R2 bucket through the Worker. They are not public bucket assets.
- Optional AI repair is disabled by default.

## Currency policy

- Reporting/base currency: USD ($).
- Configurable reference rate: C$ 36.60 per US$ 1 by default; the owner can update it in Settings.
- Sales, purchases, payments and cash entries can retain their original currency (USD or NIO) and the exchange rate used.
- Payroll is NIO-only.
- Generated invoice previews are marked **COMPROBANTE INTERNO · NO FISCAL**. Do not use them as DGI-authorized fiscal invoices.

## Architecture

- **Frontend:** static HTML, CSS and JavaScript, bundled with esbuild into `dist/`.
- **Hosting:** Cloudflare Pages project `erp-perfume`, publishing from GitHub `main`.
- **API:** separate Cloudflare Workers: `jb-parfums-erp-api` for Development and `jb-parfums-erp-api-production` for the isolated Production target; both use the same source bundle.
- **Database:** Neon PostgreSQL database `erp_perfume`, with independent `development` and `production` branches. Production schema and migrations are installed; its Worker still requires the Production-only `DATABASE_URL` secret and public endpoint enablement before cutover.
- **Identity:** Neon Managed Auth. The Worker validates JWTs, verified email, account status and ERP roles.
- **Files:** private Cloudflare R2 bucket `erp-perfume-assets`, bound to the Worker as `ERP_ASSETS`.
- **CI/CD:** GitHub Actions runs the ERP quality gate, JB Expert QA and Worker deployment workflow. Pages publishes the static frontend from `main`.
- **Browser automation:** Playwright with Chromium.
- **Database migrations:** SQL migrations in `db/migrations/`; migrations are not automatically executed by deployment.

## Main and database workflow

- The repository is maintained directly on `main`, as the single integration branch.
- Cloudflare Pages production deploys from `main`.
- The standalone API Worker is deployed independently from `worker/`.
- The Development Worker remains pinned to Neon `development`; it must never be repointed to Production.
- Neon `production` has the canonical `0001`–`0023` schema and a least-privilege `jb_erp_runtime_sql` role. The dedicated Production Worker is isolated but not yet public: install its Production `DATABASE_URL` secret and complete health/authentication tests before promoting Pages.
- First-time Production owner access uses the configured owner email with Neon Auth OTP verification; the Worker then provisions the ERP owner profile. Development sessions and passwords are not copied between branches.
- Secrets are never committed to GitHub or copied into documentation.

## Build and tests

```sh
npm install
npm run build
npm run test:unit
npm test
```

The GitHub Actions workflows run static checks, unit tests, browser tests and the separate JB Expert QA source/visual audit. A green source/visual QA run does not replace database-backed end-to-end testing against the live Worker.

See [Backend setup](docs/backend-setup.md) for runtime architecture and [Production cutover](docs/production-cutover.md) for the current release gate and required final checks.
