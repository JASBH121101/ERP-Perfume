-- 0017: explicit purchase-order rejection with responsible user and timestamp.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN (
    'Borrador','Enviada','Confirmada','Rechazada','Recepción parcial','Recibida',
    'Cerrada con faltante','Cancelada'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='purchase_orders_rejection_audit_check'
      AND conrelid='public.purchase_orders'::regclass
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_rejection_audit_check
      CHECK ((rejected_by IS NULL AND rejected_at IS NULL) OR
             (rejected_by IS NOT NULL AND rejected_at IS NOT NULL));
  END IF;
END $$;
