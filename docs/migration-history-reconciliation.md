# Migration history reconciliation

Audit date: 2026-11-05  
Target audited: Neon project `erp-perfume`, branch `development`, database `erp_perfume`.

## Findings

The Development registry contained migrations `0001` through `0010`, but the repository's `main` branch had no source files for `0008` and `0009`. GitHub's commit history for both exact paths was empty, so the historical SQL source could not be recovered from Git.

The live Development catalog was inspected read-only. The missing source files have now been restored as **schema-equivalent, idempotent reconstructions**:

- `0008_employee_account_link.sql`: `app_users.employee_id`, its foreign key to `employees(id)` with `ON DELETE SET NULL`, and the partial unique index.
- `0009_supplier_invoices_payables.sql`: `supplier_invoices`, `supplier_invoice_payments`, their validated constraints, foreign keys, and indexes.

These files reproduce the audited Development schema. They are not claimed to be byte-for-byte copies of the uncommitted historical scripts. Do not re-run them against a branch where the matching migration is already registered.

## Original Development registry checksums

The registry values observed before source recovery were:

| Version | Original filename | Original checksum |
|---|---|---|
| 0008 | `0008_employee_account_link.sql` | `accb56146d1e5c707e7f7336eabc1e66dc50df1bf5e316387267b030fe392842` |
| 0009 | `0009_supplier_invoices_payables.sql` | `e564f8a421bd7e828f664259ff15bdaf3ce983a76b84ea15b8963d5880b17ec4` |

The original checksum values are retained here as audit evidence. No registry row, application data, or schema was changed during this recovery. Migration `0010` remains unchanged.

## Safety boundary

Only Neon Development was inspected. Neon Production was not queried for migration changes, migrated, or modified.


## Additional historical source recovery — 2026-11-07

The exact historical SQL sources for versions `0002` and `0003` were recovered from the `feature/erp-procurement-finance-catalog` branch:

| Version | Source commit | Git blob SHA-1 | Development ledger match |
|---|---|---|---|
| 0002 | `dba793412a40340d7809b52c0d6274099bfbb98c` | `074ce79f6a8be69c58ae70e8f51a438b133a9571` | Exact |
| 0003 | `7347b46fe7d345bda34564cae92cb4ed0db38d5e` | `fd84c81e13faa4dc8d761b341098175208430919` | Exact |

The exact files are archived at `db/migration-history/0002-ledger-matched-source.sql` and `db/migration-history/0003-ledger-matched-source.sql`. Their hashes and source commits are pinned in `db/migration-integrity.json`. The current `db/migrations/0002_...` and `0003_...` clean-install sources remain unchanged; the archive is used only to verify the historical Development ledger and is never replayed automatically.

This clears the source-provenance exceptions for 0002 and 0003. It does not clear the remaining 8 Development history exceptions or authorize applying the pending migration.
