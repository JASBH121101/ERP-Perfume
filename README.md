# JB PARFUMS ERP

ERP web application for JB PARFUMS.

## Current phase

The ERP frontend is gated by Neon Auth: it does not render the dashboard or load application modules until the Worker validates an authenticated ERP profile. Browser-local DEMO modules remain clearly identified and are not a substitute for database-backed production workflows.

## Currency policy

- Operational/base currency: USD ($).
- Configurable reference rate for conversions: C$ 36.60 per US$ 1 by default.
- Browser-local DEMO records are isolated to the current browser and are not synchronized.
- Official invoicing and NIO conversion are not enabled yet. Payroll values are NIO-only.

## Architecture

- Frontend: static HTML, CSS and JavaScript, built into `dist/`.
- Frontend hosting: Cloudflare Pages project `erp-perfume`, production branch `main`.
- API: standalone Cloudflare Worker `jb-parfums-erp-api`, called from the frontend through its configured API base URL.
- Database: Neon PostgreSQL, `erp_perfume` on the `development` branch during validation.
- Identity: Neon Managed Auth; the production Pages origin is allowlisted, JWT verification and ERP role checks run in the Worker, and the frontend stays locked until a valid profile is returned.
- Branding: JB monogram favicon and a subtle JB PARFUMS watermark on invoice preview/print.
- Files: private Cloudflare R2 bucket `erp-perfume-assets`, bound to the Worker as `ERP_ASSETS`.
- CI/CD: GitHub Actions builds and deploys the Worker from `main`; Pages continues to publish the static frontend.
- Browser automation: Playwright with Chromium.
- Optional AI repair: disabled by default.

## Backend scope

The Worker currently exposes:
- `GET /api/config` — frontend authentication configuration.
- `GET /api/health` — Neon connection and R2 binding health.
- `GET /api/auth/profile` — authenticated ERP profile and role.
- `GET /api/hr/employees` and `POST /api/hr/employees` — protected employee list and creation.

Employee access requires a verified Neon Auth account and the ERP role `owner`, `admin`, or `hr`. Salary records remain in córdobas (NIO). RR. HH. stays visible in the interface.

Products, inventory, orders, purchases, suppliers, expenses, finance, and the remaining HR workflows are still browser-local DEMO features until each module receives its own tested database/API migration. Do not enter real commercial records into those DEMO modules.

## Main and database workflow

- This repository is maintained directly on `main`; no integration Preview branch is required for normal work.
- Cloudflare Pages serves the UI from `main`.
- The API Worker initially connects only to Neon `development`.
- Neon `production` is not configured or used by this integration. A production database cutover requires a separate review and explicit authorization.
- Secrets are never committed to GitHub.

## Build and tests

```sh
npm install
npm run build
npm test
```

See [Backend setup](docs/backend-setup.md) for the Worker deployment and secret configuration.

## Static production deployment

Cloudflare Pages publishes only the static `dist/` output from `main`. API routes are served by the standalone Worker at `https://jb-parfums-erp-api.jaredblancoh19.workers.dev`; no Pages Functions are used. A Pages deployment does not provision the Worker or copy database secrets. See [Backend setup](docs/backend-setup.md) for the one-time GitHub Actions token and Worker database secret requirements.
