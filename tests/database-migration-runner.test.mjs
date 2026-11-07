import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMigrationPlan,
  classifyDatabaseState,
  verifyLedgerChecksum
} from "../scripts/migrate-db.mjs";
import { createHash } from "node:crypto";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobSha1(bytes) {
  return createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex");
}

test("fresh database requires no pre-existing application tables or ledger rows", () => {
  assert.equal(classifyDatabaseState({
    ledgerExists: false,
    ledgerRows: [],
    applicationTableCount: 0
  }), "fresh");
  assert.throws(() => classifyDatabaseState({
    ledgerExists: false,
    ledgerRows: [],
    applicationTableCount: 3
  }), /baseline/i);
});

test("an empty ledger is not accepted when application tables already exist", () => {
  assert.throws(() => classifyDatabaseState({
    ledgerExists: true,
    ledgerRows: [],
    applicationTableCount: 38
  }), /empty/i);
});

test("migration plan includes every source on a clean install", () => {
  const migrations = [
    { version: "0001", filename: "0001_initial.sql" },
    { version: "0002", filename: "0002_next.sql" }
  ];
  assert.deepEqual(buildMigrationPlan({ migrations, ledgerRows: [], freshInstall: true }), migrations);
});

test("migration plan skips exact ledgered versions and leaves only pending sources", () => {
  const migrations = [
    { version: "0001", filename: "0001_initial.sql" },
    { version: "0002", filename: "0002_next.sql" }
  ];
  const ledgerRows = [{
    version: "0001",
    filename: "0001_initial.sql",
    checksum: "sha"
  }];
  assert.deepEqual(
    buildMigrationPlan({ migrations, ledgerRows, freshInstall: false }).map(item => item.version),
    ["0002"]
  );
});

test("migration plan rejects unknown or renamed ledger entries", () => {
  const migrations = [{ version: "0001", filename: "0001_initial.sql" }];
  assert.throws(() => buildMigrationPlan({
    migrations,
    ledgerRows: [{ version: "0009", filename: "0009_missing.sql" }],
    freshInstall: false
  }), /untracked/i);
  assert.throws(() => buildMigrationPlan({
    migrations,
    ledgerRows: [{ version: "0001", filename: "renamed.sql" }],
    freshInstall: false
  }), /filename mismatch/i);
});

test("checksum verifier recognizes only explicit source provenance strategies", () => {
  const bytes = Buffer.from("SELECT 1;\n");
  const checksum = sha256(bytes);
  const gitChecksum = gitBlobSha1(bytes);
  const contentSha1 = createHash("sha1").update(bytes).digest("hex");
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_checksum_verified" } },
    ledgerChecksum: checksum,
    currentBytes: bytes
  }), true);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_git_blob_verified" } },
    ledgerChecksum: gitChecksum,
    currentBytes: bytes
  }), true);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_content_sha1_verified" } },
    ledgerChecksum: contentSha1,
    currentBytes: bytes
  }), true);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_legacy_unverified" } },
    ledgerChecksum: contentSha1,
    currentBytes: bytes
  }), false);
  assert.equal(verifyLedgerChecksum({
    migration: { sha256: checksum, database: { status: "applied_checksum_verified" } },
    ledgerChecksum: "wrong",
    currentBytes: bytes
  }), false);
});
