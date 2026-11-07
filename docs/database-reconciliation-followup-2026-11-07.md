# Database reconciliation follow-up — 2026-11-07

## Scope

This follow-up extends the Database Reliability Gate audit. It is based on read-only inspection of Neon Development and Git history, plus synthetic checks against empty operational tables. No Production connection, schema change, business record, real customer or personal data was used.

## Historical checksum provenance

| Version | Evidence | Current classification |
|---|---|---|
| 0001 | Neon checksum equals Git blob SHA-1 of current file | Source hash verified |
| 0002 | Checksum does not match recoverable source revision | Unresolved |
| 0003 | Checksum does not match either recoverable committed revision | Unresolved |
| 0004 | Exact source recovered from commit \`55095a98d599850078b42bb2fd0c8320f959e94d\`; Git blob SHA-1 equals ledger | Historical source recovered |
| 0005 | Neon checksum equals Git blob SHA-1 of current file | Source hash verified |
| 0006 | Git blob from commit \`7eb27a4d566ff750a2ddf9da7f45c0e5ca4d9c2f\` matches ledger checksum, but contains malformed SQL | Historical source recovered but unexecutable |
| 0007 | Neon checksum equals SHA-1 of exact current SQL bytes | Source hash verified |
| 0008–0009 | Current source files are schema-equivalent reconstructions | Unresolved provenance |
| 0012–0014 | Schema objects exist in Development, but migration ledger rows do not | Reconciliation required; do not replay |
| 0017 | Current source SHA-256 differs from ledger; no exact original recovered | Unresolved provenance |
| 0018 | Current source is documented schema-equivalent reconstruction; checksum differs | Unresolved provenance |
| 0019 | Ledger checksum equals SHA-256 of current source; all eight expected indexes exist | Verified applied |

### 0004 historical source

The historical source was recovered from Git and archived at \`db/migration-history/0004-ledger-matched-source.sql\`. The archive's SHA-256 and Git blob SHA-1 are pinned in \`db/migration-integrity.json\`. The archived SQL includes a preflight duplicate check and creation of the unique partial index on \`invoices(order_id)\`.

### 0006 historical source — critical anomaly

The source artifact whose Git blob SHA-1 matches the Neon ledger checksum was recovered and archived at \`db/migration-history/0006-ledger-matched-source-invalid.sql\`. That file contains an unterminated \`fiscal_period\` check expression and duplicated SQL after the first statement. It cannot execute as a complete migration.

The live Development table \`dgi_support_documents\`, its constraints and indexes match the later corrected source from commit \`54c8d6cf4bd1bd0d575117291520857148710596\`. This confirms the resulting schema shape, but it does not prove which exact SQL was successfully executed or how the malformed checksum entered the migration ledger. Do not replay either file or rewrite the ledger checksum.

## Current Development integrity snapshot

- Migration ledger: 16 rows and 16 distinct versions (\`0001\`–\`0011\`, \`0015\`–\`0019\`).
- Versions \`0012\`, \`0013\`, \`0014\`: all expected tables, sequence, trigger and indexes observed; no ledger entries.
- Migration \`0019\`: ledger checksum and all eight expected indexes verified.
- Unvalidated foreign keys: 0.
- Invalid or unready indexes: 0.
- Migration ledger primary/unique constraints: 1.
- Production: not inspected or modified.

## Synthetic database checks

The operational tables \`products\`, \`inventory_movements\`, \`purchase_orders\`, \`purchase_order_items\`, \`purchase_receipts\` and \`purchase_receipt_items\` were empty before testing. There was one existing supplier and four audit rows; those were left untouched.

A single PostgreSQL transaction inserted a unique synthetic product and inventory movement, then verified that constraints rejected:
- negative product stock;
- duplicate SKU;
- duplicate non-empty barcode;
- zero movement quantity;
- movement referencing a non-existent product.

The synthetic valid movement and product were explicitly deleted before the transaction completed. A subsequent independent query confirmed 0 products and 0 inventory movements.

Transaction atomicity was also tested by creating a uniquely named QA table, inserting one synthetic row, then forcing a division-by-zero error in the same multi-statement transaction. Neon returned SQLSTATE \`22012\`; a separate query confirmed that the table did not exist afterward. PostgreSQL rolled back the DDL and insert together.

These are database-constraint and atomicity tests only. They do not certify the Inventory application workflow or authenticated Worker endpoints.

## Strict readiness gate

The checker now understands:
- SHA-256 of exact SQL bytes;
- Git blob SHA-1;
- SHA-1 of exact source bytes;
- archived historical source evidence;
- pending, unapplied migrations;
- schema-present versions that have no ledger row.

Run \`npm run check:db\` for offline source-integrity checks. Run \`npm run check:db:ready\` before planning a new migration. The strict command returns exit code 2 while unresolved historical cases remain.

Current readiness blockers: \`0002\`, \`0003\`, \`0006\`, \`0008\`, \`0009\`, \`0012\`, \`0013\`, \`0014\`, \`0017\`, \`0018\`.

No new migration should be applied until these cases are reconciled by evidence. Do not fabricate rows in \`app_schema_migrations\`; do not rerun versions whose objects are already present.


## Object-level schema verification for 0012–0014

A second read-only inspection checked definitions, not only object names:

- **0012 — employee history:** \`employee_history\` contains the original employee/event/date, position, department, salary, commission, status and audit fields. Its employee foreign key is \`ON DELETE RESTRICT\`; \`changed_by\` is \`ON DELETE SET NULL\`. The default on \`employees.employee_code\` uses \`employee_code_sequence\`. The \`employees_seed_history_after_insert\` trigger calls \`seed_employee_history()\`, whose body inserts the initial hire and compensation events.
- **0013 — employee documents:** all expected columns and checks were present: document type, unique file key, allowed MIME types, size limit, employee FK with \`ON DELETE RESTRICT\`, and uploader FK with \`ON DELETE SET NULL\`.
- **0014 — supporting indexes:** the two expected partial indexes on \`employee_history.changed_by\` and \`employee_documents.uploaded_by\` were present. The base employee/date and document employee/date indexes were also present.
- The later **0015** contract fields and contract-history trigger are also present and match its registered migration.

This is stronger evidence that the schema effects of 0012–0014 are already in Development. It still does not create an authoritative historical execution timestamp or a ledger entry. The gate therefore continues to block new migrations until a controlled reconciliation policy is implemented; no synthetic rows were added to \`app_schema_migrations\`.

## Procurement and receipt constraint checks

A separate transaction created disposable purchase-order and receipt fixtures with no link to the pre-existing supplier or any product. PostgreSQL correctly rejected:
- a duplicate purchase-order number;
- a purchase-order item with received quantity greater than ordered quantity;
- a receipt item with zero quantity;
- a negative actual freight amount.

The valid synthetic order, line, receipt and receipt line were deleted before the transaction completed. A fresh query afterward confirmed zero QA purchase orders, order items, receipts and receipt items. The pre-existing supplier count (1) and audit-log count (4) were unchanged.

## Source-history search follow-up

The recoverable 0002 source is itself documented as a schema reconstruction and its Git blob SHA-1 does not match the Development ledger checksum. Both available committed revisions for 0003 were checked; neither matches the ledger checksum. These observations confirm that the remaining source provenance gaps cannot be closed by simply choosing the current Git file.


## Fresh-install Auth and runtime-role provisioning check

A branch clone created from the Production lineage and migrated through 0020 had the expected ERP application schema and migration ledger, but a separate read-only inspection found no `neon_auth` schema, no `jb_erp_runtime_sql` role, and no runtime grants. The Neon Auth API also reported that Managed Auth was not enabled for that branch. A Development-derived QA clone, by contrast, retained Neon Auth and the runtime role.

The reviewed Development baseline currently reports 88 public table grants, 1,036 public column grants, 2 public sequence grants, and 1 Neon Auth table grant for `jb_erp_runtime_sql`. The clean clone reported zero for each. The public application schema itself compared equal after migration 0020; the remaining differences are branch-level identity and ACL provisioning.

This is now an explicit installation gate. `db/diagnostics/runtime-provisioning.sql` performs the branch-level checks without assuming that `app_schema_migrations` already exists. The application migration runner must not attempt to synthesize Neon Auth tables or silently grant broad access. Provision Neon Auth using Neon Managed Auth controls, create the runtime role with the exact least-privilege policy, then point the Worker secret at that role. Do not use the generic Neon `read_write` preset without narrowing it; broad DELETE privileges would exceed the ERP policy.

The Development branch was queried only for reads. The QA transaction probes used synthetic data and a forced rollback; no Production schema or application records were changed.
