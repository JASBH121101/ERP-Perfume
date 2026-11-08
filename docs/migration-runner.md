# Controlled PostgreSQL migration runner

## Commands

```bash
npm run check:db
npm run migrate:db
npm run migrate:db:apply
```

- `check:db` verifies source files and their pinned hashes without a database connection.
- `migrate:db` is a live connection preflight only. It does not execute SQL.
- `migrate:db:apply` applies pending files only after explicit approval.

## Required environment

Set these values only in a trusted local shell or secret store; never commit them:

| Variable | Required value |
|---|---|
| `MIGRATION_DATABASE_URL` | Direct (unpooled) Neon connection string for Development |
| `ERP_EXPECTED_NEON_ENDPOINT_HOST` | Exact hostname from that Development connection string |
| `ERP_ENVIRONMENT` | `development` |
| `ERP_MIGRATION_BRANCH` | `development` |
| `ERP_MIGRATION_BRANCH_ID` | Exact branch ID pinned in `db/migration-integrity.json` |
| `ERP_EXPECTED_DATABASE_NAME` | `erp_perfume` (default) |
| `ERP_EXPECTED_DATABASE_ROLE` | `erp_owner` (default) |
| `ERP_MIGRATIONS_APPROVED` | Must be `YES` for `--apply` |

The runner rejects pooled `-pooler` hosts, any hostname other than the exact Development endpoint pinned in the manifest, the protected Production endpoint, a mismatched Neon branch ID, another database, a different role, and any environment other than Development. The operator-supplied hostname must match the manifest; it cannot override that pin. The runner never prints the connection string or its password.

## Operational rules

1. Back up the target and verify the restore path before applying changes.
2. Run `npm run migrate:db` first and inspect the full plan.
3. Do not use this runner on Production. Production requires a separate reviewed promotion procedure.
4. Do not resolve old ledger discrepancies by editing checksums, inserting fabricated versions, or replaying schema that already exists.
5. Every SQL migration file runs inside one transaction, together with insertion of its version, filename and SHA-256 into `app_schema_migrations`.
6. PostgreSQL advisory lock prevents simultaneous runners; row checksums stop edits or reapplication of previously applied versions.
7. A clean, empty application schema can bootstrap its own ledger. If application tables already exist but the ledger is absent or empty, the runner stops and requires a separately reviewed baseline reconciliation.
8. The runner does not execute automatically during Cloudflare Pages or Worker deployment.


## Branch-level runtime provisioning is a separate gate

The migration runner intentionally manages only the application `public` schema. It does not provision Neon Managed Auth, create `jb_erp_runtime_sql`, or copy its table/column/sequence grants. Do not treat a successful clean migration run as proof that the branch can authenticate users or run the ERP Worker.

Before connecting a new branch to the Worker:
1. Enable/provision Neon Auth for that branch in Neon’s managed Auth controls.
2. Configure the expected trusted origins and email-verification policy.
3. Create the runtime login role and apply the reviewed least-privilege grants. Do not use an unrestricted/admin role, and do not leave the generic `read_write` preset's broad DELETE grants in place.
4. Set the Worker `DATABASE_URL` to the runtime role, never `erp_owner`.
5. Run `db/diagnostics/runtime-provisioning.sql` on the new branch and `db/diagnostics/development-readiness.sql` after migrations, then verify `/api/health`, authenticated `/api/auth/profile`, and one disposable synthetic transaction.

Read-only inspection on 2026-11-07 confirmed the Development branch had `neon_auth`, `jb_erp_runtime_sql`, 88 public table grants, 1,036 public column grants, and 2 public sequence grants. A fresh-migration QA clone had none of those branch-level provisioning objects. Those differences are environment provisioning, not missing SQL application migrations.

## Historical Development status

The current Development snapshot is deliberately blocked from applying new migrations until its history discrepancies are reconciled. A new clean database can use the current pinned source chain, but that clean-install success does not retroactively prove the exact SQL that originally ran on Development.

## Read-only historical Development baseline assessment

Run `node scripts/migrate-db.mjs --reconcile-development-baseline` only from a trusted local shell with the same pinned Development environment variables above. This mode opens the exact pinned direct Development endpoint as `erp_owner`, acquires the migration advisory lock, and executes only `db/diagnostics/historical-migration-object-audit.sql`.

The assessment requires all 47 named object checks to pass, the employee-history invariant to be zero, no unvalidated public constraints, no invalid/unready public indexes, and the live migration ledger versions to exactly match the reviewed snapshot. It explicitly verifies that 0012–0014 still have no ledger rows. It does not create ledger entries, execute migration files, modify schema/data, or mark the database READY.

A successful assessment is evidence for a separate human-reviewed baseline decision, not proof of historical SQL byte provenance. The ordinary `--check` and `--apply` paths remain unchanged and blocked for the unresolved Development history. Migration 0020 remains pending. No reconciliation assessment by itself authorizes applying it.
