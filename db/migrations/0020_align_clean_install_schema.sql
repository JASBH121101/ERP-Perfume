-- 0020: align clean installs with the audited Neon Development schema.
-- Forward-only reconciliation; additive or constraint replacement only.
-- This closes schema drift found by comparing a fresh 0001-0019 install to Development.

-- Worker product/invoice flows persist acquisition cost per invoice line.
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS unit_cost_usd NUMERIC(14,4) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_unit_cost_usd_check;
ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_unit_cost_usd_check
  CHECK (unit_cost_usd >= 0);

-- Preserve the six-decimal exchange-rate precision already used by Development.
ALTER TABLE public.purchase_orders
  ALTER COLUMN exchange_rate TYPE NUMERIC(14,6)
  USING exchange_rate::NUMERIC(14,6);

-- Development allows the billing notification destination in addition to the
-- other currently supported notification targets.
ALTER TABLE public.erp_notifications
  DROP CONSTRAINT IF EXISTS erp_notifications_target_view_check;
ALTER TABLE public.erp_notifications
  ADD CONSTRAINT erp_notifications_target_view_check
  CHECK (target_view IN (
    'purchaseOrders','hr','inventory','receivables','payables','settings','billing'
  ));

-- 0017 created a pair-only audit check. 0018's IF NOT EXISTS did not replace it
-- on clean installs, leaving the stricter rejection-reason rule unapplied.
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_rejection_audit_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_rejection_audit_check
  CHECK (
    (
      status = 'Rechazada'
      AND rejected_by IS NOT NULL
      AND rejected_at IS NOT NULL
      AND length(btrim(COALESCE(rejection_reason, ''))) BETWEEN 5 AND 300
    )
    OR
    (
      status <> 'Rechazada'
      AND rejected_by IS NULL
      AND rejected_at IS NULL
      AND rejection_reason IS NULL
    )
  );
