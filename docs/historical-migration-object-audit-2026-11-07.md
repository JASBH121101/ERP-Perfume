# Historical migration object audit — 2026-11-07

## Scope and safety

A read-only catalog query was run against Neon project `erp-perfume`, branch `development`, database `erp_perfume`, using `erp_owner`. The query is preserved in `db/diagnostics/historical-migration-object-audit.sql`.

No schema, ledger, business record, employee record, or application data was changed. No migration was replayed. No Production connection or operation was performed during this audit.

## Results

All named expected objects in the audit were present and all checked indexes were valid and ready.

| Migration | Checks passed | Result |
|---|---:|---|
| 0002 | 8 / 8 | PASS |
| 0003 | 14 / 14 | PASS |
| 0006 | 4 / 4 | PASS |
| 0008 | 3 / 3 | PASS |
| 0009 | 4 / 4 | PASS |
| 0012 | 5 / 5 | PASS |
| 0013 | 2 / 2 | PASS |
| 0014 | 2 / 2 | PASS |
| 0017 | 4 / 4 | PASS |
| 0018 | 1 / 1 | PASS |
| **Total** | **47 / 47** | **PASS** |

Additional checks:
- Employees missing either an initial `hire` or `compensation` history event: **0**.
- Unvalidated public constraints: **0**.
- Invalid or unready public indexes: **0**.

The checks cover named tables, columns, constraints, indexes, the employee code sequence, HR trigger/function, and the DGI settings key. They establish that these named schema effects currently exist. They are not a byte-for-byte source provenance proof and do not establish the exact historical SQL execution order or timestamps.

## Remaining source-lineage exceptions

The audit does **not** clear the historical provenance blockers:

- `0002`, `0003`: recoverable Git revisions are reconstructions and their blob checksums do not match the Development ledger.
- `0006`: the Git blob matching the ledger checksum is malformed SQL. The corrected source's schema effects exist, but the exact successfully executed SQL remains unproven.
- `0008`, `0009`: source files are explicitly documented schema-equivalent reconstructions, not original byte-for-byte scripts.
- `0012`–`0014`: all named objects exist, but no corresponding ledger rows exist. No rows were inserted or fabricated.
- `0017`, `0018`: the currently committed source does not match the registered checksum; `0018` is a schema-equivalent reconstruction.

Therefore the migration readiness gate remains **BLOCKED**. This is intentional: a passing object audit is necessary evidence for a safe baseline reconciliation, but it is not sufficient authority to rewrite migration history or to apply the next migration.

## Next safe action

Implement and test a separate, explicit Development baseline-reconciliation mode that:
1. verifies the pinned Development branch/database identity;
2. re-runs the read-only object and definition checks immediately before planning;
3. treats `0012`–`0014` as already-satisfied schema effects without inserting ledger rows or replaying their SQL;
4. records unresolved source provenance as a visible, approved baseline exception rather than claiming exact source verification;
5. keeps Production disallowed and preserves the normal strict path for clean installs.

Until that mode has tests and a reviewed approval step, do not apply `0020`.
