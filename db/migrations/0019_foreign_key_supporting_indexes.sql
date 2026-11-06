-- 0019: supporting indexes for foreign-key maintenance and permission lookups.
-- Additive only. Apply to Neon Development after reviewing the migration audit.
-- No production deployment or data mutation is required.

CREATE INDEX IF NOT EXISTS dgi_support_documents_created_by_idx
  ON public.dgi_support_documents (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS erp_roles_created_by_idx
  ON public.erp_roles (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS permission_catalog_parent_idx
  ON public.permission_catalog (parent_key)
  WHERE parent_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS role_template_permissions_permission_idx
  ON public.role_template_permissions (permission_key);

CREATE INDEX IF NOT EXISTS user_permission_overrides_permission_idx
  ON public.user_permission_overrides (permission_key);

CREATE INDEX IF NOT EXISTS user_permission_overrides_updated_by_idx
  ON public.user_permission_overrides (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_invoices_created_by_idx
  ON public.supplier_invoices (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_invoice_payments_created_by_idx
  ON public.supplier_invoice_payments (created_by)
  WHERE created_by IS NOT NULL;

-- employee_commissions.invoice_item_id already has a UNIQUE index; no duplicate index is needed.
