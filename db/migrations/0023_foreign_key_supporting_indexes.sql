-- 0023: supporting indexes for foreign-key columns identified by the database audit.
-- Additive only. Unique/primary-key-backed references are intentionally not duplicated.

CREATE INDEX IF NOT EXISTS erp_roles_created_by_idx
  ON public.erp_roles(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS permission_catalog_parent_key_idx
  ON public.permission_catalog(parent_key)
  WHERE parent_key IS NOT NULL;

-- The composite primary key starts with role_key, so permission_key needs its own index.
CREATE INDEX IF NOT EXISTS role_template_permissions_permission_key_idx
  ON public.role_template_permissions(permission_key);

-- The composite primary key starts with user_id; updated_by is a separate FK.
CREATE INDEX IF NOT EXISTS user_permission_overrides_permission_key_idx
  ON public.user_permission_overrides(permission_key);

CREATE INDEX IF NOT EXISTS user_permission_overrides_updated_by_idx
  ON public.user_permission_overrides(updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_journal_entries_created_by_idx
  ON public.purchase_journal_entries(created_by)
  WHERE created_by IS NOT NULL;
