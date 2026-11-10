-- 0026: vacation payment ledger, payroll employer-cost fields and pricing defaults.
-- Additive only. Apply to Development after review; never apply to Production from this change.
ALTER TABLE public.hr_payroll_items
  ADD COLUMN IF NOT EXISTS ir_employee_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inatec_employer_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vacation_provision_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aguinaldo_provision_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_total_cost_nio NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.hr_payroll_items DROP CONSTRAINT IF EXISTS hr_payroll_items_labor_costs_nonnegative_check;
ALTER TABLE public.hr_payroll_items ADD CONSTRAINT hr_payroll_items_labor_costs_nonnegative_check CHECK (
 ir_employee_nio>=0 AND inatec_employer_nio>=0 AND vacation_provision_nio>=0 AND
 aguinaldo_provision_nio>=0 AND employer_total_cost_nio>=0
);
CREATE TABLE IF NOT EXISTS public.hr_vacation_settlements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
 leave_request_id UUID REFERENCES public.hr_leave_requests(id) ON DELETE RESTRICT,
 settlement_type TEXT NOT NULL CHECK(settlement_type IN ('Disfrute','Compensacion')),
 days NUMERIC(8,2) NOT NULL CHECK(days>0),
 salary_basis_nio NUMERIC(14,2) NOT NULL CHECK(salary_basis_nio>0),
 amount_nio NUMERIC(14,2) NOT NULL CHECK(amount_nio>=0),
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK(status IN ('Pendiente','Pagada','Anulada')),
 payment_date DATE, paid_at TIMESTAMPTZ, payment_reference TEXT, notes TEXT,
 created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT hr_vacation_settlements_paid_fields_check CHECK((status='Pagada' AND payment_date IS NOT NULL AND paid_at IS NOT NULL) OR status<>'Pagada'),
 CONSTRAINT hr_vacation_settlements_leave_request_unique UNIQUE(leave_request_id)
);
CREATE INDEX IF NOT EXISTS hr_vacation_settlements_employee_status_idx ON public.hr_vacation_settlements(employee_id,status,payment_date DESC);
CREATE INDEX IF NOT EXISTS hr_vacation_settlements_created_idx ON public.hr_vacation_settlements(created_at DESC);
CREATE OR REPLACE FUNCTION public.guard_hr_vacation_settlement_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Vacation settlement history cannot be deleted; record a compensating entry.'; END IF;
 IF OLD.status<>'Pendiente' THEN RAISE EXCEPTION 'Only pending vacation settlement entries may change status.'; END IF;
 IF NEW.id<>OLD.id OR NEW.employee_id<>OLD.employee_id OR NEW.leave_request_id IS DISTINCT FROM OLD.leave_request_id OR
 NEW.settlement_type<>OLD.settlement_type OR NEW.days<>OLD.days OR NEW.salary_basis_nio<>OLD.salary_basis_nio OR
 NEW.amount_nio<>OLD.amount_nio OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at<>OLD.created_at THEN
 RAISE EXCEPTION 'Vacation settlement details are immutable; create a new ledger entry.'; END IF;
 IF NEW.status NOT IN ('Pagada','Anulada') THEN RAISE EXCEPTION 'A pending vacation settlement may only be paid or cancelled.'; END IF;
 NEW.updated_at:=NOW();
 IF NEW.status='Pagada' THEN NEW.payment_date:=COALESCE(NEW.payment_date,CURRENT_DATE); NEW.paid_at:=COALESCE(NEW.paid_at,NOW());
 ELSE NEW.payment_date:=NULL; NEW.paid_at:=NULL; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hr_vacation_settlements_history_guard ON public.hr_vacation_settlements;
CREATE TRIGGER hr_vacation_settlements_history_guard BEFORE UPDATE OR DELETE ON public.hr_vacation_settlements
FOR EACH ROW EXECUTE FUNCTION public.guard_hr_vacation_settlement_history();
INSERT INTO public.app_settings(setting_key,setting_value) VALUES
('hr_payroll_settings','{"ir_method":"annual_projection","ir_exempt_annual_nio":100000,"ir_brackets":[{"upper":100000,"base_tax":0,"rate":0,"excess":0},{"upper":200000,"base_tax":0,"rate":0.15,"excess":100000},{"upper":350000,"base_tax":15000,"rate":0.20,"excess":200000},{"upper":500000,"base_tax":45000,"rate":0.25,"excess":350000},{"upper":null,"base_tax":82500,"rate":0.30,"excess":500000}],"inatec_employer_rate":2,"vacation_days_per_month":2.5,"inss_employee_rate":7,"inss_employer_rate_under_50":21.5,"inss_employer_rate_50_plus":22.5}'::jsonb),
('product_pricing_settings','{"default_target_margin_percent":35,"default_promotional_margin_percent":20,"default_variable_fee_percent":0,"currency":"USD"}'::jsonb)
ON CONFLICT(setting_key) DO NOTHING;
