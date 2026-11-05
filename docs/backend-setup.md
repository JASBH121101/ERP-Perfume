# Backend setup — Neon Development

This repository uses `main` as its single integration branch. Cloudflare Pages publishes the static ERP interface; a separate Cloudflare Worker handles authenticated API requests. Pages Functions are intentionally not used.

## Current architecture

- Frontend: static HTML/CSS/JavaScript, bundled with esbuild into `dist/`.
- Hosting: Cloudflare Pages project `erp-perfume`, connected to GitHub `main`.
- API: Cloudflare Worker `jb-parfums-erp-api`, source in `worker/src/index.js` and `worker/src/erp.js`.
- Worker configuration used by the controlled Development deployment: root `wrangler.toml`.
- Database: Neon PostgreSQL database `erp_perfume`; the deployed Worker is configured to use the Neon `development` branch.
- Identity: Neon Managed Auth; the Worker verifies signed JWTs, verified email, account status and ERP role.
- Files: private Cloudflare R2 bucket `erp-perfume-assets`, bound to the Worker as `ERP_ASSETS`.
- Frontend API origin: `https://jb-parfums-erp-api.jaredblancoh19.workers.dev`.

The current UI and Worker have database-backed workflows for the catalog, stock movements, customers, suppliers, orders, purchases, invoices, payments, cash, expenses, HR and DGI support documents. The database-backed workflows are implemented in code; operational data still requires live end-to-end verification before production business use.

## Connected modules and current limitations

The authenticated frontend loads operational records through `GET /api/erp/bootstrap`. The Worker applies role-based filtering and reads the datasets in a Neon transaction.

Connected data areas include:

- Products, product images, initial stock, catalog import and inventory movements.
- Customers, orders, order items and order-state changes.
- Suppliers, purchases, purchase items and supplier payments.
- Invoices, invoice lines, customer payments, cash accounts and cash entries.
- Expenses, HR employees, attendance, leave requests and payroll.
- DGI support-document metadata and secure file upload/download.

Important boundaries:

- The dedicated multi-line purchase-order workflow is now present in the UI and Worker API. It includes order creation, status/approval transitions, partial or complete goods receipt, stock/cost updates, kardex movements and audit records. Supplier invoices and their payment ledger are also present. The critical paths have newly added service-level unit coverage, but live authenticated end-to-end tests against Neon Development are still required before real purchasing.
- Invoice preview/print is an internal non-fiscal document. DGI support-document storage and reference indicators are not a fiscal authorization or electronic invoicing integration.
- Payroll values are stored in NIO. USD/NIO conversion is available for commercial and cash/payment operations using a saved exchange rate.
- Product and DGI files are stored privately in R2 and are accessed through authenticated Worker endpoints.
- Do not enter live business transactions until the live Worker health/authentication path and the critical workflows have been tested end to end.

## GitHub Actions and Worker deployment

The GitHub workflows have separate responsibilities:

- `.github/workflows/ui-checks.yml` builds the frontend, checks Worker syntax, runs unit tests and Playwright browser tests.
- `.github/workflows/jb-expert-qa.yml` runs the source, completeness, interaction and responsive visual audit.
- `.github/workflows/deploy-worker.yml` currently validates the Development Worker source, build and unit tests. It does **not** upload or deploy the Worker.
- `.github/workflows/wrangler-pages-deploy.yml` publishes a controlled Pages Preview from the `.deployment/pages-preview` marker or manual dispatch. Production is a separate explicit workflow choice.

The last verified Pages Preview deployment is on branch `wrangler-preview` and has the alias `https://wrangler-preview.erp-perfume.pages.dev`. The active Worker is `jb-parfums-erp-api`; its current runtime variables report `ERP_ENVIRONMENT=development`, and its configured CORS origins include the Pages production domain and the Preview alias.

Worker uploads are a separate, controlled operation. Do not assume that a green Worker validation job means the Worker was deployed. Do not create or request a second Cloudflare token merely to run validation. Before any Worker upload, confirm the intended source revision, environment bindings and Development-only target; verify the new active version after upload.

## Worker database secret

The deployed Worker currently exposes a `DATABASE_URL` binding of type `secret_text`. Cloudflare does not return the secret value when settings are inspected, so its existence is confirmed but its exact database target cannot be proven from the binding metadata alone.

Expected secret target:

- Neon project: `erp-perfume`
- Database: `erp_perfume`
- Branch: `development`
- Runtime role: `jb_erp_runtime_sql`

The Worker also has the Neon Auth base URL and JWKS URL configured for the Development Auth endpoint, `ERP_ENVIRONMENT=development`, the configured owner bootstrap email and the private R2 bucket binding.

Before real business transactions, verify the live Worker endpoint:

```sh
curl --fail --show-error https://jb-parfums-erp-api.jaredblancoh19.workers.dev/api/health
```

Expected health response: `ok=true`, with `services.database=true`, `services.authentication=true`, `services.storage=true`, and `environment=development`. The `environment` flag alone is not proof that the hidden `DATABASE_URL` points to the Development branch. Do not use real data until the health response and a test authenticated profile confirm the actual runtime path.

