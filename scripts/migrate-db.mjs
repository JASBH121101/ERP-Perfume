import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { verifyMigrationSources } from "./check-db-migrations.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = resolve(ROOT, "db/migrations");
const MANIFEST_PATH = resolve(ROOT, "db/migration-integrity.json");
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

function validateConnectionTarget(connectionString) {
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
  const expectedHost = process.env.ERP_EXPECTED_NEON_ENDPOINT_HOST;
  if (!expectedHost || expectedHost.toLowerCase() !== url.hostname.toLowerCase()) {
    throw new Error("Set ERP_EXPECTED_NEON_ENDPOINT_HOST to the exact Development endpoint host shown in Neon Console.");
  }
  return url;
}

function validateOperatorApproval(apply) {
  if (process.env.ERP_ENVIRONMENT !== "development") {
    throw new Error("ERP_ENVIRONMENT must be explicitly set to development.");
  }
  if (process.env.ERP_MIGRATION_BRANCH !== "development") {
    throw new Error("ERP_MIGRATION_BRANCH must be explicitly set to development.");
  }
  if (apply && process.env.ERP_MIGRATIONS_APPROVED !== "YES") {
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
  const unknown = args.filter(arg => !["--apply", "--check"].includes(arg));
  if (unknown.length) throw new Error("Unknown argument(s): " + unknown.join(", "));
  if (args.includes("--apply") && args.includes("--check")) {
    throw new Error("Choose either --check or --apply, not both.");
  }

  const apply = args.includes("--apply");
  validateOperatorApproval(apply);

  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required.");
  const connectionUrl = validateConnectionTarget(connectionString);

  const { manifest, summary, migrations } = await loadMigrationSources();
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
    const expectedLedgerCount = initialLedgerCount + plan.length;
    if (finalRows.rows.length !== expectedLedgerCount) {
      throw new Error("Post-apply ledger count mismatch: expected " + expectedLedgerCount + ", got " + finalRows.rows.length + ".");
    }
    console.log("SUCCESS: all source migrations are recorded in app_schema_migrations.");
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
