import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { verifyMigrationSources } from "./check-db-migrations.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = resolve(ROOT, "db/migrations");
const MANIFEST_PATH = resolve(ROOT, "db/migration-integrity.json");
const HISTORICAL_AUDIT_PATH = resolve(ROOT, "db/diagnostics/historical-migration-object-audit.sql");
const BASELINE_RECONCILED_WITHOUT_LEDGER = new Set(["0012", "0013", "0014"]);
const EXPECTED_HISTORICAL_AUDIT = new Map([["0002", 8], ["0003", 14], ["0006", 4], ["0008", 3], ["0009", 4], ["0012", 5], ["0013", 2], ["0014", 2], ["0017", 4], ["0018", 1]]);
const EXPECTED_HISTORICAL_AUDIT_OBJECTS = new Set([
  "0002|table|purchase_orders",
  "0002|table|purchase_order_items",
  "0002|table|purchase_receipts",
  "0002|table|purchase_receipt_items",
  "0002|index|purchase_orders_supplier_date_idx",
  "0002|index|purchase_orders_status_idx",
  "0002|index|purchase_order_items_order_idx",
  "0002|index|purchase_receipts_order_idx",
  "0003|column|products.barcode",
  "0003|column|products.description",
  "0003|column|products.supplier_name",
  "0003|column|products.wholesale_price_usd",
  "0003|column|products.tone",
  "0003|column|products.notes",
  "0003|column|products.images",
  "0003|column|customers.customer_type",
  "0003|constraint|products_images_array_check",
  "0003|constraint|products_wholesale_price_usd_check",
  "0003|constraint|customers_customer_type_check",
  "0003|index|products_barcode_nonempty_uq",
  "0003|index|products_active_category_idx",
  "0003|index|customers_active_name_idx",
  "0006|table|dgi_support_documents",
  "0006|index|dgi_support_documents_date_idx",
  "0006|index|dgi_support_documents_type_period_idx",
  "0006|setting|dgi_compliance",
  "0008|column|app_users.employee_id",
  "0008|constraint|app_users_employee_id_fkey",
  "0008|index|app_users_employee_id_unique_idx",
  "0009|table|supplier_invoices",
  "0009|table|supplier_invoice_payments",
  "0009|index|supplier_invoices_supplier_date_idx",
  "0009|index|supplier_invoice_payments_invoice_idx",
  "0012|sequence|employee_code_sequence",
  "0012|table|employee_history",
  "0012|trigger|employees_seed_history_after_insert",
  "0012|function|seed_employee_history",
  "0012|index|employee_history_employee_date_idx",
  "0013|table|employee_documents",
  "0013|index|employee_documents_employee_date_idx",
  "0014|index|employee_history_changed_by_idx",
  "0014|index|employee_documents_uploaded_by_idx",
  "0017|column|purchase_orders.rejected_by",
  "0017|column|purchase_orders.rejected_at",
  "0017|constraint|purchase_orders_status_check",
  "0017|constraint|purchase_orders_rejection_audit_check",
  "0018|column|purchase_orders.rejection_reason"
]);
const LOCK_NAME = "jb-parfums-erp:database-migrations";
const EXPECTED_DATABASE_DEFAULT = "erp_perfume";
const EXPECTED_ROLE_DEFAULT = "erp_owner";
const BLOCKING_HISTORICAL_STATES = new Set([
  "applied_historical_source_unexecutable",
  "applied_legacy_unverified",
  "applied_reconstructed_source",
  "applied_source_unverified",
  "schema_present_without_ledger"
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha1(bytes) {
  return createHash("sha1").update(bytes).digest("hex");
}

function gitBlobSha1(bytes) {
  const header = Buffer.from("blob " + bytes.length + "\0", "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function compareVersions(a, b) {
  return String(a).localeCompare(String(b));
}

export function classifyDatabaseState({ ledgerExists, ledgerRows, applicationTableCount }) {
  if (!Number.isInteger(applicationTableCount) || applicationTableCount < 0) {
    throw new Error("applicationTableCount must be a non-negative integer.");
  }
  if (!ledgerExists && applicationTableCount === 0) return "fresh";
  if (!ledgerExists) {
    throw new Error("Application tables exist but app_schema_migrations is missing. Refusing to invent a baseline.");
  }
  if (!Array.isArray(ledgerRows)) {
    throw new Error("ledgerRows must be an array.");
  }
  if (ledgerRows.length === 0 && applicationTableCount > 0) {
    throw new Error("Application tables exist but app_schema_migrations is empty. Historical baseline reconciliation is required.");
  }
  if (ledgerRows.length === 0) return "fresh";
  return "existing";
}

export function buildMigrationPlan({ migrations, ledgerRows, freshInstall }) {
  if (!Array.isArray(migrations) || !Array.isArray(ledgerRows)) {
    throw new Error("migrations and ledgerRows must be arrays.");
  }
  const byVersion = new Map();
  for (const migration of migrations) {
    if (byVersion.has(migration.version)) {
      throw new Error("Duplicate migration source version " + migration.version + ".");
    }
    byVersion.set(migration.version, migration);
  }

  const applied = new Map();
  for (const row of ledgerRows) {
    if (applied.has(row.version)) {
      throw new Error("Duplicate migration ledger version " + row.version + ".");
    }
    const source = byVersion.get(row.version);
    if (!source) throw new Error("Database has untracked migration version " + row.version + ".");
    if (source.filename !== row.filename) {
      throw new Error("Filename mismatch for migration " + row.version + ".");
    }
    applied.set(row.version, row);
  }

  if (freshInstall && ledgerRows.length) {
    throw new Error("A fresh database cannot already contain migration ledger rows.");
  }

  if (freshInstall) return [...migrations].sort((a, b) => compareVersions(a.version, b.version));
  return [...migrations]
    .sort((a, b) => compareVersions(a.version, b.version))
    .filter(migration => !applied.has(migration.version));
}

export function verifyPostApplyLedger({ initialLedgerRows, plannedMigrations, finalLedgerRows }) {
  if (!Array.isArray(initialLedgerRows) || !Array.isArray(plannedMigrations) || !Array.isArray(finalLedgerRows)) {
    throw new Error("Initial ledger, planned migrations and final ledger must be arrays.");
  }

  const expected = new Map();
  for (const row of initialLedgerRows) {
    const version = String(row.version);
    if (expected.has(version)) throw new Error("Initial migration ledger contains duplicate version " + version + ".");
    expected.set(version, { filename: row.filename, checksum: row.checksum });
  }

  for (const migration of plannedMigrations) {
    const version = String(migration.version);
    if (expected.has(version)) throw new Error("Planned migration version " + version + " is already in the initial ledger.");
    expected.set(version, { filename: migration.filename, checksum: migration.sha256 });
  }

  const actual = new Map();
  for (const row of finalLedgerRows) {
    const version = String(row.version);
    if (actual.has(version)) throw new Error("Post-apply migration ledger contains duplicate version " + version + ".");
    actual.set(version, row);
  }

  if (actual.size !== expected.size) {
    throw new Error("Post-apply ledger row count mismatch: expected " + expected.size + ", got " + actual.size + ".");
  }

  for (const [version, expectedRow] of expected) {
    const actualRow = actual.get(version);
    if (!actualRow) throw new Error("Post-apply ledger is missing migration " + version + ".");
    if (actualRow.filename !== expectedRow.filename) {
      throw new Error("Post-apply filename mismatch for migration " + version + ".");
    }
    if (actualRow.checksum !== expectedRow.checksum) {
      throw new Error("Post-apply checksum mismatch for migration " + version + ".");
    }
  }

  for (const version of actual.keys()) {
    if (!expected.has(version)) throw new Error("Post-apply ledger contains unplanned migration " + version + ".");
  }

  return true;
}

export function verifyLedgerChecksum({ migration, ledgerChecksum, currentBytes, historicalBytes = null }) {
  if (!migration || !migration.database || !Buffer.isBuffer(currentBytes)) return false;
  const status = migration.database.status;
  if (status === "applied_checksum_verified") {
    return sha256(currentBytes) === ledgerChecksum && migration.sha256 === ledgerChecksum;
  }
  if (status === "applied_git_blob_verified") {
    return gitBlobSha1(currentBytes) === ledgerChecksum;
  }
  if (status === "applied_content_sha1_verified") {
    return sha1(currentBytes) === ledgerChecksum;
  }
  if (status === "applied_historical_source_recovered") {
    return Buffer.isBuffer(historicalBytes) &&
      migration.database.historicalSource?.executable === true &&
      gitBlobSha1(historicalBytes) === ledgerChecksum;
  }
  return false;
}

export function classifyLedgerLineage({ manifest, migrations, ledgerRows }) {
  const actualVersions = ledgerRows.map(row => String(row.version)).sort(compareVersions);
  const snapshotVersions = [...(manifest.snapshot?.ledgerVersions || [])].sort(compareVersions);

  if (JSON.stringify(actualVersions) === JSON.stringify(snapshotVersions)) {
    return {
      type: "development-snapshot",
      blockers: (manifest.migrations || [])
        .filter(item => BLOCKING_HISTORICAL_STATES.has(item?.database?.status))
        .map(item => ({ version: item.version, status: item.database.status }))
        .sort((a, b) => compareVersions(a.version, b.version))
    };
  }

  // A clean install uses the current pinned SHA-256 sources. A contiguous
  // prefix permits safe resume after a failed, transactionally rolled-back step.
  const orderedSources = [...migrations].sort((a, b) => compareVersions(a.version, b.version));
  const sourceByVersion = new Map(orderedSources.map(item => [item.version, item]));
  const rowsByVersion = new Map(ledgerRows.map(row => [String(row.version), row]));
  const cleanPrefix = ledgerRows.length <= orderedSources.length &&
    actualVersions.every((version, index) => {
      const source = sourceByVersion.get(version);
      const row = rowsByVersion.get(version);
      return source &&
        orderedSources[index]?.version === version &&
        row.filename === source.filename &&
        row.checksum === source.sha256;
    });

  if (cleanPrefix) return { type: "clean-install", blockers: [] };

  return {
    type: "unrecognized",
    blockers: ["Live ledger is neither the reviewed Development snapshot nor a verified SHA-256 clean-install prefix."]
  };
}

async function loadMigrationSources() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const sourceCheck = await verifyMigrationSources();
  if (sourceCheck.errors.length) {
    throw new Error("Source integrity gate failed:\n" + sourceCheck.errors.map(x => "- " + x).join("\n"));
  }

  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const names = entries.filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
    .map(entry => entry.name).sort();
  const migrations = [];

  for (const filename of names) {
    const match = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/.exec(filename);
    if (!match) throw new Error("Invalid migration filename: " + filename);
    const bytes = await readFile(resolve(MIGRATIONS_DIR, filename));
    const item = manifest.migrations.find(entry => entry.filename === filename);
    if (!item) throw new Error("No manifest entry for " + filename);
    migrations.push({
      ...item,
      version: match[1],
      bytes,
      sql: bytes.toString("utf8")
    });
  }

  return { manifest, summary: sourceCheck.summary, migrations };
}

export function validateConnectionTarget(connectionString, manifest, environment = process.env) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL is not a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("MIGRATION_DATABASE_URL must use postgres:// or postgresql://.");
  }
  if (!url.hostname.endsWith(".neon.tech")) {
    throw new Error("Migration runner only accepts a direct Neon endpoint hostname.");
  }
  if (url.hostname.includes("-pooler.")) {
    throw new Error("Migrations require a direct Neon connection, not a pooled -pooler endpoint.");
  }

  const pinnedDevelopmentHost = manifest?.snapshot?.developmentEndpointHost;
  const protectedProductionHost = manifest?.snapshot?.productionEndpointHost;
  const configuredHost = environment.ERP_EXPECTED_NEON_ENDPOINT_HOST;
  const actualHost = url.hostname.toLowerCase();

  if (protectedProductionHost && actualHost === protectedProductionHost.toLowerCase()) {
    throw new Error("Production Neon endpoint is explicitly blocked by the migration runner.");
  }
  if (!pinnedDevelopmentHost ||
      !configuredHost ||
      configuredHost.toLowerCase() !== pinnedDevelopmentHost.toLowerCase() ||
      actualHost !== pinnedDevelopmentHost.toLowerCase()) {
    throw new Error("Connection host must exactly match the pinned Neon Development endpoint in db/migration-integrity.json and ERP_EXPECTED_NEON_ENDPOINT_HOST.");
  }
  return url;
}

