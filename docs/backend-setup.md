# Backend setup — development only

This guide describes the integration branch. It does not authorize a production cutover.

## Current architecture

- Frontend: static HTML/CSS/JavaScript, bundled with esbuild into `dist/`.
- API: Cloudflare Pages Functions under `functions/api/`.
- Database: Neon PostgreSQL database `erp_perfume`, development branch only.
- Identity: Neon Managed Better Auth on the same development branch.
- Files: private Cloudflare R2 bucket `erp-perfume-assets`, bound to Pages Preview as `ERP_ASSETS`.
- Database access: `jb_erp_runtime_sql`, a dedicated SQL-created login with `NOINHERIT`, no administrative capabilities, and column-level grants only for the current authentication and HR API. Do not use a database-owner URL or a Neon-managed superuser role from application code.

## Preview-only Cloudflare variables

The non-secret preview values are already preconfigured in Cloudflare for the `feat/neon-cloudflare-backend-final` preview:

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_JWKS_URL`
- `BOOTSTRAP_OWNER_EMAIL`
- `ERP_ENVIRONMENT=development`

The private database connection string must be entered by the project owner directly in Cloudflare.
The SQL role `jb_erp_runtime_sql` has already been created on the Neon `development` branch and granted only the columns required by the current HR API. It deliberately has no password set yet. In Neon SQL Editor (make sure the selected branch is `development`), set a strong password directly:

```sql
ALTER ROLE jb_erp_runtime_sql PASSWORD '<generate-a-strong-password-here>';
```

Then build the URI below and enter it only in the Cloudflare Preview secret field. Do not put the password in this repository or a pull-request comment:

```text
postgresql://jb_erp_runtime_sql:<PASSWORD>@ep-lingering-field-bethkduo-pooler.c-9.us-east-2.aws.neon.tech/erp_perfume?sslmode=require
```
 Go to Cloudflare Dashboard → Workers & Pages → `erp-perfume` → Settings → Variables and Secrets → Preview, then add:

| Name | Type | Value |
|---|---|---|
| `DATABASE_URL` | Secret | Connection URI for Neon `development`, database `erp_perfume`, role `jb_erp_runtime_sql` |

Do not paste this secret into GitHub, source files, pull-request comments, or chat. Never add it to Production at this stage.

## Neon Auth checklist

- Add the Pages branch preview origin to Neon Auth trusted domains on the `development` branch.
- In Neon Auth → Email & Password on the `development` branch, enable **Verify email on sign-up** and **Require email verification**. The current method is OTP; the ERP login dialog now supports entering and resending the six-digit code.
- Keep automatic sign-in after verification enabled. Verify the owner account's email before using protected ERP records.
- Keep the owner email in the Preview variable only; do not place it in frontend source.

## HR access

The employee API currently implements protected list and create operations. Both require a valid Neon Auth JWT and an application role of `owner`, `admin`, or `hr`. Payroll, attendance, and leave tables exist in the schema, but their complete UI and API workflows remain to be implemented. Salary values are stored in NIO.

## Validation

Run locally:

```sh
npm install
npm run build
npm test
```

The browser tests continue to run against local DEMO mode unless a deployed Pages Preview environment has all three backend prerequisites configured: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_JWKS_URL`.

## Free-tier safeguards

- No AI repair job unless explicitly enabled by repository settings.
- No scheduled polling or database cron jobs.
- Keep Neon compute on the development branch at minimum capacity and avoid frequent manual queries.
- Keep product and document files in private R2; do not enable public bucket access.
- Review Neon and Cloudflare usage before increasing traffic or enabling production features.
