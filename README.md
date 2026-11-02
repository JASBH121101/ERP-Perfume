# JB PARFUMS ERP

ERP web application for JB PARFUMS.

## Current phase
UI foundation — isolated from production infrastructure.

## Architecture
- Frontend: HTML, CSS and vanilla JavaScript.
- Hosting/runtime: Cloudflare Pages + Workers.
- Database: Neon PostgreSQL.
- Assets: private Cloudflare R2 bucket.
- Quality gates: GitHub Actions.

## Development principles
- No dependencies or local installations required for the initial UI.
- No database or storage calls from the browser.
- Secrets stay in Cloudflare environment bindings; never commit credentials.
- Work in feature branches and merge through pull requests.
- Keep the Free-tier limits and usage budgets under review.

## Status
The interface currently uses clearly labeled demo data. Backend integrations are intentionally not active.
