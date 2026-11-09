# Production cutover — JB PARFUMS ERP

Last reviewed: 2026-11-09. This runbook records verified infrastructure state and remaining go-live gates.

## Neon Production database

Project: `erp-perfume`  
Database: `erp_perfume`  
Branch: `production`  
Branch ID: `br-royal-art-ben0apun`

The production migration chain `0001` through `0023` is applied and reconciled against the reviewed sources.

Verified database state:

- 41 public application tables and 9 managed `neon_auth` tables.
- 23 migration ledger rows, versions `0001`–`0023`.
- 0 unvalidated foreign keys.
- 0 invalid or unready indexes.
- Production schema matches Development across the 41 public application tables.
- No production customer, product, purchasing, sales, or inventory transactions were loaded during cutover checks.
- The least-privilege runtime role `jb_erp_runtime_sql` connects to `erp_perfume`; its access was checked independently.

Do not drop application tables because they currently contain zero rows. All 41 public tables are functional application schema.

## Production Neon Auth identity

Neon Auth is provisioned on the Production branch with its own branch-specific base URL and JWKS endpoint. Email/password sign-up is enabled, email verification by OTP is required, and the trusted origin is `https://erp-perfume.pages.dev`. Localhost access is disabled.

Development and Production have separate identity directories and sessions. Do not copy password hashes, browser cookies, sessions, or Auth internals between branches.

The Production owner identity must complete first sign-up and email OTP verification using the configured owner email. On the first verified owner request to `/api/auth/profile`, the Worker safely provisions the matching active ERP owner profile. This owner onboarding is a remaining go-live acceptance step.

## Cloudflare Production API

Worker: `jb-parfums-erp-api-production`  
URL: `https://jb-parfums-erp-api-production.jaredblancoh19.workers.dev`

Production Worker configuration was verified:

- `ERP_ENVIRONMENT=production`.
- `DATABASE_URL` is installed as a Cloudflare secret.
- The database secret points to Neon Production, database `erp_perfume`, with runtime role `jb_erp_runtime_sql`.
- Production Neon Auth base URL and JWKS URL are configured.
- R2 binding `ERP_ASSETS` targets the private bucket `erp-perfume-assets`.
- CORS allows the canonical Pages origin `https://erp-perfume.pages.dev`.

The live `GET /api/health` response was checked from a browser on 2026-11-09 and returned `ok=true`, `environment=production`, with `database=true`, `authentication=true`, and `storage=true`.

The health response verifies database connectivity and the presence of Auth and storage configuration. It does not, by itself, prove a full browser sign-up/sign-in flow or a successful JWKS key fetch.

## Cloudflare Pages Production

Pages project: `erp-perfume`  
Git integration automatic deployment switch: enabled; Production deploys from `main`, preview deploys are disabled.  
Canonical origin: `https://erp-perfume.pages.dev`  
Source repository: `JASBH121101/ERP-Perfume`  
Production branch: `main`

The Pages project had Production auto-deployments disabled and no Production build variables. This was corrected on 2026-11-09:

- Production auto-deployments are enabled for `main` only.
- Preview deployments remain disabled to prevent accidental mixing with Development.
- Production build variable `ERP_DEPLOY_TARGET=production`.
- Production build variable `ERP_API_BASE_URL=https://jb-parfums-erp-api-production.jaredblancoh19.workers.dev`.
- Build runtime pinned with `NODE_VERSION=22`.
- Build command remains `npm run build`, output directory `dist`.

These build variables ensure the frontend build injects the Production Worker URL and refuses to fall back to the Development API. The next successful Pages production deployment must be checked for the current `main` commit and verified against the canonical origin before declaring the frontend cutover complete.

Do not copy the preview's Development database secret or Neon Auth URLs into Production Pages. The browser frontend communicates with the Worker; the Worker owns the database secret and R2 binding.

## Storage and cleanup policy

The R2 bucket was private and empty at the last inventory check. Keep it private; only the Worker should access it. Verify upload/download flows with non-sensitive sample assets before loading real product images or DGI files.

Keep Development and Production branches. Temporary QA and prelaunch backup branches are retained until the complete production certification is finished. Cleanup requires a separate explicit confirmation. Never delete Development or Production branches, their Auth schemas, or any functional public application tables.

## Remaining production acceptance gates

1. Successful Pages production build and deployment from the current `main` commit.
2. Verify canonical Pages HTML references the Production Worker URL.
3. Complete first Production owner sign-up, OTP verification, owner-profile bootstrap, and session restore.
4. Run authenticated smoke tests for the main ERP workflows and confirm audit records and role enforcement.
5. Only then declare production cutover certified and request approval for temporary branch cleanup.
