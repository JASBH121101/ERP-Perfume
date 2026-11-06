-- 0011: HR benefit calculations, employee commission settings and sales commission ledger.
-- Additive and safe to re-run. Apply to Neon Development before deploying this feature.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_commission_rate_check;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_commission_rate_check
  CHECK (commission_rate >= 0 AND commission_rate <= 100);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS salesperson_employee_id UUID REFERENCES public.employees(id);

CREATE INDEX IF NOT EXISTS invoices_salesperson_date_idx
  ON public.invoices (salesperson_employee_id, created_at DESC)
  WHERE salesperson_employee_id IS NOT NULL;

ALTER TABLE public.hr_payroll_items
  ADD COLUMN IF NOT EXISTS commissions_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inss_employee_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inss_employer_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aguinaldo_nio NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.employee_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  invoice_item_id UUID NOT NULL UNIQUE REFERENCES public.invoice_items(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  payroll_period_id UUID REFERENCES public.hr_payroll_periods(id) ON DELETE RESTRICT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  gross_sale_usd NUMERIC(14,2) NOT NULL CHECK (gross_sale_usd >= 0),
  discount_share_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_share_usd >= 0),
  net_sale_usd NUMERIC(14,2) NOT NULL CHECK (net_sale_usd >= 0),
  unit_cost_usd NUMERIC(14,4) NOT NULL CHECK (unit_cost_usd >= 0),
  gross_profit_usd NUMERIC(14,2) NOT NULL CHECK (gross_profit_usd >= 0),
  commission_rate NUMERIC(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_usd NUMERIC(14,2) NOT NULL CHECK (commission_usd >= 0),
  commission_nio NUMERIC(14,2) NOT NULL CHECK (commission_nio >= 0),
  exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
  status TEXT NOT NULL DEFAULT 'Pendiente'
    CHECK (status IN ('Pendiente','Asignada','Pagada','Anulada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS employee_commissions_employee_status_date_idx
  ON public.employee_commissions (employee_id, status, sale_date);
CREATE INDEX IF NOT EXISTS employee_commissions_payroll_period_idx
  ON public.employee_commissions (payroll_period_id)
  WHERE payroll_period_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS employee_commissions_invoice_idx
  ON public.employee_commissions (invoice_id, invoice_item_id);

INSERT INTO public.app_settings(setting_key, setting_value)
VALUES (
  'hr_inss_settings',
  '{"regime":"integral","employer_band":"under_50","employee_rate":7.0,"employer_rate":21.5}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;

-- Payroll periods can explicitly represent the annual 13th-month payment.
ALTER TABLE public.hr_payroll_periods
  ADD COLUMN IF NOT EXISTS period_type TEXT NOT NULL DEFAULT 'Ordinaria';
ALTER TABLE public.hr_payroll_periods
  DROP CONSTRAINT IF EXISTS hr_payroll_periods_period_type_check;
ALTER TABLE public.hr_payroll_periods
  ADD CONSTRAINT hr_payroll_periods_period_type_check
  CHECK (period_type IN ('Ordinaria','Aguinaldo'));

-- Preserve the USD commission amount and the exact FX rate used in each payroll.
ALTER TABLE public.hr_payroll_items
  ADD COLUMN IF NOT EXISTS commissions_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1;
ALTER TABLE public.hr_payroll_items
  DROP CONSTRAINT IF EXISTS hr_payroll_items_commission_exchange_rate_check;
ALTER TABLE public.hr_payroll_items
  ADD CONSTRAINT hr_payroll_items_commission_exchange_rate_check
  CHECK (commission_exchange_rate > 0);
