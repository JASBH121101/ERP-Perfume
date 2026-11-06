-- 0016: persistent operational notifications, client-error telemetry and purchase approval audit.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='purchase_orders_approval_audit_check'
      AND conrelid='public.purchase_orders'::regclass
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD CONSTRAINT purchase_orders_approval_audit_check
      CHECK ((approved_by IS NULL AND approved_at IS NULL) OR
             (approved_by IS NOT NULL AND approved_at IS NOT NULL));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.erp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('approval','contract','inventory','receivable','payable','system')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 600),
  entity_type TEXT,
  entity_id UUID,
  target_view TEXT NOT NULL CHECK (target_view IN ('purchaseOrders','hr','inventory','receivables','payables','settings')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  UNIQUE (recipient_user_id,dedupe_key)
);

CREATE INDEX IF NOT EXISTS erp_notifications_inbox_idx
  ON public.erp_notifications (recipient_user_id,resolved_at,read_at,created_at DESC);

CREATE TABLE IF NOT EXISTS public.erp_client_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL CHECK (error_type IN ('javascript_error','unhandled_rejection')),
  error_message TEXT NOT NULL CHECK (length(error_message) BETWEEN 1 AND 600),
  source_file TEXT,
  line_number INTEGER,
  column_number INTEGER,
  page_path TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS erp_client_errors_created_idx
  ON public.erp_client_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS erp_client_errors_user_created_idx
  ON public.erp_client_errors (user_id,created_at DESC);
