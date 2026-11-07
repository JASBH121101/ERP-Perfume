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
| `ERP_EXPECTED_DATABASE_NAME` | `erp_perfume` (default) |
| `ERP_EXPECTED_DATABASE_ROLE` | `erp_owner` (default) |
| `ERP_MIGRATIONS_APPROVED` | Must be `YES` for `--apply` |

The runner rejects pooled `-pooler` hosts, a hostname that does not exactly match the operator-supplied Development endpoint, another database, a different role, and any environment other than Development. It never prints the connection string or its password.

## Operational rules

1. Back up the target and verify the restore path before applying changes.
2. Run `npm run migrate:db` first and inspect the full plan.
3. Do not use this runner on Production. Production requires a separate reviewed promotion procedure.
4. Do not resolve old ledger discrepancies by editing checksums, inserting fabricated versions, or replaying schema that already exists.
5. Every SQL migration file runs inside one transaction, together with insertion of its version, filename and SHA-256 into `app_schema_migrations`.
6. PostgreSQL advisory lock prevents simultaneous runners; row checksums stop edits or reapplication of previously applied versions.
7. A clean, empty application schema can bootstrap its own ledger. If application tables already exist but the ledger is absent or empty, the runner stops and requires a separately reviewed baseline reconciliation.
8. The runner does not execute automatically during Cloudflare Pages or Worker deployment.

## Historical Development status

The current Development snapshot is deliberately blocked from applying new migrations until its history discrepancies are reconciled. A new clean database can use the current pinned source chain, but that clean-install success does not retroactively prove the exact SQL that originally ran on Development.
