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

    ('column','0018','purchase_orders.rejection_reason')
),
checked AS (
  SELECT e.*,
    CASE e.kind
      WHEN 'table' THEN to_regclass('public.' || e.object_name) IS NOT NULL
      WHEN 'sequence' THEN to_regclass('public.' || e.object_name) IS NOT NULL
      WHEN 'column' THEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name || '.' || c.column_name = e.object_name
      )
      WHEN 'constraint' THEN EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.connamespace = 'public'::regnamespace
          AND c.conname = e.object_name
      )
      WHEN 'index' THEN EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class x ON x.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = x.relnamespace
        WHERE n.nspname = 'public'
          AND x.relname = e.object_name
          AND i.indisvalid
          AND i.indisready
      )
      WHEN 'trigger' THEN EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND t.tgname = e.object_name
          AND NOT t.tgisinternal
      )
      WHEN 'function' THEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = e.object_name
      )
      WHEN 'setting' THEN EXISTS (
        SELECT 1 FROM public.app_settings s
        WHERE s.setting_key = e.object_name
      )
      ELSE false
    END AS present
  FROM expected e
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
  )
) AS historical_object_audit;
