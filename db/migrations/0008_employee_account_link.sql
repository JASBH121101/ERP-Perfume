-- 0008: link an ERP account to an employee record.
-- Schema-equivalent recovery reconstructed from the Neon Development catalog on 2026-11-05.
-- The original SQL source was never committed; see docs/migration-history-reconciliation.md.
-- Additive and idempotent. Do not replay on a branch where this migration is already registered.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS employee_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_users_employee_id_fkey'
      AND conrelid = 'public.app_users'::regclass
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_employee_id_fkey
      FOREIGN KEY (employee_id)
      REFERENCES public.employees(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_employee_id_unique_idx
  ON public.app_users(employee_id)
  WHERE employee_id IS NOT NULL;
