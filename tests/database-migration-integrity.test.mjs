import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verifyMigrationSources } from "../scripts/check-db-migrations.mjs";

test("repository migration sources match the reviewed integrity baseline", async () => {
  const result = await verifyMigrationSources();
  assert.deepEqual(result.errors, [], result.errors.join("\n"));
  assert.equal(result.summary.sourceFiles, 19);
  assert.equal(result.summary.appliedLedgerRows, 16);
  assert.equal(result.summary.schemaPresentWithoutLedger, 3);
  assert.equal(result.summary.nextMigrationVersion, "0020");
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
    migrations.push({
      filename,
      version,
      sha256: createHash("sha256").update(content, "utf8").digest("hex"),
      database: {
        status: "applied_checksum_verified",
        ledgerChecksum: createHash("sha256").update(content, "utf8").digest("hex"),
        appliedAt: "2026-11-07T00:00:00Z"
      }
    });
  }
  const manifestPath = join(root, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
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
  }, null, 2));
  return { migrationsDir, manifestPath };
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
