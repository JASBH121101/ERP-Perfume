# Production cutover — JB PARFUMS ERP

Last reviewed: 2026-11-09. This runbook records the live state; it does not mean production is open for business yet.

## Neon Production database

Project: `erp-perfume`  
Database: `erp_perfume`  
Branch: `production`  
Branch ID: `br-royal-art-ben0apun`

The clean migration chain `0001` through `0023` has been applied from the exact `main` sources. Each source SHA-256 was checked against `db/migration-integrity.json`, and each migration plus its ledger row was committed in one transaction.

Read-only verification after migration:

- 41 public application tables.
- 9 managed `neon_auth` tables.
- 23 migration ledger rows, versions `0001`–`0023`.
- 0 unvalidated foreign keys.
- 0 invalid or unready indexes.
- 500 public columns, matching Development exactly by type, nullability, default, and numeric/string size.
- No production customer, product, purchasing, sales, or inventory transactions were loaded.

A temporary zero-compute branch `prod-prelaunch-backup-2026-11-09` was created before migration. Retain it until final production certification is complete.

## Production runtime role

The Production `jb_erp_runtime_sql` role has been created and configured from the reviewed Development grants.

Verified as the actual login role:

- 88 public table grants and 1,079 public column grants, matching Development.
- 2 public sequence USAGE grants.
- SELECT on the Neon Auth user record.
- SELECT/INSERT/UPDATE on application tables where the reviewed policy allows them.
- No DELETE on operational tables such as products.
- DELETE only on `user_permission_overrides` and `role_template_permissions`.
- Not a superuser; cannot create roles or databases; cannot bypass row-level security.
- It cannot read `app_schema_migrations`.

Never put the database connection string in Git. The Worker connection string is a Cloudflare secret.

## Production Neon Auth identity

Neon Auth is already provisioned on the Production branch. It has its own branch-specific base URL and JWKS endpoint, email/password sign-up, required email verification by OTP, shared Neon email delivery, and the production Pages origin in its trusted-origin list. Localhost access is disabled.

Development currently contains the owner identity and an active browser session. Production is a separate Auth branch and currently has no user identity or session. Do not copy password hashes, browser cookies, sessions, or Auth internals between branches.

The Worker is configured with `BOOTSTRAP_OWNER_EMAIL`. On the first Production sign-up, use the configured owner email, complete the email OTP verification, then sign in. The Worker will create the matching ERP `app_users` owner profile automatically once the verified identity reaches `/api/auth/profile`. After the initial Production sign-in, the browser can restore the Production session without prompting for credentials on every visit.

## Cloudflare Production API

A separate Worker script has been uploaded from the same bundled application code as the Development Worker:

- Script: `jb-parfums-erp-api-production`
- Intended URL: `https://jb-parfums-erp-api-production.jaredblancoh19.workers.dev`
- `ERP_ENVIRONMENT=production`
- Production Neon Auth base URL and JWKS URL
- R2 binding: `ERP_ASSETS` → `erp-perfume-assets`
- CORS origin: `https://erp-perfume.pages.dev`

The script currently has no `DATABASE_URL` secret and its `workers.dev` subdomain is disabled. It must not be exposed or used until the secret is added and the health preflight passes.

### Required manual secret step

Cloudflare does not allow this assistant to transfer the generated Neon connection string between the Neon and Cloudflare secret stores. Do not paste the value into chat.

In Neon Console, open project `erp-perfume` → branch `production` → database `erp_perfume`, and obtain the **pooled** connection string for role `jb_erp_runtime_sql`. In Cloudflare Dashboard, open Workers & Pages → `jb-parfums-erp-api-production` → Settings → Variables and Secrets → add a Secret named `DATABASE_URL` and paste that Production pooled connection string. Save it as a secret, not plain text.

After that secret exists, enable the Worker `workers.dev` subdomain and verify:

- `GET /api/health`: `ok=true`, `environment=production`, database/authentication/storage services all true.
- Production Auth JWKS endpoint responds with at least one key.
- A verified owner sign-up creates exactly one active ERP owner profile.
- A subsequent session restore works without repeated sign-in.

## Pages Production promotion

The Pages Preview remains configured against Development. Production Pages must point to the Production Worker, never the Development Worker.

The workflow `.github/workflows/wrangler-pages-deploy.yml` was updated on `main` so that:

- Preview builds continue to use the Development Worker.
- Production builds use the dedicated Production Worker URL.
- Production API health is checked before the Pages deployment starts.
- After deploy, frontend API URL, CORS, Worker health/environment and Production JWKS are verified.

Do not manually promote Pages until the Production Worker secret is installed and its health preflight succeeds. This deployment has not been run as part of this runbook.

## Storage and cleanup policy

The existing R2 bucket was empty at the last inventory check. Keep it private; only the Worker should access it. Reassess environment separation for R2 before loading real product images or DGI files.

Do not drop application tables because they currently contain zero rows. All 41 public tables are part of the application schema. There were no confirmed test-only or unused tables.

Keep Development and Production. Only after final API, identity, module and Pages certification may the temporary backup and the two QA-only branches be deleted:

- `qa-full-erp-cert-2026-11-08`
- `qa-db-fresh-migrations-2026-11-07`
- `prod-prelaunch-backup-2026-11-09`

Never delete the Development or Production branches, their Auth schemas, or any functional public application tables.
