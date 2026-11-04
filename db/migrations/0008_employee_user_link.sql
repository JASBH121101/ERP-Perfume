-- 0008: optional one-to-one link between an employee record and ERP access.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_employee_id_uq
  ON public.app_users(employee_id)
  WHERE employee_id IS NOT NULL;
