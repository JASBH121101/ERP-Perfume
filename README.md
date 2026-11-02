# JB PARFUMS ERP

ERP web application for JB PARFUMS.

## Current phase
UI foundation and quality automation. All business records currently shown in the interface are demo data.

## Architecture
- Frontend: HTML, CSS and vanilla JavaScript.
- Hosting/runtime: Cloudflare Pages + Workers.
- Database: Neon PostgreSQL (not connected yet).
- Assets: private Cloudflare R2 bucket (not connected yet).
- CI and test automation: GitHub Actions.
- Browser automation: Playwright with Chromium.
- Optional AI repair: OpenAI Responses API, disabled by default.

## Quality gate
Pull Requests run:
1. JavaScript syntax validation.
2. Static HTML, CSS, navigation and asset checks.
3. Browser end-to-end tests.

See docs/qa-agent.md for capabilities, guardrails, activation and cost controls.

## Development principles
- No program installation on the work PC is required.
- No database or storage calls from the browser during the UI phase.
- No credentials are committed to the repository.
- Work in feature branches and use Pull Requests.
- AI repairs are restricted to low-risk UI files and always require human review.
- No automatic merge or production deployment from the AI agent.
- Monitor Free-tier usage before adding integrations.

## Status
The interface is not production-ready. Authentication, database persistence, inventory operations, invoices and HR workflows still need implementation and validation.


## Functional prototype status

Products and inventory support browser-local DEMO persistence (localStorage), product create/edit/view/deactivate/delete, stock entries/exits/adjustments, an inventory ledger and CSV export. This is not a production database: it is isolated to the current browser and is not synchronized with Neon or R2. Do not enter real customer, employee or business records.
