-- JB PARFUMS ERP — branch-level Neon Auth and Worker role readiness
-- READ ONLY; safe to run before or after public application migrations.
-- Run on the exact Neon branch that will be connected to the Worker.
-- Does not create roles, change grants, enable Neon Auth, or access user data.

SELECT
  current_database() AS database_name,
  current_user AS connected_role,
  current_setting('server_version') AS postgres_version,
  to_regnamespace('neon_auth') IS NOT NULL AS neon_auth_schema_exists,
  EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'jb_erp_runtime_sql'
  ) AS runtime_role_exists;

SELECT
  (SELECT COUNT(*)
   FROM information_schema.role_table_grants
   WHERE grantee = 'jb_erp_runtime_sql' AND table_schema = 'public') AS runtime_public_table_grants,
  (SELECT COUNT(*)
   FROM information_schema.role_table_grants
   WHERE grantee = 'jb_erp_runtime_sql' AND table_schema = 'neon_auth') AS runtime_neon_auth_table_grants,
  (SELECT COUNT(*)
   FROM information_schema.column_privileges
   WHERE grantee = 'jb_erp_runtime_sql' AND table_schema = 'public') AS runtime_public_column_grants,
  (SELECT COUNT(*)
   FROM information_schema.usage_privileges
   WHERE grantee = 'jb_erp_runtime_sql'
     AND object_type = 'SEQUENCE'
     AND object_schema = 'public') AS runtime_public_sequence_grants;

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
