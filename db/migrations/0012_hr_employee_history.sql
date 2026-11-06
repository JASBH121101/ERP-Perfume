-- 0012: permanent employee codes and effective-dated HR history.
-- Additive migration. Apply to Neon Development before deploying this release.

CREATE SEQUENCE IF NOT EXISTS public.employee_code_sequence START WITH 1 INCREMENT BY 1;
SELECT setval(
  'public.employee_code_sequence',
  COALESCE((SELECT MAX((substring(employee_code FROM '^JB-EMP-([0-9]+)$'))::bigint)
            FROM public.employees WHERE employee_code ~ '^JB-EMP-[0-9]+$'),0)+1,
  false
);

UPDATE public.employees
SET employee_code='JB-EMP-'||LPAD(nextval('public.employee_code_sequence')::text,4,'0')
WHERE employee_code IS NULL OR BTRIM(employee_code)='';
ALTER TABLE public.employees
  ALTER COLUMN employee_code SET DEFAULT ('JB-EMP-'||LPAD(nextval('public.employee_code_sequence')::text,4,'0')),
  ALTER COLUMN employee_code SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.employee_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK(event_type IN ('hire','position','compensation','status')),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_position TEXT,to_position TEXT,from_department TEXT,to_department TEXT,
  from_salary_nio NUMERIC(14,2),to_salary_nio NUMERIC(14,2),
  from_commission_enabled BOOLEAN,to_commission_enabled BOOLEAN,
  from_commission_rate NUMERIC(5,2),to_commission_rate NUMERIC(5,2),
  from_status TEXT,to_status TEXT,reason TEXT,
  changed_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS employee_history_employee_date_idx
  ON public.employee_history(employee_id,effective_date DESC,created_at DESC);

INSERT INTO public.employee_history(employee_id,event_type,effective_date,to_position,to_department,reason)
SELECT e.id,'hire',COALESCE(e.hire_date,e.created_at::date),e.position,e.department,'Registro inicial migrado'
FROM public.employees e
WHERE NOT EXISTS(SELECT 1 FROM public.employee_history h WHERE h.employee_id=e.id AND h.event_type='hire');

INSERT INTO public.employee_history(employee_id,event_type,effective_date,to_salary_nio,to_commission_enabled,to_commission_rate,reason)
SELECT e.id,'compensation',COALESCE(e.hire_date,e.created_at::date),e.salary_nio,
       COALESCE(e.commission_enabled,FALSE),COALESCE(e.commission_rate,0),'Condiciones iniciales migradas'
FROM public.employees e
WHERE NOT EXISTS(SELECT 1 FROM public.employee_history h WHERE h.employee_id=e.id AND h.event_type='compensation');

CREATE OR REPLACE FUNCTION public.seed_employee_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.employee_history(employee_id,event_type,effective_date,to_position,to_department,reason,changed_by)
  VALUES(NEW.id,'hire',COALESCE(NEW.hire_date,CURRENT_DATE),NEW.position,NEW.department,'Alta inicial',NEW.created_by);
  INSERT INTO public.employee_history(employee_id,event_type,effective_date,to_salary_nio,to_commission_enabled,to_commission_rate,reason,changed_by)
  VALUES(NEW.id,'compensation',COALESCE(NEW.hire_date,CURRENT_DATE),NEW.salary_nio,
         COALESCE(NEW.commission_enabled,FALSE),COALESCE(NEW.commission_rate,0),'Condiciones iniciales',NEW.created_by);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS employees_seed_history_after_insert ON public.employees;
CREATE TRIGGER employees_seed_history_after_insert AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.seed_employee_history();