export function validateHistoricalBaselineAudit({ audit, ledgerRows, manifest }) {
  if (!audit || typeof audit !== "object") {
    throw new Error("Historical baseline audit returned no structured result.");
  }
  if (audit.database !== manifest?.snapshot?.database || audit.role !== EXPECTED_ROLE_DEFAULT) {
    throw new Error("Historical baseline audit database or owner role does not match the pinned Development target.");
  }
  if (!Array.isArray(audit.checks) || audit.checks.length !== EXPECTED_HISTORICAL_AUDIT_OBJECTS.size) {
    throw new Error("Historical baseline audit must return exactly " + EXPECTED_HISTORICAL_AUDIT_OBJECTS.size + " named object checks.");
  }
  const seen = new Set();
  for (const item of audit.checks) {
    if (!item || typeof item.migration !== "string" || typeof item.kind !== "string" ||
        typeof item.object !== "string" || item.present !== true) {
      throw new Error("Historical baseline audit contains a missing, malformed, or failed object check.");
    }
    const key = item.migration + "|" + item.kind + "|" + item.object;
    if (seen.has(key)) throw new Error("Historical baseline audit contains a duplicate object check: " + key);
    if (!EXPECTED_HISTORICAL_AUDIT_OBJECTS.has(key)) {
      throw new Error("Historical baseline audit contains an unexpected object check: " + key);
    }
    seen.add(key);
  }
  if (seen.size !== EXPECTED_HISTORICAL_AUDIT_OBJECTS.size) {
    throw new Error("Historical baseline audit is missing one or more expected named object checks.");
  }
  if (!Array.isArray(audit.summary)) {
    throw new Error("Historical baseline audit summary is missing.");
  }
  const summaries = new Map(audit.summary.map(item => [String(item.migration), item]));
  for (const [version, expectedCount] of EXPECTED_HISTORICAL_AUDIT) {
    const item = summaries.get(version);
    if (!item || Number(item.total) !== expectedCount ||
        Number(item.present) !== expectedCount || Number(item.missing) !== 0 ||
        item.status !== "PASS") {
      throw new Error("Historical baseline audit did not fully verify migration " + version + ".");
    }
  }
  if (summaries.size !== EXPECTED_HISTORICAL_AUDIT.size) {
    throw new Error("Historical baseline audit returned an unexpected migration summary.");
  }
  for (const key of ["employees_missing_initial_history", "unvalidated_constraints", "invalid_or_unready_indexes"]) {
    if (Number(audit[key]) !== 0) {
      throw new Error("Historical baseline invariant failed: " + key + " must be zero.");
    }
  }

  const actualVersions = ledgerRows.map(row => String(row.version)).sort(compareVersions);
  const expectedVersions = [...(manifest.snapshot?.ledgerVersions || [])].sort(compareVersions);
  if (JSON.stringify(actualVersions) !== JSON.stringify(expectedVersions)) {
    throw new Error("Live Development ledger does not exactly match the reviewed snapshot.");
  }
  for (const version of BASELINE_RECONCILED_WITHOUT_LEDGER) {
    if (actualVersions.includes(version)) {
      throw new Error("Migration " + version + " unexpectedly has a ledger row; baseline assessment must be reviewed again.");
    }
  }
  return {
    status: "RECONCILIATION_EVIDENCE_PASSED_REVIEW_REQUIRED",
    objectChecks: audit.checks.length,
    migrationsChecked: EXPECTED_HISTORICAL_AUDIT.size,
    ledgerRows: actualVersions.length,
    schemaPresentWithoutLedger: [...BASELINE_RECONCILED_WITHOUT_LEDGER].sort(),
    pendingMigrations: (manifest.migrations || [])
      .filter(item => item?.database?.status === "pending")
      .map(item => item.version)
      .sort(compareVersions),
    readinessStatus: "BLOCKED",
    writesPerformed: false,
    approvalRequiredBeforeAnyApply: true
  };
}

