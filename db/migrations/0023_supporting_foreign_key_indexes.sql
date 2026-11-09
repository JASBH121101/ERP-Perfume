-- 0023: supporting indexes for remaining nullable and actor foreign keys.
-- Additive only. These indexes cover actual missing FK lookup paths found
-- by live catalog inspection on Development and a clean-install QA branch.

CREATE INDEX IF NOT EXISTS app_users_role_template_key_idx
  ON public.app_users (role_template_key)
  WHERE role_template_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_journal_entries_created_by_idx
  ON public.purchase_journal_entries (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_approved_by_idx
  ON public.purchase_orders (approved_by)
  WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_rejected_by_idx
  ON public.purchase_orders (rejected_by)
  WHERE rejected_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_receipts_emitted_by_idx
  ON public.purchase_receipts (emitted_by)
  WHERE emitted_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_receipts_posted_by_idx
  ON public.purchase_receipts (posted_by)
  WHERE posted_by IS NOT NULL;
