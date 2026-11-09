import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

test("0023 adds supporting indexes for the six live-audited foreign-key paths", async () => {
  const sql = await readFile(
    resolve("db/migrations/0023_supporting_foreign_key_indexes.sql"),
    "utf8"
  );
  const indexes = [
    ["app_users_role_template_key_idx", "app_users", "role_template_key"],
    ["purchase_journal_entries_created_by_idx", "purchase_journal_entries", "created_by"],
    ["purchase_orders_approved_by_idx", "purchase_orders", "approved_by"],
    ["purchase_orders_rejected_by_idx", "purchase_orders", "rejected_by"],
    ["purchase_receipts_emitted_by_idx", "purchase_receipts", "emitted_by"],
    ["purchase_receipts_posted_by_idx", "purchase_receipts", "posted_by"]
  ];
  for (const [name, table, column] of indexes) {
    assert.match(
      sql,
      new RegExp("CREATE INDEX IF NOT EXISTS " + name + "\\s+ON public\\." + table +
        "\\s*\\(" + column + "\\)", "i"),
      "Expected supporting index " + name
    );
    assert.match(
      sql,
      new RegExp("CREATE INDEX IF NOT EXISTS " + name + "[\\s\\S]*?WHERE " + column + " IS NOT NULL", "i")
    );
  }
  assert.doesNotMatch(sql, /(DROP TABLE|TRUNCATE|DELETE FROM|DROP INDEX)/i);
});
