# JB PARFUMS ERP

ERP web application for JB PARFUMS.

## Current phase
UI foundation and quality automation. All business records currently shown in the interface are demo data.

## Currency policy

- Operational/base currency: USD ($).
- Configurable reference rate for conversions: C$ 36.60 per US$ 1 by default.
- DEMO values from the former Córdobas interface are normalized to USD; browser-local DEMO records are migrated once.
- Official invoicing and NIO conversion are not enabled yet.

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
The interface is not production-ready. Authentication, shared database persistence, fiscal invoicing, full accounts receivable/payable and advanced HR workflows still need implementation and validation. Inventory order outflows and reversals are available in the DEMO workflow only.


## Functional prototype status

Products and inventory support browser-local DEMO persistence (localStorage), product create/edit/view/deactivate/delete with historical-record protection, stock entries/exits/adjustments, automatic order-confirmation outflows with reversals, an inventory ledger and CSV export. This is not a production database: it is isolated to the current browser and is not synchronized with Neon or R2. Do not enter real customer, employee or business records.


## Operational DEMO modules

The feature branch adds browser-local workflows for customers, orders, suppliers, purchases, expenses, cash/bank movements, internal non-fiscal vouchers, abonos and employee records. Internal voucher previews are built from the linked order and show customer/contact, item names, quantities, unit prices, subtotal, discount, delivery, total, selected currency and the exchange rate used. Saved vouchers keep their line-item and currency snapshots. Purchase receipts update demo stock. Business transactions preserve original currency, USD equivalent and exchange rate used. USD is the reporting base; payroll is NIO-only. The exchange rate is editable in Settings and defaults to C$36.60 per US$1. All records remain local to the browser and are not synchronized.
