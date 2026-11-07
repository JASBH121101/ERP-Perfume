-- 0012: supporting indexes for permission and ownership foreign keys.
-- Additive and idempotent. Apply to Neon Development first after reviewing the
-- existing schema; do not run against Production as part of code deployment.
--
-- Existing primary/unique indexes already cover:
--   role_template_permissions(role_key, permission_key) via its PK prefix
--   user_permission_overrides(user_id, permission_key) via its PK prefix
--   employee_commissions(invoice_item_id) via its UNIQUE constraint.
-- This migration adds only the referencing columns that are not already covered.

CREATE INDEX IF NOT EXISTS erp_roles_created_by_idx
  ON public.erp_roles (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS permission_catalog_parent_key_idx
  ON public.permission_catalog (parent_key)
  WHERE parent_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_template_permissions_permission_key_idx
  ON public.role_template_permissions (permission_key);

CREATE INDEX IF NOT EXISTS user_permission_overrides_permission_key_idx
  ON public.user_permission_overrides (permission_key);

CREATE INDEX IF NOT EXISTS user_permission_overrides_updated_by_idx
  ON public.user_permission_overrides (updated_by)
  WHERE updated_by IS NOT NULL;
