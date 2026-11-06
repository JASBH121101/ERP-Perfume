-- 0018: purchase-order rejection reason and database-enforced rejection audit.
-- Schema-equivalent reconstruction from Neon Development inspected on 2026-11-06.
-- Original registered checksum: 2fe572455a79e20ef49139b229d7bbb6e0204375727e1e30be271f1b60644f57
-- This source is not claimed to be byte-for-byte identical to the original uncommitted SQL.
-- Do not replay on a branch where version 0018 is already registered.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_orders_rejection_audit_check'
      AND conrelid = 'public.purchase_orders'::regclass
  ) THEN
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
  END IF;
END;
$$;