Never expose or commit the database connection string or password.

## Neon Auth security checklist

On the Neon `development` branch:

- Enable email verification for new accounts.
- Add `https://erp-perfume.pages.dev` to Neon Auth trusted origins/domains.
- Verify the owner account's email before accessing protected ERP records.
- Keep newly registered non-owner accounts at the default `viewer` role until an administrator assigns a permitted role.
- Review role permissions in `worker/src/erp.js`; the Worker enforces permissions server-side.

The Worker resolves the Neon Auth user and ERP profile before allowing `/api/erp/*` operations. The frontend remains locked until a valid ERP profile is returned.

## API surface

Public/configuration endpoints:

- `GET /api/config` — authentication configuration for the frontend.
- `GET /api/health` — checks database connectivity and reports auth/storage binding readiness.
- `GET /api/auth/profile` — validates the session and returns the ERP profile.
- `GET /api/hr/employees` and `POST /api/hr/employees` — protected employee list/create endpoints retained for HR compatibility.

Authenticated operational API:

- `GET /api/erp/bootstrap` — role-filtered initial datasets.
- `GET /api/erp/settings` and `PATCH /api/erp/settings` — permitted system settings.
- `GET /api/erp/{resource}` — list a permitted resource.
- `POST /api/erp/{resource}`, `PATCH /api/erp/{resource}/{id}`, and `DELETE /api/erp/{resource}/{id}` — resource operations where explicitly allowed by the Worker.
- Dedicated transaction routes include product import, product asset upload/download/delete, inventory movements, order creation/status changes, purchase creation/payments, invoice creation/payments, cash account/entry creation, payroll status/payment operations, leave reviews, expenses and DGI support-document uploads/downloads.

Not every resource supports generic update or delete. Financial, payroll and inventory history is intentionally protected from generic mutation; use the specific transaction flows. See `worker/src/erp.js` for the authoritative route and role rules.

## Database migrations

SQL migration sources `0001` through `0010` are now present in `db/migrations/` on `main`. The Neon Development registry was verified read-only and contains versions `0001` through `0010`.

The historical source files for `0008` and `0009` had never been committed to GitHub. They have been restored as **schema-equivalent, idempotent reconstructions** from the live Development catalog, not as byte-for-byte copies of the original scripts. Their original recorded checksums are retained as audit evidence in `docs/migration-history-reconciliation.md`. The recovered DDL was re-validated idempotently against Development; no business data was inserted and the migration registry was not rewritten.

Do not replay versions already registered on a branch. Migrations are not automatically executed by GitHub Actions, Pages or Worker deployments. Do not apply migrations to Neon Production until the owner explicitly approves a reviewed cutover and backup plan.

## Validation

Run locally:

```sh
npm install
npm run build
npm run test:unit
npm test
```

GitHub Actions also runs the deterministic JB Expert QA source/visual audit. This is a separate check from the ERP quality gate. Passing source analysis or browser tests does not, by itself, prove the live Neon connection, account permissions, R2 operations or every business transaction works end to end.

Before using real records, verify the live Worker `/api/health`, sign in using the owner account, check `/api/auth/profile`, then smoke-test product creation, initial stock, stock entry/exit, image upload, purchase, order, invoice and payment flows on Development.

## Environment boundary and operational safeguards

- The deployed Worker is configured with `ERP_ENVIRONMENT=development` and a Neon Development connection.
- Neon Production currently has no application tables in its `public` schema and is not the runtime target.
- Do not change the Worker connection to Production or apply Production migrations without explicit owner approval.
- The R2 bucket is private; only the Worker receives its bucket binding.
- No application migrations run automatically during deployment.
- Optional AI repair is disabled by default. No AI repair execution is part of the normal deployment.
- Review Cloudflare and Neon usage before enabling scheduled jobs or expanding traffic.

## Remaining verification before real business use

1. **Live API and authentication smoke test:** request `/api/health`, sign in with the owner account and verify `/api/auth/profile` returns the expected ERP identity and permissions.
2. **Live database transaction tests:** on Development only, test one product creation, inventory movement, supplier and purchase order, partial receipt, supplier invoice, payable payment, sales invoice and customer payment. Verify resulting records, balances, stock and audit entries directly in Neon. Use disposable fixtures or a rollback strategy; do not use real transactions for QA.
3. **Private R2 paths:** verify authenticated upload, download and deletion of a test product image and a DGI support attachment.
4. **Finance reconciliation:** validate opening balances, cash/bank movements, receivables, payables, expenses and gross/net profit against controlled transactions.
5. **Operational policy review:** confirm payroll calculations and DGI requirements against the applicable Nicaraguan rules before using those modules for statutory operations.

The existing Playwright procurement and inventory tests intercept the API and use in-memory QA fixtures. They verify browser interactions and request payloads, but do not prove that the live Worker can write to Neon. The source/visual QA and CI checks likewise do not replace this live runtime verification.

