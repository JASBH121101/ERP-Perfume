ALTER TABLE public.employees
 ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'Por definir',
 ADD COLUMN IF NOT EXISTS work_schedule TEXT NOT NULL DEFAULT 'Por definir',
 ADD COLUMN IF NOT EXISTS contract_start_date DATE,
 ADD COLUMN IF NOT EXISTS contract_end_date DATE;
UPDATE public.employees SET contract_start_date=COALESCE(contract_start_date,hire_date)
 WHERE contract_start_date IS NULL AND hire_date IS NOT NULL;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_contract_type_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_contract_type_check
 CHECK(contract_type IN ('Por definir','Indefinido','Temporal'));
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_work_schedule_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_work_schedule_check
 CHECK(work_schedule IN ('Por definir','Completa','Parcial'));
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_contract_dates_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_contract_dates_check CHECK(
 (contract_type='Temporal' AND contract_start_date IS NOT NULL AND contract_end_date IS NOT NULL AND contract_end_date>=contract_start_date)
 OR (contract_type IN ('Indefinido','Por definir') AND contract_end_date IS NULL));
ALTER TABLE public.employee_history
 ADD COLUMN IF NOT EXISTS from_contract_type TEXT,
 ADD COLUMN IF NOT EXISTS to_contract_type TEXT,
 ADD COLUMN IF NOT EXISTS from_work_schedule TEXT,
 ADD COLUMN IF NOT EXISTS to_work_schedule TEXT,
 ADD COLUMN IF NOT EXISTS from_contract_start_date DATE,
 ADD COLUMN IF NOT EXISTS to_contract_start_date DATE,
 ADD COLUMN IF NOT EXISTS from_contract_end_date DATE,
 ADD COLUMN IF NOT EXISTS to_contract_end_date DATE;
ALTER TABLE public.employee_history DROP CONSTRAINT IF EXISTS employee_history_event_type_check;
ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_event_type_check
 CHECK(event_type IN ('hire','position','compensation','status','contract'));
INSERT INTO public.employee_history(employee_id,event_type,effective_date,to_contract_type,to_work_schedule,to_contract_start_date,to_contract_end_date,reason)
 SELECT e.id,'contract',COALESCE(e.contract_start_date,e.hire_date,e.created_at::date),
 e.contract_type,e.work_schedule,e.contract_start_date,e.contract_end_date,'Condiciones contractuales iniciales migradas'
 FROM public.employees e WHERE NOT EXISTS(SELECT 1 FROM public.employee_history h WHERE h.employee_id=e.id AND h.event_type='contract');
CREATE OR REPLACE FUNCTION public.seed_employee_contract_history()
 RETURNS TRIGGER LANGUAGE plpgsql AS $$
 BEGIN
  INSERT INTO public.employee_history(employee_id,event_type,effective_date,to_contract_type,to_work_schedule,to_contract_start_date,to_contract_end_date,reason,changed_by)
  VALUES(NEW.id,'contract',COALESCE(NEW.contract_start_date,NEW.hire_date,CURRENT_DATE),
   NEW.contract_type,NEW.work_schedule,NEW.contract_start_date,NEW.contract_end_date,'Condiciones contractuales iniciales',NEW.created_by);
  RETURN NEW;
 END;
 $$;
DROP TRIGGER IF EXISTS employees_seed_contract_history_after_insert ON public.employees;
CREATE TRIGGER employees_seed_contract_history_after_insert AFTER INSERT ON public.employees
 FOR EACH ROW EXECUTE FUNCTION public.seed_employee_contract_history();
