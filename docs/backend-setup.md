# Backend setup — Neon Development and Production

This repository uses `main` as its single integration branch. Cloudflare Pages publishes the static ERP interface; a separate Cloudflare Worker handles authenticated API requests. Pages Functions are intentionally not used.

## Current architecture

- Frontend: static HTML/CSS/JavaScript, bundled with esbuild into `dist/`.
- Hosting: Cloudflare Pages project `erp-perfume`, connected to GitHub `main`.
- API: Development Worker `jb-parfums-erp-api` and isolated Production Worker `jb-parfums-erp-api-production`, built from the same `worker/src/` application bundle.
- Worker configuration for Development remains root `wrangler.toml`; Production uses its own isolated Cloudflare script bindings.
- Database: Neon PostgreSQL database `erp_perfume`, with independent `development` and `production` branches. Development Worker remains pinned to Development.
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
- `.github/workflows/deploy-worker.yml` validates and deploys the Development Worker only. Production uses a separate script and must never be repointed through the Development deployment.
- `.github/workflows/wrangler-pages-deploy.yml` publishes a controlled Pages Preview from the `.deployment/pages-preview` marker or manual dispatch. Production is a separate explicit workflow choice.

The last verified Pages Preview deployment is on branch `wrangler-preview` and has the alias `https://wrangler-preview.erp-perfume.pages.dev`. The Development Worker `jb-parfums-erp-api` reports `ERP_ENVIRONMENT=development` and allows the Production Pages origin for the Preview environment. A distinct `jb-parfums-erp-api-production` script has been uploaded with `ERP_ENVIRONMENT=production`, Production Neon Auth endpoints and R2 binding. Its `DATABASE_URL` secret and `workers.dev` route are intentionally still disabled until the owner adds the Production pooled URL as a Cloudflare Secret.

Worker uploads are a separate, controlled operation. Do not assume that a green Worker validation job means the Worker was deployed. Do not create or request a second Cloudflare token merely to run validation. Before any Worker upload, confirm the intended source revision, environment bindings and Development-only target; verify the new active version after upload.

## Worker database secret

The Development Worker exposes a `DATABASE_URL` binding of type `secret_text`. Cloudflare does not return the secret value when settings are inspected, so its exact target is not independently proven from binding metadata alone. The separate Production Worker has not yet received its `DATABASE_URL` secret.

Expected secret target:

- Neon project: `erp-perfume`
- Database: `erp_perfume`
- Branch: `development`
- Runtime role: `jb_erp_runtime_sql`

On 2026-11-05, the Development runtime role received its least-privilege grants: SELECT on all 33 operational tables, INSERT on 32, UPDATE on 21, and DELETE only on the two permission-mapping tables. It can read the verified Neon Auth user record and use the purchase-order number sequence. The migration registry is intentionally excluded, and the role has no elevated PostgreSQL role privileges. The repeatable grant configuration was applied directly to Neon Development.

Cloudflare masks the `DATABASE_URL` secret value. The role permissions are now ready, but the exact username embedded in the active Worker secret cannot be independently verified from Cloudflare settings. Confirm it with an authenticated live Worker request before treating the runtime connection as fully certified.

The Development Worker has Development Neon Auth URLs and `ERP_ENVIRONMENT=development`. The Production Worker uses the Production branch Auth base URL and JWKS URL, `ERP_ENVIRONMENT=production`, the same configured owner bootstrap email and a private R2 bucket binding.

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


## Provisioning a new Neon branch (outside application migrations)

The SQL migration chain creates the ERP `public` schema. It does **not** provision Neon Managed Auth, the Worker runtime role, or the role's grants. These are separate, branch-scoped environment prerequisites.

A read-only check on 2026-11-07 found:

| Environment | `neon_auth` schema | `jb_erp_runtime_sql` | Public table grants | Public column grants | Public sequence grants |
|---|---:|---:|---:|---:|---:|
| Development | Present | Present | 88 | 1,036 | 2 |
| Fresh-migration QA clone | Missing | Missing | 0 | 0 | 0 |
| Development-derived QA clone | Present | Present | 88 | 1,036 | 2 |

The fresh-migration QA clone therefore proves the SQL schema chain can be built, but it is **not** a complete authenticated ERP environment. Neon reported Managed Auth as not enabled on that branch. Do not try to create `neon_auth` by copying application SQL or by adding it to `db/migrations`; enable/provision Neon Auth for the target branch using Neon’s managed Auth controls, then configure trusted origins and email verification.

Provision `jb_erp_runtime_sql` separately on each new branch. Its privileges must mirror the reviewed least-privilege Development policy: SELECT on operational tables, only the required INSERT/UPDATE/column grants, sequence use where required, and DELETE restricted to `user_permission_overrides` and `role_template_permissions`. Do not leave a generic Neon `read_write` role preset unchanged: that preset is broader than the ERP runtime policy because it grants DELETE across the scoped schema. Never use `erp_owner` as the Worker runtime credential.

Before declaring a new branch ready, run `db/diagnostics/runtime-provisioning.sql` against that exact branch (and `db/diagnostics/development-readiness.sql` after the migration ledger exists) and verify:
- `neon_auth` exists and Neon Auth is enabled/configured for that branch;
- `jb_erp_runtime_sql` exists with the least-privilege grants;
- the Worker secret uses that runtime role and points to the intended branch;
- `/api/health` succeeds, followed by an authenticated `/api/auth/profile` and a synthetic API smoke test.

A green `/api/health` response alone proves database reachability and binding readiness; it does not prove that Neon Auth is provisioned or that the runtime role can access every required table/column.

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

Repository sources contain the canonical migration chain `0001` through `0023`. Development retains explicitly documented historical ledger/source provenance exceptions and schema-satisfied versions without ledger rows; never replay those versions or fabricate Development ledger entries. See `docs/database-reliability-gate.md`, `db/migration-integrity.json` and `docs/migration-runner.md`.

Neon Production was initialized from an empty public application schema using the exact `main` SQL sources `0001`–`0023`. All 23 Production ledger rows contain the matching manifest SHA-256. A live comparison confirms exact parity with Development across 500 public columns, all 640 constraints, all 153 indexes, all 8 triggers and all 5 sequences. Production has zero unvalidated foreign keys and zero invalid/unready indexes. The Development-only migration runner remains pinned to Development and must not be repurposed or pointed at Production.

Migrations are not automatically executed by Pages or Worker deployment. Keep migration application separate from runtime deployment, preserve each migration's SHA-256 provenance, and use the reviewed Production release procedure in `docs/production-cutover.md`.

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

- The Development Worker is configured with `ERP_ENVIRONMENT=development` and a Neon Development connection. It remains separate from Production.
- Neon Production has 41 public application tables and migration ledger versions `0001`–`0023`. Its schema was compared with Development: all 500 public columns match by data type, nullability, defaults and sizing; zero foreign keys are unvalidated and zero indexes are invalid/unready.
- Production has a distinct least-privilege `jb_erp_runtime_sql` role. It has 88 public table grants, 1,079 public column grants and 2 sequence grants, with no general operational DELETE and no superuser/role/database creation privileges.
- The Production Worker must not be exposed until its `DATABASE_URL` secret is installed and `/api/health` passes with `environment=production`.
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



See [Production cutover](production-cutover.md) for the live Production schema state, owner identity bootstrap, Worker secret step, and final Pages gate.
