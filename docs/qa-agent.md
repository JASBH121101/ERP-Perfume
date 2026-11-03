# JB PARFUMS ERP — QA automation agent

## Profile

The QA agent is medium-advanced and human-supervised. Deterministic tests always run on pull requests. The AI repair stage is optional and disabled by default.

## Scope

The agent receives only:
- Plain-text test output.
- index.html.
- assets/css/styles.css.
- assets/js/app.js.

It does not receive screenshots, images, video, audio, customer records, employee records, database contents, storage objects, environment files or secrets other than its own API key.

The agent cannot call Neon, Cloudflare, R2, Supabase, public websites, external tools or shell commands. It can only request one structured text response from the OpenAI Responses API.

## Automatic repair boundary

A proposed repair is accepted for verification only when:
1. The model classifies it as low risk.
2. Every changed path is within the exact UI allowlist.
3. The patch edits existing files only.
4. The patch contains no binary files, new files, deletions, renames or path traversal.
5. git apply --check succeeds.
6. The complete static and Playwright suite passes again.

The allowed files are:
- index.html
- assets/css/styles.css
- assets/js/app.js

If a failure requires changes to business rules, prices, invoices, payroll, employee records, authentication, APIs, database schemas, migrations, infrastructure, workflows, packages, test suites or scripts, the agent must request manual review.

When verification passes, GitHub Actions creates a separate draft pull request against the original feature branch. It never pushes to main, merges a pull request or deploys a repair directly to production.

Only one AI request is attempted for each failed workflow run. There is no automatic retry loop.

## Enable the AI stage

The code is committed, but the AI stage is intentionally disabled until the owner configures API access.

In the private repository:
1. Open Settings → Secrets and variables → Actions.
2. Under Secrets, create OPENAI_API_KEY with an API key from the OpenAI API Platform.
3. Under Variables, create AI_REPAIR_ENABLED with the value true.
4. Optionally create OPENAI_MODEL with gpt-6-luna. This is the default if the variable is empty.

Never put the API key in source code, a commit, an issue, a Pull Request, a workflow log or a chat message.

API usage is billed separately from a ChatGPT subscription. Configure a project budget/alert in the OpenAI API Platform and review usage before enabling the variable.

## Cost controls

- Deterministic static and browser checks do not call an LLM.
- The AI stage runs only after a failed validation and only when explicitly enabled.
- The model defaults to gpt-6-luna with medium reasoning.
- The request uses store=false and a 3,500-token maximum output.
- Logs and source context are locally capped before sending.
- No image input, visual model call, web search, file search or tool call is enabled.
- No Neon, R2, Cloudflare Worker or Supabase API calls are made by the QA agent.
- Playwright screenshot, video and trace recording are disabled.

## Local development

No project software needs to be installed on a work computer. GitHub Actions installs the pinned test dependency on its hosted runner.

To run the same checks on a developer machine that already has Node.js 22+, Python 3 and Chromium:
- npm install --no-package-lock --no-audit --no-fund
- npx playwright install chromium
- bash scripts/run-validation.sh

## Current test coverage

- Dashboard and main navigation, including DEMO-derived metrics and per-product minimum stock.
- Desktop sidebar collapse and persistence; mobile drawer scroll isolation.
- Font-size scale and persistence.
- Product search, stock filters, product create/edit/deactivate flows and duplicate SKU validation.
- Searchable customer, supplier, perfume and order selectors; new order and voucher selectors start empty.
- Inventory entries, exits, adjustments, stock guards and persisted movement ledger.
- Order confirmation stock outflow, insufficient-stock blocking, no duplicate deduction on later status changes, and stock reversal when returned to pending.
- Mobile inventory stock and movement-ledger card layouts without horizontal panning.
- Mobile product-editor dialog width, input bounds, visible footer and accessible button sizing.
- Responsive record cards for products, orders, customers, internal vouchers, suppliers, purchases, expenses, cash and HR lists.
- Currency conversion, preserved transaction rates, purchase cost averaging, NIO-only payroll, cash account currency validation and internal voucher/abono workflow.
- Invoice preview from linked order items, customer/contact, unit prices, subtotals, discounts, delivery fees, total, selected currency and rate preservation.
- Sidebar integration state labels without simulated progress meters.
- Escaping of user-entered product names.
- Static HTML IDs, navigation, local assets, CSS structure and JavaScript syntax hooks.
- Dependency-free advisory scan for obviously unreferenced named functions, application cache APIs and delegated document event-handler counts. Heuristic findings require human review; they are not auto-deleted.
- The current UI prototype has no Service Worker, Cache API or IndexedDB layer. localStorage is DEMO persistence, not a cache; HTTP caching is managed by the browser/hosting layer.
- The OpenAI repair stage remains disabled by default. Deterministic checks do not make LLM requests.

The tests use demo data only. They do not connect to Neon or R2. The end-to-end suite must be run separately; adding test definitions does not mean they have passed.

## JB Expert QA integration

The ERP pull-request workflow also runs the private **JB Expert QA 0.4.0** project auditor.

- GitHub Actions reads the private `JASBH121101/JB-Expert-QA` repository using the repository secret `JBQA_REPO_READ_TOKEN`.
- The token must be a fine-grained PAT restricted to that single repository with `Contents: read-only`. It is used only by the secondary checkout step and is never written to the workspace or report.
- The engine is pinned to commit `9022c223a05af29f4bf3afa9f53a9448acfbfdbc` for reproducible builds. Updating the engine requires a reviewed commit change in `.github/workflows/ui-checks.yml`.
- The job runs the local static project auditor on a clean archive of the exact ERP pull-request revision. The engine itself is kept outside that scan snapshot.
- This integration does **not** install ERP dependencies, execute ERP code, call Gemini, Cloudflare Workers AI, OpenAI, Neon, R2, or Supabase, and does not connect to production data.
- The scanner skips environment files and credential material without opening their contents. The report records file paths and findings, not copied source contents or secret values.
- JSON and Markdown reports are uploaded as a GitHub Actions artifact for seven days.
- During initial calibration, the gate blocks incomplete scans, critical findings, and QA rule execution errors. A score below the engine's advisory threshold is reported but does not yet block CI; the current ERP baseline must be reviewed before enabling score-based blocking.
- The integration runs for pull requests originating from this repository. Pull requests from forks skip the job because GitHub does not expose repository secrets to fork workflows.

The existing Playwright/static validation job remains independent. JB Expert QA supplements it; it does not replace browser tests or certify live database state.

