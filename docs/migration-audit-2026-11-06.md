# ERP Perfume — Neon Development migration audit

**Inspected:** 2026-11-06 (read-only)  
**Project:** `erp-perfume` (`withered-union-19544532`)  
**Database:** `erp_perfume`  
**Branch:** `development` (`br-nameless-surf-bezeav6n`)

## Registry snapshot

The Development ledger contains versions `0001`–`0011` and `0015`–`0018`. Versions `0012`, `0013` and `0014` do not have ledger rows.

The live Development catalog nevertheless contains the objects expected from those three HR migrations:

- `employee_code_sequence`, `employee_history`, the history seed trigger, and the employee/date and `changed_by` indexes.
- `employee_documents`, its employee/date index, and the `uploaded_by` index.
- This is evidence that the relevant schema work is already present; it is **not** permission to replay those files or to invent registry rows.

## Version 0018 source recovery

Neon records:

| Version | Registered filename | Registered checksum | Applied (UTC) |
|---|---|---|---|
| 0018 | `0018_purchase_order_rejection_reason.sql` | `2fe572455a79e20ef49139b229d7bbb6e0204375727e1e30be271f1b60644f57` | 2026-11-06 20:40:28 |

The exact original file is absent from the Git commit history. A read-only schema inspection confirmed that `purchase_orders.rejection_reason` is nullable `TEXT` and that `purchase_orders_rejection_audit_check` requires a rejection reason of 5–300 trimmed characters when status is `Rechazada`, with the rejection actor and timestamp present; for other statuses those three rejection fields must be null.

The repository reconstruction in `db/migrations/0018_purchase_order_rejection_reason.sql` reflects that observed schema. It is **schema-equivalent**, not byte-for-byte original; its checksum is not the registered checksum. Do not replay it or overwrite the registry row.

## Version 0019 — pending supporting indexes

The new `0019_foreign_key_supporting_indexes.sql` adds indexes for the nullable audit foreign keys and permission lookup columns flagged by JB Expert QA. The inspection confirmed that the following columns lacked supporting indexes in Development:

- `dgi_support_documents.created_by`
- `erp_roles.created_by`
- `permission_catalog.parent_key`
- `role_template_permissions.permission_key`
- `user_permission_overrides.permission_key` and `updated_by`
- `supplier_invoices.created_by`
- `supplier_invoice_payments.created_by`

No duplicate index is proposed for `employee_commissions.invoice_item_id`; a unique index already exists. Version 0019 is a pending additive migration and has not been applied by this release.

## Safety boundary

Only Neon Development was queried. No production branch, business records, or application data were modified. GitHub Actions, Cloudflare Pages, and Wrangler Worker deployments do not execute SQL migrations automatically.


## Follow-up read-only verification — 2026-11-07

A later read-only query against Neon Development confirmed that the ledger now contains 16 rows: versions `0001`–`0011` and `0015`–`0019`. In particular, version `0019` is recorded with checksum `de223be267e647d1e31a4d3bda1e3b5918a2c317de2f46ad18575409f727e474`, applied at `2026-11-06 21:31:03 UTC`. That value matches the SHA-256 of the current repository source. All eight indexes declared by 0019 were present.

Versions `0012`, `0013` and `0014` remain absent from the ledger, while their expected sequence, tables, trigger and indexes are present. The same read-only inspection returned zero unvalidated foreign keys and zero invalid or unready public indexes. The migration ledger has one primary-key or unique constraint and contains 16 distinct versions.

This follow-up supersedes the earlier “0019 pending” status above; it does not authorize replaying any historical SQL or inserting synthetic ledger rows. Production was not queried or modified.
