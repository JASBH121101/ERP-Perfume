import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("0022 creates purchase_code before reading it to seed its sequence", async () => {
  const sql = await readFile(
    resolve("db/migrations/0022_staged_purchase_receipts_and_journal.sql"),
    "utf8"
  );
  const column = sql.indexOf("ADD COLUMN IF NOT EXISTS purchase_code BIGINT");
  const sequence = sql.indexOf("CREATE SEQUENCE IF NOT EXISTS public.purchase_code_seq");
  const seed = sql.indexOf("SELECT setval(\\n  'public.purchase_code_seq'");
  assert.ok(column >= 0, "purchase_code column must be added");
  assert.ok(sequence > column, "purchase_code sequence must be created after the column");
  assert.ok(seed > sequence, "purchase_code sequence must be seeded after it is created");
  assert.doesNotMatch(sql, /\\b(DROP TABLE|TRUNCATE|DELETE FROM)\\b/i);
});

test("0022 keeps staged receipt and immutable journal protections", async () => {
  const sql = await readFile(
    resolve("db/migrations/0022_staged_purchase_receipts_and_journal.sql"),
    "utf8"
  );
  assert.match(sql, /document_status IN \\(\'Emitida\',\'Contabilizada\',\'Anulada\'\\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public.purchase_journal_entries/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public.purchase_journal_lines/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public.purchase_journal_entries/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON public.purchase_journal_lines/);
});
