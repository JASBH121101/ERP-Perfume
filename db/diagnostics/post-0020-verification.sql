-- Follow-up checks after migration 0020 on Neon Development.
-- READ ONLY; run only after 0020 has been separately reviewed and applied.
SELECT
  data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='purchase_orders'
  AND column_name='exchange_rate';

SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='invoice_items'
  AND column_name='unit_cost_usd';

SELECT pg_get_constraintdef(oid) AS target_view_constraint
FROM pg_constraint
WHERE conrelid='public.erp_notifications'::regclass
  AND conname='erp_notifications_target_view_check';

SELECT pg_get_constraintdef(oid) AS rejection_audit_constraint
FROM pg_constraint
WHERE conrelid='public.purchase_orders'::regclass
  AND conname='purchase_orders_rejection_audit_check';
