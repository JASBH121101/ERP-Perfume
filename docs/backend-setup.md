# Backend setup — Neon Development

This repository uses `main` as its single integration branch. Cloudflare Pages publishes the static ERP interface; a separate Cloudflare Worker handles authenticated API requests. Pages Functions are intentionally not used.

## Current architecture

- Frontend: static HTML/CSS/JavaScript, bundled with esbuild into `dist/`.
- Hosting: Cloudflare Pages project `erp-perfume`, connected to GitHub `main`.
- API: Cloudflare Worker `jb-parfums-erp-api`, source in `worker/src/index.js` and `worker/src/erp.js`.
- Worker configuration used by deployment: `worker/wrangler.toml`.
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

The workflow `.github/workflows/deploy-worker.yml` is **manual only**. A push to `main` must not trigger a Worker deployment. Run it from GitHub Actions only after code changes have been batched and reviewed; the required confirmation is explicitly for the Development Worker.

Required repository secret:

- `CLOUDFLARE_WORKERS_API_TOKEN`: an account-owned Cloudflare API token with the **Editor** role scoped to the individual Worker `jb-parfums-erp-api`. This least-privilege scope is required for Wrangler to deploy that Worker. The token currently used by the prior workflow returned Cloudflare's `No access to the specified service` response and must be replaced or granted the appropriate Worker Editor scope before a manual deployment can succeed.
- Keep the existing Pages deployment credential separate: `CLOUDFLARE_API_TOKEN` remains used by the Pages Wrangler workflow. Do not weaken Pages access or reuse a Pages-only token for Worker deployment.

The workflow checks the explicit confirmation, verifies that `worker/wrangler.toml` targets `ERP_ENVIRONMENT=development`, validates source, builds, runs unit tests, then runs `wrangler whoami` and `wrangler deploy` from the `worker/` directory. It is not a Production deployment workflow.

Never store either token in source files, workflow logs, issues, or chat.

## Worker database secret

The deployed Worker must have the secret `DATABASE_URL` configured in Cloudflare Workers & Pages → `jb-parfums-erp-api` → Settings → Variables and Secrets.

Use the connection string for:

- Neon project: `erp-perfume`
- Database: `erp_perfume`
- Branch: `development`
- Runtime role: `jb_erp_runtime_sql`

The actual connection string and password are secrets. Do not paste them into GitHub, source files, logs, documentation or chat. If credentials change, update the Worker secret directly in Cloudflare and redeploy if required.

The Worker also requires the Neon Auth base URL, JWKS URL, owner bootstrap email, `ERP_ENVIRONMENT=development`, the allowed Pages origin, and the R2 bucket binding. These settings are configured as Worker variables/bindings, not committed credentials.

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

SQL migrations are kept in `db/migrations/` and tracked in `public.app_schema_migrations` on the Development branch. The last direct read of Development showed versions `0001` through `0009` applied. The current `main` tree contains source files `0001` through `0007`; the exact source files for versions `0008` and `0009` are absent. Their registered names, checksums and observed schema are documented in `docs/migration-reconciliation-2026-11-05.md`.

Do not recreate or rerun `0008`/`0009` from guesses: their records and resulting objects already exist in Development. Recover the exact original SQL or create a reviewed forward reconciliation migration. Migrations are not automatically executed by GitHub Actions, Pages or Worker deployments. Do not migrate Neon Production until the owner explicitly approves a reviewed cutover and backup plan.

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

## Known items for the next implementation phase

1. Complete a live authenticated smoke test of the deployed Worker and R2 paths.
2. Extend automated tests to cover database-backed inventory and transaction paths, including stock conflict, order-to-invoice transitions and duplicate prevention.
3. Implement the dedicated purchase-order and partial goods-receipt workflow if it remains in scope.
4. Continue the inventory module audit and strengthen any missing UX, validation, traceability and reporting before loading real catalog data.
