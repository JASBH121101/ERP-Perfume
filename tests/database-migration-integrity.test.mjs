import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verifyMigrationSources } from "../scripts/check-db-migrations.mjs";

test("repository migration sources match the reviewed integrity baseline", async () => {
  const result = await verifyMigrationSources();
  assert.deepEqual(result.errors, [], result.errors.join("\n"));
  assert.equal(result.summary.sourceFiles, 20);
  assert.equal(result.summary.appliedLedgerRows, 16);
  assert.equal(result.summary.schemaPresentWithoutLedger, 3);
  assert.equal(result.summary.historicalSourcesVerified, 3);
  assert.equal(result.summary.readinessStatus, "BLOCKED");
  assert.deepEqual(
    result.summary.readinessBlockers.map(item => item.version),
    ["0006", "0008", "0009", "0012", "0013", "0014", "0017", "0018"]
  );
  assert.equal(result.summary.nextMigrationVersion, "0021");
  assert.deepEqual(result.summary.pendingMigrations, ["0020"]);
});

async function createFixture(t, namesAndContents) {
  const root = await mkdtemp(join(tmpdir(), "erp-migration-gate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const migrationsDir = join(root, "migrations");
  await mkdir(migrationsDir);
  const migrations = [];
  for (const [filename, content] of namesAndContents) {
    await writeFile(join(migrationsDir, filename), content, "utf8");
    const version = filename.slice(0, 4);
    const checksum = createHash("sha256").update(content, "utf8").digest("hex");
    migrations.push({
      filename,
      version,
      sha256: checksum,
      database: {
        status: "applied_checksum_verified",
        ledgerChecksum: checksum,
        appliedAt: "2026-11-07T00:00:00Z"
      }
    });
  }
  const manifestPath = join(root, "manifest.json");
  const manifest = {
    schemaVersion: 1,
    hashAlgorithm: "sha256",
    snapshot: {
      branch: "development",
      readOnly: true,
      productionModified: false,
      ledgerRows: migrations.length,
      ledgerVersions: migrations.map(item => item.version)
    },
    nextMigrationVersion: String(Number(migrations.at(-1)?.version || "0000") + 1).padStart(4, "0"),
    migrations
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { root, migrationsDir, manifestPath };
}

test("rejects source bytes that drift from the pinned SHA-256", async (t) => {
  const fixture = await createFixture(t, [["0001_initial.sql", "SELECT 1;"]]);
  await writeFile(join(fixture.migrationsDir, "0001_initial.sql"), "SELECT 2;", "utf8");
  const result = await verifyMigrationSources(fixture);
  assert.ok(result.errors.some(message => message.includes("Source checksum mismatch")));
});

test("rejects a gap in migration numbering", async (t) => {
  const fixture = await createFixture(t, [
    ["0001_initial.sql", "SELECT 1;"],
    ["0003_followup.sql", "SELECT 3;"]
  ]);
  const result = await verifyMigrationSources(fixture);
  assert.ok(result.errors.some(message => message.includes("Migration sequence gap")));
});

test("accepts a pending migration without inventing a ledger row", async (t) => {
  const fixture = await createFixture(t, [["0001_initial.sql", "SELECT 1;"]]);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
  manifest.migrations[0].database = {
    status: "pending",
    note: "Reviewed source; not applied to any database."
  };
  manifest.snapshot.ledgerRows = 0;
  manifest.snapshot.ledgerVersions = [];
  await writeFile(fixture.manifestPath, JSON.stringify(manifest, null, 2));
  const result = await verifyMigrationSources(fixture);
  assert.deepEqual(result.errors, [], result.errors.join("\n"));
  assert.deepEqual(result.summary.pendingMigrations, ["0001"]);
  assert.equal(result.summary.appliedLedgerRows, 0);
});
