# Backend setup — Neon Development

This repository uses `main` as its single working branch. Cloudflare Pages publishes the static ERP interface; a separate Cloudflare Worker handles API requests. Pages Functions are intentionally not used.

## Current architecture

- Frontend: static HTML/CSS/JavaScript, bundled with esbuild into `dist/`.
- Hosting: Cloudflare Pages project `erp-perfume`, production branch `main`.
- API: Cloudflare Worker `jb-parfums-erp-api`, source in `worker/src/index.js`.
- Worker configuration: `worker/wrangler.toml`.
- Database: Neon PostgreSQL database `erp_perfume`, development branch only for this phase.
- Identity: Neon Managed Auth; the Worker verifies JWTs and checks the verified email and ERP role.
- Files: private R2 bucket `erp-perfume-assets`, bound to the Worker as `ERP_ASSETS`.
- HR: employee list/create only are connected so far. Attendance, leave, payroll and the rest of the ERP modules are not yet migrated.

The old Pages Functions source has been removed so Pages no longer attempts to publish API Functions.

## One-time GitHub Actions configuration

The workflow `.github/workflows/deploy-worker.yml` deploys the Worker when relevant files change on `main`.

Create a Cloudflare API token:
1. In Cloudflare Dashboard, open **My Profile → API Tokens**.
2. Create a custom token using the **Edit Cloudflare Workers** permission template, limited to this Cloudflare account.
3. Save the token in GitHub at **JASBH121101/ERP-Perfume → Settings → Secrets and variables → Actions → New repository secret**.
4. Name the secret exactly `CLOUDFLARE_API_TOKEN`.

The Cloudflare account ID is already declared in the Wrangler configuration and does not need to be stored as a GitHub secret. Do not paste the API token into source files or chat.

If the workflow ran before the secret was added, it will complete with a warning and skip deployment. After adding the secret, open **Actions → Deploy JB PARFUMS API Worker → Run workflow** (branch `main`).

## One-time Worker database secret

After the Worker is deployed, add its database connection directly in Cloudflare:
1. Open **Workers & Pages → jb-parfums-erp-api → Settings → Variables and Secrets**.
2. Add `DATABASE_URL` as a **Secret**.
3. Use the connection string for the Neon `development` branch, database `erp_perfume`, login role `jb_erp_runtime_sql`.
4. Save and redeploy the Worker if the dashboard asks for it.

Use the same development connection string already prepared for the Pages Preview secret. The password is intentionally not stored in this repository and must not be shared in GitHub comments or chat. If the password contains URI-reserved characters, URL-encode the password segment in the connection string.

The Worker configuration already contains the development Neon Auth base URL, JWKS URL, owner bootstrap email, `ERP_ENVIRONMENT=development`, the production Pages origin allowed for CORS, and the private R2 bucket binding. The database URL is the only Worker runtime secret required by the current API.

## Neon Auth security checklist

On the Neon `development` branch:
- Enable **Verify email on sign-up** and **Require email verification**.
- Add `https://erp-perfume.pages.dev` to the Neon Auth trusted domains/origins.
- Verify the owner account's email before opening protected ERP records.
- Keep self-registered non-owner accounts at the default `viewer` role unless an administrator explicitly changes their role.

The Worker checks the verified email in Neon Auth's `neon_auth.user` table. The owner email in the Wrangler variables is used only for the initial owner-role bootstrap. HR endpoints permit only `owner`, `admin`, or `hr`.

## Routes and validation

- `GET https://jb-parfums-erp-api.jaredblancoh19.workers.dev/api/health` checks the database and R2 binding.
- `GET /api/config` tells the frontend whether Neon Auth is configured.
- `GET /api/auth/profile` returns the authenticated user's ERP role.
- `GET /api/hr/employees` returns the protected employee list.
- `POST /api/hr/employees` creates a protected employee and writes an audit event.

Run local checks:

```sh
npm install
npm run build
npm test
```

No sample employee or business records are inserted by deployment. Test the GET endpoints first; only create a real employee after the owner verifies the connection and explicitly chooses to do so.

## Production boundary and free-tier safeguards

- The Worker is deployed as an API service, but its configured Neon connection is for `development` only.
- Neon `production` has no application runtime secret and is not queried or modified by this integration.
- No migrations are run automatically during deployment.
- No scheduled polling, cron jobs, AI repair calls, or background database tasks are enabled.
- The R2 bucket remains private; only the Worker receives a bucket binding.
- Remove the old unused Pages Preview variables and binding only after the Worker health check and HR authentication are confirmed.
- Review Cloudflare and Neon usage before enabling more modules or increasing traffic.

## Scope still outstanding

Only the employee list/create path is backed by Neon. Product catalog, inventory movements, customers, orders, supplier purchases, accounts payable/receivable, expenses, cash/bank transactions, attendance, leave and payroll must remain labeled DEMO until their schemas, APIs, permission checks, audit events and migration tests are implemented.