export function validateOperatorApproval(apply, manifest, environment = process.env) {
  if (environment.ERP_ENVIRONMENT !== "development") {
    throw new Error("ERP_ENVIRONMENT must be explicitly set to development.");
  }
  if (environment.ERP_MIGRATION_BRANCH !== "development" ||
      environment.ERP_MIGRATION_BRANCH !== manifest?.snapshot?.branch) {
    throw new Error("ERP_MIGRATION_BRANCH must match the pinned Development branch.");
  }
  if (!manifest?.snapshot?.branchId ||
      environment.ERP_MIGRATION_BRANCH_ID !== manifest.snapshot.branchId) {
    throw new Error("ERP_MIGRATION_BRANCH_ID must exactly match the pinned Neon Development branch ID in db/migration-integrity.json.");
  }
  if (apply && environment.ERP_MIGRATIONS_APPROVED !== "YES") {
    throw new Error("Applying requires --apply and ERP_MIGRATIONS_APPROVED=YES.");
  }
}

async function verifyAppliedRows({ manifest, migrations, ledgerRows }) {
  const lineage = classifyLedgerLineage({ manifest, migrations, ledgerRows });
  if (lineage.blockers.length) {
    throw new Error("Existing database migration lineage is not safe to extend:\n" +
      lineage.blockers.map(item =>
        "- " + (item.version ? item.version + ": " : "") + (item.status || item)
      ).join("\n"));
  }

  const byVersion = new Map(migrations.map(migration => [migration.version, migration]));
  for (const row of ledgerRows) {
    const migration = byVersion.get(String(row.version));
    if (!migration) throw new Error("Ledger version " + row.version + " has no reviewed source.");

    if (lineage.type === "clean-install") {
      if (row.filename !== migration.filename || row.checksum !== migration.sha256) {
        throw new Error("Clean-install source checksum or filename mismatch for migration " + row.version + ".");
      }
      continue;
    }

    const history = migration.database?.historicalSource;
    let historicalBytes = null;
    if (history?.archivePath) {
      historicalBytes = await readFile(resolve(ROOT, ...history.archivePath.split("/")));
    }
    if (!verifyLedgerChecksum({
      migration,
      ledgerChecksum: row.checksum,
      currentBytes: migration.bytes,
      historicalBytes
    })) {
      throw new Error("Ledger checksum for migration " + row.version + " cannot be proven from the reviewed source.");
    }
  }

  return lineage.type;
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter(arg => !["--apply", "--check", "--reconcile-development-baseline"].includes(arg));
  if (unknown.length) throw new Error("Unknown argument(s): " + unknown.join(", "));
  if (["--apply", "--check", "--reconcile-development-baseline"].filter(flag => args.includes(flag)).length > 1) {
    throw new Error("Choose exactly one of --check, --apply, or --reconcile-development-baseline.");
  }

  const apply = args.includes("--apply");
  const reconcileBaseline = args.includes("--reconcile-development-baseline");
  const { manifest, summary, migrations } = await loadMigrationSources();

  // Pin branch identity and direct endpoint before opening any database socket.
  validateOperatorApproval(apply, manifest);
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required.");
  const connectionUrl = validateConnectionTarget(connectionString, manifest);
  const expectedDatabase = process.env.ERP_EXPECTED_DATABASE_NAME || EXPECTED_DATABASE_DEFAULT;
  const expectedRole = process.env.ERP_EXPECTED_DATABASE_ROLE || EXPECTED_ROLE_DEFAULT;

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000
  });
  let client;
  let locked = false;

  try {
    client = await pool.connect();
    const identity = await client.query(
      "SELECT current_database() AS database_name, current_user AS role_name, current_setting('server_version_num')::int AS server_version_num"
    );
    const target = identity.rows[0];
    if (target.database_name !== expectedDatabase) {
      throw new Error("Connected database is " + target.database_name + "; expected " + expectedDatabase + ".");
    }
    if (target.role_name !== expectedRole) {
      throw new Error("Connected role is " + target.role_name + "; expected migration owner " + expectedRole + ".");
    }
    if (target.server_version_num < 150000) {
      throw new Error("PostgreSQL 15 or later is required for this migration chain.");
    }

    await client.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_NAME]);
    locked = true;

    const ledgerPresence = await client.query(
      "SELECT to_regclass('public.app_schema_migrations') IS NOT NULL AS ledger_exists"
    );
    const ledgerExists = ledgerPresence.rows[0].ledger_exists === true;
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'app_schema_migrations' ORDER BY tablename"
    );
    const ledgerRows = ledgerExists
      ? (await client.query("SELECT version,filename,checksum,applied_at FROM public.app_schema_migrations ORDER BY version")).rows
      : [];

    if (reconcileBaseline) {
      const auditSql = await readFile(HISTORICAL_AUDIT_PATH, "utf8");
      const auditResult = await client.query(auditSql);
      const audit = auditResult.rows?.[0]?.historical_object_audit;
      const report = validateHistoricalBaselineAudit({ audit, ledgerRows, manifest });
      console.log("HISTORICAL DEVELOPMENT BASELINE: evidence checks passed; formal review is still required.");
      console.log("- Object checks: " + report.objectChecks + "/" + report.objectChecks + ".");
      console.log("- Ledger rows: " + report.ledgerRows + " exact matches to the pinned Development snapshot.");
      console.log("- Schema-present without ledger (never replay or fabricate rows): " + report.schemaPresentWithoutLedger.join(", ") + ".");
      console.log("- Pending migration(s): " + (report.pendingMigrations.join(", ") || "none") + ".");
      console.log("- Readiness remains " + report.readinessStatus + ".");
      console.log("- Read-only assessment: no schema, ledger, or application data was changed.");
      console.log("- This command does not grant apply permission. A separate reviewed approval is required before any migration can run.");
      return;
    }

    const databaseState = classifyDatabaseState({
      ledgerExists,
      ledgerRows,
      applicationTableCount: tables.rows.length
    });
    const plan = buildMigrationPlan({
      migrations,
      ledgerRows,
      freshInstall: databaseState === "fresh"
    });

    let lineageType = "fresh-install";
    if (databaseState === "existing") {
      lineageType = await verifyAppliedRows({ manifest, migrations, ledgerRows });
    }
    const initialLedgerCount = ledgerRows.length;

    console.log("Database migration preflight");
    console.log("- Database: " + target.database_name);
    console.log("- Endpoint host: " + connectionUrl.hostname);
    console.log("- Environment: development");
    console.log("- Target state: " + databaseState);
    console.log("- Ledger lineage: " + lineageType);
    console.log("- Public application tables: " + tables.rows.length);
    console.log("- Ledger rows: " + ledgerRows.length);
    console.log("- New migrations: " + plan.length);
    console.log("- Production is not a permitted target for this runner.");

    if (!apply) {
      console.log("CHECK ONLY: no schema changes or migration SQL were executed.");
      for (const item of plan) console.log("  pending " + item.version + " " + item.filename);
      return;
    }

    if (!ledgerExists) {
      await client.query("BEGIN");
      try {
        await client.query(
          "CREATE TABLE public.app_schema_migrations (" +
          "version TEXT PRIMARY KEY, " +
          "filename TEXT NOT NULL, " +
          "checksum TEXT NOT NULL, " +
          "applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
          ")"
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    for (const migration of plan) {
      console.log("Applying " + migration.version + " " + migration.filename);
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '5min'");
        // No values are supplied intentionally: node-postgres uses the simple-query
        // protocol for this script, allowing a complete multi-statement SQL file.
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO public.app_schema_migrations(version,filename,checksum) VALUES($1,$2,$3)",
          [migration.version, migration.filename, migration.sha256]
        );
        await client.query("COMMIT");
        console.log("  committed " + migration.version + " SHA-256 " + migration.sha256);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error("Migration " + migration.version + " rolled back: " + (error?.message || String(error)));
      }
    }

    const finalRows = await client.query(
      "SELECT version,filename,checksum FROM public.app_schema_migrations ORDER BY version"
    );
    verifyPostApplyLedger({
      initialLedgerRows: ledgerRows,
      plannedMigrations: plan,
      finalLedgerRows: finalRows.rows
    });
    console.log("SUCCESS: final migration ledger exactly matches the preflight rows plus every committed migration source.");
  } finally {
    if (locked && client) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_NAME]).catch(() => {});
    }
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error("DATABASE MIGRATION RUNNER FAILED");
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
