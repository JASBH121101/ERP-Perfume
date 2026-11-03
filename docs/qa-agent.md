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

The supervised UI-repair agent cannot call Neon, Cloudflare, R2, Supabase, public websites, external tools or shell commands. The separate deterministic dependency-audit step may call only the fixed OSV.dev advisory API when `advisories.enabled` is true; it sends npm package names and exact versions only, never source files, secrets or customer data. The visual browser pass runs the checked-out ERP UI in Chromium against a temporary loopback server and enforces same-origin-only requests; external API, analytics, storage and production-service origins are blocked.

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

The ERP pull-request workflow runs **JB Expert QA 0.7.0** in two complementary stages: static source audit and isolated browser/visual audit.

- GitHub Actions reads the private `JASBH121101/JB-Expert-QA` repository using the repository secret `JBQA_REPO_READ_TOKEN`.
- The token is a fine-grained PAT restricted to that repository with `Contents: read-only`. It is never written to the workspace or any report.
- The engine is pinned to commit `92f23fafd679c31dcbe496a4e1b3801d3f14fb7f` for reproducible builds. Updating the engine requires a reviewed commit change in `.github/workflows/ui-checks.yml`.
- The ERP keeps its own `jb-expert-qa.config.json` policy: profile `jb-parfums-erp`, minimum score **90/100**, and a security weight of **45%**. The workflow passes this file to the auditor; other projects continue using the shared general profile unless they supply their own.
- The static audit examines a clean archive of the exact ERP pull-request revision. It does not execute code, install ERP packages, or connect to the database.
- The optional OSV.dev step sends only exact npm package names and versions. The ERP has no root npm lockfile, so current advisory coverage is partial and does not include transitive dependencies.
- The visual job installs only the pinned JB Expert QA browser dependencies with lifecycle scripts disabled, then launches Chromium against a temporary loopback server. That server exposes only `index.html` and `assets/**` from the pull-request checkout.
- The visual audit checks mobile (390×844), tablet (768×1024), and desktop (1365×900), runs axe-core locally, measures overlap between visible interactive controls, explores up to 12 safe interactive states per viewport, and captures screenshots for each viewport.
- The visual browser uses `sameOriginOnly: true`: any HTTP(S) or WebSocket request to an origin other than the temporary local preview is blocked and recorded. It cannot reach Neon, Cloudflare R2, external APIs, analytics, or production services.
- CI requires the exact `jb-parfums-erp` static profile and blocks on a score below 90/100, critical findings, rule errors, incomplete scans, or high-severity visual findings where a control is measurably obscured by another element.
- Static JSON/Markdown reports and visual JSON/HTML/Markdown reports plus viewport screenshots are uploaded as GitHub Actions artifacts for seven days.
- The visual pass does execute the ERP's browser-side HTML/CSS/JavaScript in Chromium, but only with demo/local state and no production credentials or external-origin access. It does not repair files, push commits, merge PRs, or deploy.
- The integration runs for pull requests originating from this repository. Pull requests from forks skip the private-repository checkout because GitHub does not expose repository secrets to fork workflows.

The visual overlap detector is evidence-based rather than a subjective design judge. It excludes ancestor/descendant pairs (such as an icon inside its own button), records the intersection area and which control receives hit tests, and flags high-severity cases where a visible control is blocked. Interactive-state exploration opens controls with recognizable disclosure semantics or toggle intent (for example, collapsed aria-expanded controls, hidden aria-controls targets, tabs, details/summary disclosures, and named menu/sidebar toggles). It skips links, form submission controls and labels suggesting destructive or transactional actions. Each candidate is tested from a fresh local page load; the report identifies the state and trigger selector. This does not automatically authenticate, submit forms, or explore arbitrary controls without an identifiable toggle signal.

The existing Playwright end-to-end suite remains independent. JB Expert QA supplements it; it does not replace the ERP's functional tests or certify live database state.

## Supply-chain advisory lookup

The ERP's `jb-parfums-erp` profile enables OSV.dev lookup for npm package versions. The ERP currently has no root npm lockfile, so the first pass can check exact pinned direct dependencies from `package.json` but will explicitly report partial coverage: transitive dependencies are not evaluated until a supported lockfile is committed. The lookup is best-effort (`required: false`) so a temporary external advisory-service outage does not masquerade as a clean result or block unrelated browser tests. Any returned high or critical OSV advisory blocks the QA gate; a critical result also fails the engine's scoring gate.

