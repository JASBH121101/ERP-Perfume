import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("0020 is an additive schema reconciliation, not a historical rewrite", async () => {
  const sql = await readFile(resolve("db/migrations/0020_align_clean_install_schema.sql"), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS unit_cost_usd NUMERIC\(14,4\) NOT NULL DEFAULT 0/i);
  assert.match(sql, /ALTER COLUMN exchange_rate TYPE NUMERIC\(14,6\)/i);
  assert.match(sql, /'billing'/i);
  assert.match(sql, /length\(btrim\(COALESCE\(rejection_reason, ''\)\)\) BETWEEN 5 AND 300/i);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS purchase_orders_rejection_audit_check/i);
  assert.doesNotMatch(sql, /\b(TRUNCATE|DROP TABLE|DELETE FROM)\b/i);
});
