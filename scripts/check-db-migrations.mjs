import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MIGRATIONS_DIR = resolve(REPO_ROOT, "db/migrations");
const DEFAULT_MANIFEST_PATH = resolve(REPO_ROOT, "db/migration-integrity.json");
const FILE_PATTERN = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/;
const HISTORY_PATH_PATTERN = /^db\/migration-history\/[a-z0-9][a-z0-9_-]*\.sql$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SHA1_PATTERN = /^[a-f0-9]{40}$/;

const DATABASE_STATES = new Set([
  "applied_checksum_verified",
  "applied_git_blob_verified",
  "applied_content_sha1_verified",
  "applied_historical_source_recovered",
  "applied_historical_source_unexecutable",
  "applied_legacy_unverified",
  "applied_reconstructed_source",
  "applied_source_unverified",
  "schema_present_without_ledger",
  "pending"
]);

const READINESS_BLOCKERS = new Set([
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

function addError(errors, message) {
  errors.push(message);
}

async function verifyHistoricalSource(item, repoRoot, errors) {
  const db = item.database;
  const historical = db.historicalSource;

  if (!historical || !HISTORY_PATH_PATTERN.test(historical.archivePath || "")) {
    addError(errors, "Migration " + item.version + " has an invalid historical source archive path.");
    return;
  }
  if (!SHA256_PATTERN.test(historical.archiveSha256 || "")) {
    addError(errors, "Migration " + item.version + " has an invalid historical archive SHA-256.");
    return;
  }
  if (!SHA1_PATTERN.test(historical.gitBlobSha1 || "") ||
      historical.gitBlobSha1 !== db.ledgerChecksum) {
    addError(errors, "Migration " + item.version + " historical Git blob SHA-1 does not match the ledger checksum.");
    return;
  }
  if (!SHA1_PATTERN.test(historical.sourceCommit || "") ||
      typeof historical.originalPath !== "string" ||
      !historical.originalPath.startsWith("db/migrations/")) {
    addError(errors, "Migration " + item.version + " is missing valid Git provenance for its historical source.");
    return;
  }

  let bytes;
  try {
    bytes = await readFile(resolve(repoRoot, ...historical.archivePath.split("/")));
  } catch (error) {
    addError(errors, "Cannot read historical source for migration " + item.version + ": " + error.message);
    return;
  }

  if (sha256(bytes) !== historical.archiveSha256) {
    addError(errors, "Historical source SHA-256 mismatch for migration " + item.version + ".");
  }
  if (gitBlobSha1(bytes) !== historical.gitBlobSha1) {
    addError(errors, "Historical source Git blob SHA-1 mismatch for migration " + item.version + ".");
  }

  if (db.status === "applied_historical_source_recovered" && historical.executable !== true) {
    addError(errors, "Migration " + item.version + " must identify the recovered historical source as executable.");
  }
  if (db.status === "applied_historical_source_unexecutable") {
    if (historical.executable !== false || typeof historical.note !== "string" || !historical.note.trim()) {
      addError(errors, "Migration " + item.version + " must explicitly document why its historical source is not executable evidence.");
    }
  }
}

export async function verifyMigrationSources({
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  manifestPath = DEFAULT_MANIFEST_PATH,
  repoRoot = REPO_ROOT
} = {}) {
  const errors = [];
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    return { errors: ["Cannot read migration integrity manifest: " + error.message], summary: null };
  }

  if (manifest.schemaVersion !== 1) addError(errors, "Unsupported migration manifest schemaVersion.");
  if (manifest.hashAlgorithm !== "sha256") addError(errors, "Migration manifest must use sha256.");
  if (manifest.snapshot?.branch !== "development" || manifest.snapshot?.readOnly !== true) {
    addError(errors, "The recorded database snapshot must be explicitly read-only Neon Development.");
  }
  // Keep two distinct facts when a Production cutover has occurred:
  // the cutover history is retained, while the Development-only baseline
  // reconciliation must explicitly attest that it did not write to Production.
  if (typeof manifest.snapshot?.productionModified !== "boolean") {
    addError(errors, "The manifest must explicitly record whether Production has been modified.");
  }
  if (manifest.snapshot?.productionModified === true &&
      manifest.snapshot?.productionModifiedByDevelopmentBaselineReconciliation !== false) {
    addError(errors, "The manifest must explicitly attest that Development baseline reconciliation did not modify Production.");
  }
  if (manifest.snapshot?.productionModified === false &&
      manifest.snapshot?.productionModifiedByDevelopmentBaselineReconciliation === true) {
    addError(errors, "The manifest cannot claim Development baseline reconciliation modified an untouched Production database.");
  }

  const baseline = manifest.baselineReconciliation;
  const expectedLedgerExceptions = ["0006", "0008", "0009", "0017", "0018"];
  const expectedSchemaSatisfied = ["0012", "0013", "0014", "0020"];
  const expectedSchemaAlignment = [
    "invoice_unit_cost_usd",
    "purchase_order_exchange_rate",
    "notification_billing_target",
    "purchase_order_rejection_reason"
  ];
  let baselineApproved = false;
  if (baseline) {
    const sameList = (actual, expected) =>
      Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected);
    if (baseline.schemaVersion !== 1 || baseline.status !== "approved" ||
        baseline.scope !== "development-only; never applies to clean installs or Production" ||
        baseline.branch !== manifest.snapshot?.branch ||
        baseline.branchId !== manifest.snapshot?.branchId ||
        baseline.database !== manifest.snapshot?.database ||
        baseline.requiresLiveAuditBeforeApply !== true ||
        !sameList(baseline.ledgerExceptions, expectedLedgerExceptions) ||
        !sameList(baseline.schemaSatisfiedWithoutLedger, expectedSchemaSatisfied) ||
        baseline.auditObjectCount !== 55 || baseline.auditMigrationCount !== 11 ||
        !sameList(baseline.auditSchemaAlignment, expectedSchemaAlignment) ||
        typeof baseline.approvedAt !== "string" ||
        typeof baseline.approvedBy !== "string" ||
        typeof baseline.approvalReference !== "string" ||
        !baseline.approvalReference.trim()) {
      addError(errors, "Development baseline reconciliation attestation is incomplete or does not match the reviewed exception set.");
    } else {
      baselineApproved = true;
    }
    const baselineEntries = Array.isArray(manifest.migrations) ? manifest.migrations : [];
    for (const version of expectedLedgerExceptions) {
      const item = baselineEntries.find(entry => entry?.version === version);
      if (!item || !READINESS_BLOCKERS.has(item.database?.status) ||
          !item.database?.ledgerChecksum || !item.database?.appliedAt) {
        addError(errors, "Approved ledger exception " + version + " must retain its observed checksum and applied_at.");
        baselineApproved = false;
      }
    }
    for (const version of expectedSchemaSatisfied) {
      const item = baselineEntries.find(entry => entry?.version === version);
      if (!item || item.database?.status !== "schema_present_without_ledger" ||
          item.database?.ledgerChecksum || item.database?.appliedAt ||
          !Array.isArray(item.database?.objectsVerified) || !item.database.objectsVerified.length) {
        addError(errors, "Approved schema-satisfied version " + version + " must remain explicitly unregistered and retain object evidence.");
        baselineApproved = false;
      }
    }
  }

  let actualFiles = [];
  try {
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    actualFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
      .map(entry => entry.name).sort();
  } catch (error) {
    addError(errors, "Cannot read migration directory: " + error.message);
  }

  const manifestMigrations = Array.isArray(manifest.migrations) ? manifest.migrations : [];
  const manifestByName = new Map();
  const manifestVersions = new Map();

  for (const item of manifestMigrations) {
    if (!item || typeof item.filename !== "string") {
      addError(errors, "Manifest contains a migration entry without a filename.");
      continue;
    }
    if (manifestByName.has(item.filename)) {
      addError(errors, "Duplicate filename in integrity manifest: " + item.filename);
    }
    manifestByName.set(item.filename, item);
    if (manifestVersions.has(item.version)) {
      addError(errors, "Duplicate version in integrity manifest: " + item.version);
    }
    manifestVersions.set(item.version, item.filename);
  }

  const actualSet = new Set(actualFiles);
  const manifestSet = new Set(manifestByName.keys());
  for (const filename of actualFiles) {
    if (!manifestSet.has(filename)) addError(errors, "Unpinned migration source: " + filename);
  }
  for (const filename of manifestSet) {
    if (!actualSet.has(filename)) addError(errors, "Manifest references a missing migration source: " + filename);
  }

  const seenVersions = new Map();
  const parsed = [];
  for (const filename of actualFiles) {
    const match = FILE_PATTERN.exec(filename);
    if (!match) {
      addError(errors, "Invalid migration filename (expected NNNN_description.sql): " + filename);
      continue;
    }
    const version = match[1];
    if (seenVersions.has(version)) {
      addError(errors, "Duplicate migration version " + version + ": " + seenVersions.get(version) + " and " + filename);
    }
    seenVersions.set(version, filename);
    parsed.push({ filename, version });
  }

  parsed.sort((a, b) => a.version.localeCompare(b.version));
  for (let index = 0; index < parsed.length; index += 1) {
    const expected = String(index + 1).padStart(4, "0");
    if (parsed[index].version !== expected) {
      addError(errors, "Migration sequence gap: expected " + expected + ", found " + parsed[index].version + ".");
    }
  }

  for (const { filename, version } of parsed) {
    const item = manifestByName.get(filename);
    if (!item) continue;
    if (item.version !== version) {
      addError(errors, "Version mismatch for " + filename + ": manifest says " + item.version + ", filename says " + version + ".");
    }
    if (!SHA256_PATTERN.test(item.sha256 || "")) {
      addError(errors, "Invalid SHA-256 in manifest for " + filename + ".");
      continue;
    }

    let bytes;
    try {
      bytes = await readFile(resolve(migrationsDir, filename));
    } catch (error) {
      addError(errors, "Cannot read " + filename + ": " + error.message);
      continue;
    }
    const sourceSha256 = sha256(bytes);
    if (sourceSha256 !== item.sha256) {
      addError(errors, "Source checksum mismatch for " + filename + ": expected " + item.sha256 + ", got " + sourceSha256 + ". Review the SQL before changing its manifest entry.");
    }

    const db = item.database;
    if (!db || !DATABASE_STATES.has(db.status)) {
      addError(errors, "Missing or unsupported database status for " + filename + ".");
      continue;
    }

    if (db.status === "applied_checksum_verified") {
      if (!SHA256_PATTERN.test(db.ledgerChecksum || "") || db.ledgerChecksum !== item.sha256) {
        addError(errors, "Verified migration " + version + " must have a ledger SHA-256 equal to its source SHA-256.");
      }
      if (!db.appliedAt) addError(errors, "Applied migration " + version + " is missing appliedAt.");
    } else if (db.status === "applied_git_blob_verified") {
      if (!SHA1_PATTERN.test(db.ledgerChecksum || "") || gitBlobSha1(bytes) !== db.ledgerChecksum) {
        addError(errors, "Migration " + version + " ledger checksum does not match the current Git blob SHA-1.");
      }
      if (!db.appliedAt) addError(errors, "Applied migration " + version + " is missing appliedAt.");
    } else if (db.status === "applied_content_sha1_verified") {
      if (!SHA1_PATTERN.test(db.ledgerChecksum || "") || sha1(bytes) !== db.ledgerChecksum) {
        addError(errors, "Migration " + version + " ledger checksum does not match SHA-1 of the current source bytes.");
      }
      if (!db.appliedAt) addError(errors, "Applied migration " + version + " is missing appliedAt.");
    } else if (db.status === "applied_historical_source_recovered" ||
               db.status === "applied_historical_source_unexecutable") {
      if (!db.appliedAt || typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, "Migration " + version + " needs appliedAt and a historical-source reconciliation note.");
      }
      await verifyHistoricalSource(item, repoRoot, errors);
    } else if (db.status === "applied_legacy_unverified") {
      if (!SHA1_PATTERN.test(db.ledgerChecksum || "")) {
        addError(errors, "Legacy migration " + version + " must retain its 40-character observed ledger checksum.");
      }
      if (!db.appliedAt || typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, "Legacy migration " + version + " needs appliedAt and a reconciliation note.");
      }
    } else if (db.status === "applied_reconstructed_source" || db.status === "applied_source_unverified") {
      if (!SHA256_PATTERN.test(db.ledgerChecksum || "") || db.ledgerChecksum === item.sha256) {
        addError(errors, "Migration " + version + " must document a distinct observed 64-character ledger checksum.");
      }
      if (!db.appliedAt || typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, "Migration " + version + " needs appliedAt and a reconciliation note.");
      }
    } else if (db.status === "schema_present_without_ledger") {
      if (db.ledgerChecksum || db.appliedAt) {
        addError(errors, "Unregistered migration " + version + " must not invent a ledger checksum or appliedAt.");
      }
      if (!Array.isArray(db.objectsVerified) || db.objectsVerified.length === 0) {
        addError(errors, "Unregistered migration " + version + " must list its observed schema objects.");
      }
      if (typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, "Unregistered migration " + version + " must include a safety note.");
      }
    } else if (db.status === "pending") {
      if (db.ledgerChecksum || db.appliedAt) {
        addError(errors, "Pending migration " + version + " must not claim an existing ledger row.");
      }
      if (typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, "Pending migration " + version + " must include a review note.");
      }
    }
  }

  const appliedVersions = manifestMigrations
    .filter(item => item?.database?.status?.startsWith("applied_"))
    .map(item => item.version).sort();
  const snapshotVersions = Array.isArray(manifest.snapshot?.ledgerVersions)
    ? [...manifest.snapshot.ledgerVersions].sort()
    : [];
  if (JSON.stringify(appliedVersions) !== JSON.stringify(snapshotVersions)) {
    addError(errors, "Manifest applied migration states do not match snapshot.ledgerVersions.");
  }
  if (manifest.snapshot?.ledgerRows !== appliedVersions.length) {
    addError(errors, "snapshot.ledgerRows does not match the applied migration count.");
  }

  const lastVersion = parsed.at(-1)?.version;
  const calculatedNextVersion = lastVersion ? String(Number(lastVersion) + 1).padStart(4, "0") : null;
  if (manifest.nextMigrationVersion !== calculatedNextVersion) {
    addError(errors, "nextMigrationVersion should be " + (calculatedNextVersion || "(unknown)") + ", not " + manifest.nextMigrationVersion + ".");
  }

  const approvedLedgerExceptions = new Set(baselineApproved ? baseline.ledgerExceptions : []);
  const approvedSchemaSatisfied = new Set(baselineApproved ? baseline.schemaSatisfiedWithoutLedger : []);
  const readinessBlockers = manifestMigrations
    .filter(item => {
      if (!READINESS_BLOCKERS.has(item?.database?.status)) return false;
      if (item.database.status === "schema_present_without_ledger") {
        return !approvedSchemaSatisfied.has(item.version);
      }
      return !approvedLedgerExceptions.has(item.version);
    })
    .map(item => ({ version: item.version, status: item.database.status }))
    .sort((a, b) => a.version.localeCompare(b.version));
  const approvedBaselineExceptionCount = baselineApproved
    ? approvedLedgerExceptions.size + approvedSchemaSatisfied.size
    : 0;
  const pendingMigrations = manifestMigrations
    .filter(item => item?.database?.status === "pending")
    .map(item => item.version)
    .sort();
  const historicalSourcesVerified = manifestMigrations
    .filter(item => item?.database?.status === "applied_historical_source_recovered")
    .length;

  return {
    errors,
    summary: {
      sourceFiles: actualFiles.length,
      appliedLedgerRows: appliedVersions.length,
      schemaPresentWithoutLedger: manifestMigrations.filter(item => item?.database?.status === "schema_present_without_ledger").length,
      historicalChecksumExceptions: readinessBlockers.length,
      historicalSourcesVerified,
      pendingMigrations,
      readinessStatus: readinessBlockers.length ? "BLOCKED" : approvedBaselineExceptionCount ? "READY_WITH_APPROVED_BASELINE_EXCEPTIONS" : "READY",
      readinessBlockers,
      approvedBaselineExceptions: approvedBaselineExceptionCount,
      nextMigrationVersion: calculatedNextVersion
    }
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const requireReady = process.argv.includes("--require-ready");
  const result = await verifyMigrationSources();

  if (result.errors.length) {
    console.error("FAIL: Database migration source-integrity gate");
    for (const error of result.errors) console.error("- " + error);
    process.exitCode = 1;
  } else {
    const s = result.summary;
    console.log("PASS: Database migration source-integrity gate");
    console.log("- " + s.sourceFiles + " SQL sources are named, ordered and checksum-pinned (SHA-256).");
    console.log("- Neon Development snapshot: " + s.appliedLedgerRows + " ledger rows; " + s.schemaPresentWithoutLedger + " schema-present versions without ledger rows.");
    console.log("- " + s.historicalSourcesVerified + " historical source artifact(s) recovered and hash-verified.");
    console.log("- Next source filename: " + s.nextMigrationVersion + "; this does not authorize applying it.");
    console.log("- Database readiness: " + s.readinessStatus + " (" + s.readinessBlockers.length + " blocking issue(s); " + (s.approvedBaselineExceptions || 0) + " approved baseline exception(s)).");
    for (const blocker of s.readinessBlockers) {
      console.log("  - " + blocker.version + ": " + blocker.status);
    }
    if (s.pendingMigrations.length) {
      console.log("- Pending, not-yet-applied migrations: " + s.pendingMigrations.join(", ") + ".");
    }
    console.log("- Offline source check only: no database connection or SQL is executed.");
    if (requireReady && s.readinessBlockers.length) {
      console.error("BLOCKED: do not apply new migrations until historical reconciliation is complete.");
      process.exitCode = 2;
    }
  }
}
