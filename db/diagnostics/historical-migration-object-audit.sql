-- Read-only object audit for historical Development migrations.
-- Target: Neon erp-perfume / development only.
-- This query never inserts, updates, deletes, or changes schema.
-- PASS means named schema effects exist; it does NOT prove the exact historical SQL bytes.

WITH expected(kind, migration, object_name) AS (
  VALUES
    ('table','0002','purchase_orders'),
    ('table','0002','purchase_order_items'),
    ('table','0002','purchase_receipts'),
    ('table','0002','purchase_receipt_items'),
    ('index','0002','purchase_orders_supplier_date_idx'),
    ('index','0002','purchase_orders_status_idx'),
    ('index','0002','purchase_order_items_order_idx'),
    ('index','0002','purchase_receipts_order_idx'),

    ('column','0003','products.barcode'),
    ('column','0003','products.description'),
    ('column','0003','products.supplier_name'),
    ('column','0003','products.wholesale_price_usd'),
    ('column','0003','products.tone'),
    ('column','0003','products.notes'),
    ('column','0003','products.images'),
    ('column','0003','customers.customer_type'),
    ('constraint','0003','products_images_array_check'),
    ('constraint','0003','products_wholesale_price_usd_check'),
    ('constraint','0003','customers_customer_type_check'),
    ('index','0003','products_barcode_nonempty_uq'),
    ('index','0003','products_active_category_idx'),
    ('index','0003','customers_active_name_idx'),

    ('table','0006','dgi_support_documents'),
    ('index','0006','dgi_support_documents_date_idx'),
    ('index','0006','dgi_support_documents_type_period_idx'),
    ('setting','0006','dgi_compliance'),

    ('column','0008','app_users.employee_id'),
    ('constraint','0008','app_users_employee_id_fkey'),
    ('index','0008','app_users_employee_id_unique_idx'),

    ('table','0009','supplier_invoices'),
    ('table','0009','supplier_invoice_payments'),
    ('index','0009','supplier_invoices_supplier_date_idx'),
    ('index','0009','supplier_invoice_payments_invoice_idx'),

    ('sequence','0012','employee_code_sequence'),
    ('table','0012','employee_history'),
    ('trigger','0012','employees_seed_history_after_insert'),
    ('function','0012','seed_employee_history'),
    ('index','0012','employee_history_employee_date_idx'),

    ('table','0013','employee_documents'),
    ('index','0013','employee_documents_employee_date_idx'),

    ('index','0014','employee_history_changed_by_idx'),
    ('index','0014','employee_documents_uploaded_by_idx'),

    ('column','0017','purchase_orders.rejected_by'),
    ('column','0017','purchase_orders.rejected_at'),
    ('constraint','0017','purchase_orders_status_check'),
    ('constraint','0017','purchase_orders_rejection_audit_check'),

    ('column','0018','purchase_orders.rejection_reason'),

    ('index','0019','dgi_support_documents_created_by_idx'),
    ('index','0019','erp_roles_created_by_idx'),
    ('index','0019','permission_catalog_parent_idx'),
    ('index','0019','role_template_permissions_permission_idx'),
    ('index','0019','user_permission_overrides_permission_idx'),
    ('index','0019','user_permission_overrides_updated_by_idx'),
    ('index','0019','supplier_invoices_created_by_idx'),
    ('index','0019','supplier_invoice_payments_created_by_idx')
),
expected_owners(kind, object_name, relation_name) AS (
  VALUES
    ('index','purchase_orders_supplier_date_idx','purchase_orders'),
    ('index','purchase_orders_status_idx','purchase_orders'),
    ('index','purchase_order_items_order_idx','purchase_order_items'),
    ('index','purchase_receipts_order_idx','purchase_receipts'),
    ('constraint','products_images_array_check','products'),
    ('constraint','products_wholesale_price_usd_check','products'),
    ('constraint','customers_customer_type_check','customers'),
    ('index','products_barcode_nonempty_uq','products'),
    ('index','products_active_category_idx','products'),
    ('index','customers_active_name_idx','customers'),
    ('index','dgi_support_documents_date_idx','dgi_support_documents'),
    ('index','dgi_support_documents_type_period_idx','dgi_support_documents'),
    ('constraint','app_users_employee_id_fkey','app_users'),
    ('index','app_users_employee_id_unique_idx','app_users'),
    ('index','supplier_invoices_supplier_date_idx','supplier_invoices'),
    ('index','supplier_invoice_payments_invoice_idx','supplier_invoice_payments'),
    ('index','employee_history_employee_date_idx','employee_history'),
    ('index','employee_documents_employee_date_idx','employee_documents'),
    ('index','employee_history_changed_by_idx','employee_history'),
    ('index','employee_documents_uploaded_by_idx','employee_documents'),
    ('constraint','purchase_orders_status_check','purchase_orders'),
    ('constraint','purchase_orders_rejection_audit_check','purchase_orders'),
    ('trigger','employees_seed_history_after_insert','employees'),
    ('index','dgi_support_documents_created_by_idx','dgi_support_documents'),
    ('index','erp_roles_created_by_idx','erp_roles'),
    ('index','permission_catalog_parent_idx','permission_catalog'),
    ('index','role_template_permissions_permission_idx','role_template_permissions'),
    ('index','user_permission_overrides_permission_idx','user_permission_overrides'),
    ('index','user_permission_overrides_updated_by_idx','user_permission_overrides'),
    ('index','supplier_invoices_created_by_idx','supplier_invoices'),
    ('index','supplier_invoice_payments_created_by_idx','supplier_invoice_payments')
),
checked AS (
  SELECT e.*,
    CASE e.kind
      WHEN 'table' THEN EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = e.object_name
          AND c.relkind IN ('r','p')
      )
      WHEN 'sequence' THEN EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = e.object_name
          AND c.relkind = 'S'
      )
      WHEN 'column' THEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name || '.' || c.column_name = e.object_name
      )
      WHEN 'constraint' THEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.connamespace = 'public'::regnamespace
          AND c.conname = e.object_name
          AND c.conrelid = to_regclass('public.' || o.relation_name)
      )
      WHEN 'index' THEN EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class x ON x.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = x.relnamespace
        WHERE n.nspname = 'public'
          AND x.relname = e.object_name
          AND i.indrelid = to_regclass('public.' || o.relation_name)
          AND i.indisvalid
          AND i.indisready
          AND i.indislive
      )
      WHEN 'trigger' THEN EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_namespace pn ON pn.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND c.relname = o.relation_name
          AND t.tgname = e.object_name
          AND t.tgrelid = to_regclass('public.' || o.relation_name)
          AND t.tgtype = 5
          AND t.tgenabled IN ('O','A')
          AND pn.nspname = 'public'
          AND p.proname = 'seed_employee_history'
          AND p.pronargs = 0
          AND p.prorettype = 'trigger'::regtype
          AND p.prokind = 'f'
          AND NOT t.tgisinternal
      )
      WHEN 'function' THEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = e.object_name
          AND p.pronargs = 0
          AND p.prorettype = 'trigger'::regtype
          AND p.prokind = 'f'
      )
      WHEN 'setting' THEN EXISTS (
        SELECT 1 FROM public.app_settings s
        WHERE s.setting_key = e.object_name
      )
      ELSE false
    END AS present
  FROM expected e
  LEFT JOIN expected_owners o ON o.kind = e.kind AND o.object_name = e.object_name
),
summary AS (
  SELECT migration,
    count(*) AS total,
    count(*) FILTER (WHERE present) AS present,
    count(*) FILTER (WHERE NOT present) AS missing,
    CASE WHEN bool_and(present) THEN 'PASS' ELSE 'FAIL' END AS status
  FROM checked
  GROUP BY migration
)
SELECT jsonb_build_object(
  'database', current_database(),
  'role', current_user,
  'checks', (
    SELECT jsonb_agg(
      jsonb_build_object(
        'migration', migration,
        'kind', kind,
        'object', object_name,
        'present', present
      )
      ORDER BY migration, kind, object_name
    )
    FROM checked
  ),
  'summary', (
    SELECT jsonb_agg(to_jsonb(s) ORDER BY migration)
    FROM summary s
  ),
  'employees_missing_initial_history', (
    SELECT count(*)
    FROM public.employees e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.employee_history h
      WHERE h.employee_id = e.id AND h.event_type = 'hire'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.employee_history h
      WHERE h.employee_id = e.id AND h.event_type = 'compensation'
    )
  ),
  'ledger_key_constraints', (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'public.app_schema_migrations'::regclass
      AND contype IN ('p','u')
  ),
  'unvalidated_constraints', (
    SELECT count(*)
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND NOT convalidated
  ),
  'invalid_or_unready_indexes', (
    SELECT count(*)
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (NOT i.indisvalid OR NOT i.indisready)
  ),
  'development_schema_alignment', jsonb_build_object(
    'invoice_unit_cost_usd', (
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='invoice_items'
          AND column_name='unit_cost_usd' AND data_type='numeric'
          AND numeric_precision=14 AND numeric_scale=4
          AND is_nullable='NO' AND column_default='0'
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='public.invoice_items'::regclass
          AND conname='invoice_items_unit_cost_usd_check'
          AND lower(pg_get_constraintdef(oid)) LIKE '%unit_cost_usd >= (0)%'
      )
    ),
    'purchase_order_exchange_rate', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='purchase_orders'
        AND column_name='exchange_rate' AND data_type='numeric'
        AND numeric_precision=14 AND numeric_scale=6
    ),
    'notification_billing_target', (
      SELECT COALESCE(
        lower(pg_get_constraintdef(oid)) LIKE '%billing%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%purchaseorders%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%receivables%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%payables%',
        false
      )
      FROM pg_constraint
      WHERE conrelid='public.erp_notifications'::regclass
        AND conname='erp_notifications_target_view_check'
    ),
    'purchase_order_rejection_reason', (
      SELECT COALESCE(
        lower(pg_get_constraintdef(oid)) LIKE '%rejection_reason%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%>= 5%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%<= 300%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%rejected_by is not null%'
        AND lower(pg_get_constraintdef(oid)) LIKE '%rejected_at is not null%',
        false
      )
      FROM pg_constraint
      WHERE conrelid='public.purchase_orders'::regclass
        AND conname='purchase_orders_rejection_audit_check'
    )
  )
) AS historical_object_audit;
