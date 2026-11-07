-- JB PARFUMS ERP — Neon Development readiness diagnostics
-- READ ONLY: SELECT statements only. Does not create objects or modify data.
-- Run against project erp-perfume / database erp_perfume / branch development.
-- Do not use this script as a migration runner or against Production.

-- 1) Connection identity: verify the target before interpreting other results.
SELECT
  current_database() AS database_name,
  current_user AS connected_role,
  current_setting('server_version') AS postgres_version;

-- 2) Authoritative migration ledger as currently recorded by this database.
SELECT version, filename, checksum, applied_at
FROM public.app_schema_migrations
ORDER BY version;

-- 3) Known Development reconciliation cases: 0012–0014 have schema objects
-- but no ledger rows. This query must not be used to insert or fabricate rows.
WITH expected(version, filename) AS (
  VALUES
    ('0012', '0012_hr_employee_history.sql'),
    ('0013', '0013_hr_employee_documents.sql'),
    ('0014', '0014_hr_foreign_key_indexes.sql')
)
SELECT
  e.version,
  e.filename,
  m.checksum AS ledger_checksum,
  m.applied_at,
  CASE WHEN m.version IS NULL THEN 'SCHEMA_RECONCILIATION_REQUIRED'
       ELSE 'REGISTERED' END AS ledger_state
FROM expected e
LEFT JOIN public.app_schema_migrations m ON m.version = e.version
ORDER BY e.version;

-- 4) Verify critical schema objects observed for versions 0012–0014 and 0019.
WITH expected(object_name, object_type) AS (
  VALUES
    ('employee_code_sequence', 'sequence'),
    ('employee_history', 'table'),
    ('employees_seed_history_after_insert', 'trigger'),
    ('employee_history_employee_date_idx', 'index'),
    ('employee_documents', 'table'),
    ('employee_documents_employee_date_idx', 'index'),
    ('employee_history_changed_by_idx', 'index'),
    ('employee_documents_uploaded_by_idx', 'index'),
    ('dgi_support_documents_created_by_idx', 'index'),
    ('erp_roles_created_by_idx', 'index'),
    ('permission_catalog_parent_idx', 'index'),
    ('role_template_permissions_permission_idx', 'index'),
    ('user_permission_overrides_permission_idx', 'index'),
    ('user_permission_overrides_updated_by_idx', 'index'),
    ('supplier_invoices_created_by_idx', 'index'),
    ('supplier_invoice_payments_created_by_idx', 'index')
)
SELECT
  e.object_name,
  e.object_type,
  CASE
    WHEN e.object_type = 'trigger' THEN EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND t.tgname = e.object_name
        AND NOT t.tgisinternal
    )
    ELSE to_regclass('public.' || e.object_name) IS NOT NULL
  END AS present
FROM expected e
ORDER BY e.object_type, e.object_name;

-- 5) A migration registry must not contain duplicate version rows.
SELECT version, COUNT(*) AS row_count
FROM public.app_schema_migrations
GROUP BY version
HAVING COUNT(*) > 1;

-- 6) Constraints and indexes that should be repaired before module certification.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'f'
  AND NOT convalidated
ORDER BY conrelid::regclass::text, conname;

SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  i.relname AS index_name,
  ix.indisvalid,
  ix.indisready
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND (NOT ix.indisvalid OR NOT ix.indisready)
ORDER BY t.relname, i.relname;

-- 7) Compact integrity counts for the audit record.
SELECT
  COUNT(*) AS ledger_rows,
  COUNT(DISTINCT version) AS distinct_versions,
  (SELECT COUNT(*)
     FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'f'
      AND NOT convalidated) AS unvalidated_foreign_keys,
  (SELECT COUNT(*)
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_namespace n ON n.oid = i.relnamespace
    WHERE n.nspname = 'public'
      AND (NOT ix.indisvalid OR NOT ix.indisready)) AS invalid_or_unready_indexes
FROM public.app_schema_migrations;


-- 8) Separate environment provisioning gate for Neon Auth and the Worker role.
-- These are NOT application migrations and must be provisioned per Neon branch.
-- Counts are compared with the reviewed Development role snapshot, not treated
-- as permanent constants after future permission changes.
SELECT
  EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'jb_erp_runtime_sql'
  ) AS runtime_role_exists,
  to_regnamespace('neon_auth') IS NOT NULL AS neon_auth_schema_exists,
  (
    SELECT COUNT(*)
    FROM information_schema.role_table_grants
    WHERE grantee = 'jb_erp_runtime_sql' AND table_schema = 'public'
  ) AS runtime_public_table_grants,
  (
    SELECT COUNT(*)
    FROM information_schema.role_table_grants
    WHERE grantee = 'jb_erp_runtime_sql' AND table_schema = 'neon_auth'
  ) AS runtime_neon_auth_table_grants,
  (
    SELECT COUNT(*)
    FROM information_schema.column_privileges
    WHERE grantee = 'jb_erp_runtime_sql' AND table_schema = 'public'
  ) AS runtime_public_column_grants,
  (
    SELECT COUNT(*)
    FROM information_schema.usage_privileges
    WHERE grantee = 'jb_erp_runtime_sql'
      AND object_type = 'SEQUENCE'
      AND object_schema = 'public'
  ) AS runtime_public_sequence_grants;

-- Expected role identity/access policy (read-only privilege introspection).
-- The runtime role must not receive broad DELETE on operational tables.
WITH runtime_role AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'jb_erp_runtime_sql'
  ) AS role_exists
)
SELECT
  role_exists,
  CASE WHEN role_exists THEN has_table_privilege('jb_erp_runtime_sql', 'public.products', 'SELECT') ELSE FALSE END AS products_select,
  CASE WHEN role_exists THEN has_table_privilege('jb_erp_runtime_sql', 'public.products', 'INSERT') ELSE FALSE END AS products_insert,
  CASE WHEN role_exists THEN has_table_privilege('jb_erp_runtime_sql', 'public.products', 'UPDATE') ELSE FALSE END AS products_update,
  CASE WHEN role_exists THEN has_table_privilege('jb_erp_runtime_sql', 'public.products', 'DELETE') ELSE FALSE END AS products_delete,
  CASE WHEN role_exists THEN has_table_privilege('jb_erp_runtime_sql', 'public.user_permission_overrides', 'DELETE') ELSE FALSE END AS permission_override_delete,
  CASE WHEN role_exists THEN has_table_privilege('jb_erp_runtime_sql', 'public.role_template_permissions', 'DELETE') ELSE FALSE END AS role_template_permission_delete
FROM runtime_role;
