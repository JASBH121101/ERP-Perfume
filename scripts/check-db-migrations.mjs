import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MIGRATIONS_DIR = resolve(REPO_ROOT, "db/migrations");
const DEFAULT_MANIFEST_PATH = resolve(REPO_ROOT, "db/migration-integrity.json");
const FILE_PATTERN = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const LEGACY_HASH_PATTERN = /^[a-f0-9]{40}$/;

const DATABASE_STATES = new Set([
  "applied_checksum_verified",
  "applied_legacy_unverified",
  "applied_reconstructed_source",
  "applied_source_unverified",
  "schema_present_without_ledger"
]);

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function addError(errors, message) {
  errors.push(message);
}

export async function verifyMigrationSources({
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  manifestPath = DEFAULT_MANIFEST_PATH
} = {}) {
  const errors = [];
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    return {
      errors: [`Cannot read migration integrity manifest: ${error.message}`],
      summary: null
    };
  }

  if (manifest.schemaVersion !== 1) {
    addError(errors, "Unsupported db/migration-integrity.json schemaVersion.");
  }
  if (manifest.hashAlgorithm !== "sha256") {
    addError(errors, "Migration manifest must use sha256.");
  }
  if (manifest.snapshot?.branch !== "development" || manifest.snapshot?.readOnly !== true) {
    addError(errors, "The recorded database snapshot must be explicitly read-only Neon Development.");
  }
  if (manifest.snapshot?.productionModified !== false) {
    addError(errors, "The manifest must explicitly record that Production was not modified.");
  }

  let actualFiles = [];
  try {
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    actualFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
      .map(entry => entry.name).sort();
  } catch (error) {
    addError(errors, `Cannot read migration directory: ${error.message}`);
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
      addError(errors, `Duplicate filename in integrity manifest: ${item.filename}`);
    }
    manifestByName.set(item.filename, item);
    if (manifestVersions.has(item.version)) {
      addError(errors, `Duplicate version in integrity manifest: ${item.version}`);
    }
    manifestVersions.set(item.version, item.filename);
  }

  const actualSet = new Set(actualFiles);
  const manifestSet = new Set(manifestByName.keys());
  for (const filename of actualFiles) {
    if (!manifestSet.has(filename)) addError(errors, `Unpinned migration source: ${filename}`);
  }
  for (const filename of manifestSet) {
    if (!actualSet.has(filename)) addError(errors, `Manifest references a missing migration source: ${filename}`);
  }

  const seenVersions = new Map();
  const parsed = [];
  for (const filename of actualFiles) {
    const match = FILE_PATTERN.exec(filename);
    if (!match) {
      addError(errors, `Invalid migration filename (expected NNNN_description.sql): ${filename}`);
      continue;
    }
    const version = match[1];
    if (seenVersions.has(version)) {
      addError(errors, `Duplicate migration version ${version}: ${seenVersions.get(version)} and ${filename}`);
    }
    seenVersions.set(version, filename);
    parsed.push({ filename, version });
  }

  parsed.sort((a, b) => a.version.localeCompare(b.version));
  for (let index = 0; index < parsed.length; index += 1) {
    const expected = String(index + 1).padStart(4, "0");
    if (parsed[index].version !== expected) {
      addError(errors, `Migration sequence gap: expected ${expected}, found ${parsed[index].version}.`);
    }
  }

  for (const { filename, version } of parsed) {
    const item = manifestByName.get(filename);
    if (!item) continue;
    if (item.version !== version) {
      addError(errors, `Version mismatch for ${filename}: manifest says ${item.version}, filename says ${version}.`);
    }
    if (!HASH_PATTERN.test(item.sha256 || "")) {
      addError(errors, `Invalid SHA-256 in manifest for ${filename}.`);
      continue;
    }

    let bytes;
    try {
      bytes = await readFile(resolve(migrationsDir, filename));
    } catch (error) {
      addError(errors, `Cannot read ${filename}: ${error.message}`);
      continue;
    }
    const actualHash = hashBytes(bytes);
    if (actualHash !== item.sha256) {
      addError(errors, `Source checksum mismatch for ${filename}: expected ${item.sha256}, got ${actualHash}. Update the manifest only after reviewing the migration change.`);
    }

    const db = item.database;
    if (!db || !DATABASE_STATES.has(db.status)) {
      addError(errors, `Missing or unsupported database status for ${filename}.`);
      continue;
    }

    if (db.status === "applied_checksum_verified") {
      if (!HASH_PATTERN.test(db.ledgerChecksum || "") || db.ledgerChecksum !== item.sha256) {
        addError(errors, `Verified migration ${version} must have a ledger SHA-256 equal to its source SHA-256.`);
      }
      if (!db.appliedAt) addError(errors, `Applied migration ${version} is missing appliedAt.`);
    } else if (db.status === "applied_legacy_unverified") {
      if (!LEGACY_HASH_PATTERN.test(db.ledgerChecksum || "")) {
        addError(errors, `Legacy migration ${version} must retain its 40-character observed ledger checksum.`);
      }
      if (!db.appliedAt) addError(errors, `Applied migration ${version} is missing appliedAt.`);
    } else if (db.status === "applied_reconstructed_source" || db.status === "applied_source_unverified") {
      if (!HASH_PATTERN.test(db.ledgerChecksum || "") || db.ledgerChecksum === item.sha256) {
        addError(errors, `Migration ${version} must document a distinct observed 64-character ledger checksum.`);
      }
      if (!db.appliedAt || typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, `Migration ${version} needs appliedAt and a reconciliation note.`);
      }
    } else if (db.status === "schema_present_without_ledger") {
      if (db.ledgerChecksum || db.appliedAt) {
        addError(errors, `Unregistered migration ${version} must not invent a ledger checksum or appliedAt.`);
      }
      if (!Array.isArray(db.objectsVerified) || db.objectsVerified.length === 0) {
        addError(errors, `Unregistered migration ${version} must list its observed schema objects.`);
      }
      if (typeof db.note !== "string" || !db.note.trim()) {
        addError(errors, `Unregistered migration ${version} must include a safety note.`);
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
    addError(errors, `nextMigrationVersion should be ${calculatedNextVersion || "(unknown)"}, not ${manifest.nextMigrationVersion}.`);
  }

  const unregisteredCount = manifestMigrations.filter(item =>
    item?.database?.status === "schema_present_without_ledger"
  ).length;
  const exceptionCount = manifestMigrations.filter(item =>
    item?.database?.status !== "applied_checksum_verified" &&
    item?.database?.status !== "schema_present_without_ledger"
  ).length;

  return {
    errors,
    summary: {
      sourceFiles: actualFiles.length,
      appliedLedgerRows: appliedVersions.length,
      schemaPresentWithoutLedger: unregisteredCount,
      historicalChecksumExceptions: exceptionCount,
      nextMigrationVersion: calculatedNextVersion
    }
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = await verifyMigrationSources();
  if (result.errors.length) {
    console.error("FAIL: Database migration integrity gate");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    const s = result.summary;
    console.log("PASS: Database migration integrity gate");
    console.log(`- ${s.sourceFiles} SQL sources are named, ordered and checksum-pinned (SHA-256).`);
    console.log(`- Neon Development snapshot: ${s.appliedLedgerRows} ledger rows; ${s.schemaPresentWithoutLedger} schema-present versions without ledger rows.`);
    console.log(`- ${s.historicalChecksumExceptions} historical checksum exceptions are explicitly recorded; they are not cleared for replay.`);
    console.log(`- Next source filename: ${s.nextMigrationVersion}; this does not authorize applying it.`);
    console.log("- Offline check only: no database connection or SQL is executed.");
  }
}
