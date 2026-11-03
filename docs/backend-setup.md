# Backend setup — development only

This guide describes the integration branch. It does not authorize a production cutover.

## Current architecture

- Frontend: static HTML/CSS/JavaScript, bundled with esbuild into `dist/`.
- API: Cloudflare Pages Functions under `functions/api/`.
- Database: Neon PostgreSQL database `erp_perfume`, development branch only.
- Identity: Neon Managed Better Auth on the same development branch.
- Files: private Cloudflare R2 bucket `erp-perfume-assets`, bound to Pages Preview as `ASSETS`.
- Database access: the restricted `jb_erp_app` role. Do not use the database owner URL from application code.

## Preview-only Cloudflare variables

The non-secret preview values are already preconfigured in Cloudflare for the `feat/neon-cloudflare-backend-final` preview:

- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_JWKS_URL`
- `BOOTSTRAP_OWNER_EMAIL`
- `ERP_ENVIRONMENT=development`

The private database connection string must be entered by the project owner directly in Cloudflare. Go to Cloudflare Dashboard → Workers & Pages → `erp-perfume` → Settings → Variables and Secrets → Preview, then add:

| Name | Type | Value |
|---|---|---|
| `DATABASE_URL` | Secret | Connection URI for Neon `development`, database `erp_perfume`, restricted role `jb_erp_app` |

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
