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

In Cloudflare Dashboard → Workers & Pages → `erp-perfume` → Settings → Variables and Secrets → Preview, add:

| Name | Type | Value |
|---|---|---|
| `DATABASE_URL` | Secret | The connection URI for the Neon `development` branch and restricted `jb_erp_app` role |
| `NEON_AUTH_BASE_URL` | Plain text | `https://ep-lingering-field-bethkduo.neonauth.c-9.us-east-2.aws.neon.tech/erp_perfume/auth` |
| `NEON_AUTH_JWKS_URL` | Plain text | `https://ep-lingering-field-bethkduo.neonauth.c-9.us-east-2.aws.neon.tech/erp_perfume/auth/.well-known/jwks.json` |
| `BOOTSTRAP_OWNER_EMAIL` | Plain text | The ERP owner's verified email address |
| `ERP_ENVIRONMENT` | Plain text | `development` |

Never add these variables to Production until the migration, permissions, backups, and data workflows have been reviewed and the owner explicitly approves the cutover.

## Neon Auth checklist

- Add the Pages branch preview origin to Neon Auth trusted domains on the `development` branch.
- Enable email verification on sign-up before assigning the owner role.
- Verify the owner account's email before using protected ERP records.
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
