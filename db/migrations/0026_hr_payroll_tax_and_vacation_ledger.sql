-- Payroll withholding and append-only vacation history.
-- This migration is additive. Existing HR records are preserved.
ALTER TABLE hr_payroll_periods
  ADD COLUMN period_frequency TEXT NOT NULL DEFAULT 'monthly',
  ADD CONSTRAINT hr_payroll_periods_frequency_check
    CHECK (period_frequency IN ('monthly', 'biweekly', 'weekly'));

ALTER TABLE hr_payroll_items
  ADD COLUMN ir_taxable_income_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN ir_withheld_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN inatec_employer_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT hr_payroll_items_ir_taxable_nonnegative CHECK (ir_taxable_income_nio >= 0),
  ADD CONSTRAINT hr_payroll_items_ir_withheld_nonnegative CHECK (ir_withheld_nio >= 0),
  ADD CONSTRAINT hr_payroll_items_inatec_nonnegative CHECK (inatec_employer_nio >= 0);

CREATE TABLE hr_vacation_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  source_leave_request_id UUID REFERENCES hr_leave_requests(id) ON DELETE RESTRICT,
  payroll_item_id UUID REFERENCES hr_payroll_items(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('enjoyed', 'cash_payment', 'cash_settlement', 'adjustment', 'opening')),
  effective_date DATE NOT NULL,
  days_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_nio NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_vacation_ledger_amount_nonnegative CHECK (amount_nio >= 0),
  CONSTRAINT hr_vacation_ledger_entry_shape CHECK (
    (entry_type = 'enjoyed' AND days_delta < 0 AND amount_nio >= 0) OR
    (entry_type = 'cash_payment' AND days_delta = 0 AND amount_nio > 0) OR
    (entry_type = 'cash_settlement' AND days_delta < 0 AND amount_nio > 0) OR
    (entry_type IN ('adjustment', 'opening') AND (days_delta <> 0 OR amount_nio > 0))
  )
);

CREATE UNIQUE INDEX hr_vacation_ledger_leave_request_uq
  ON hr_vacation_ledger(source_leave_request_id)
  WHERE source_leave_request_id IS NOT NULL;
CREATE INDEX hr_vacation_ledger_employee_date_idx
  ON hr_vacation_ledger(employee_id, effective_date DESC, created_at DESC);
CREATE INDEX hr_vacation_ledger_payroll_item_idx
  ON hr_vacation_ledger(payroll_item_id)
  WHERE payroll_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_hr_vacation_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hr_vacation_ledger is append-only; record a correcting adjustment instead';
END;
$$;

CREATE TRIGGER hr_vacation_ledger_no_update
  BEFORE UPDATE OR DELETE ON hr_vacation_ledger
  FOR EACH ROW EXECUTE FUNCTION reject_hr_vacation_ledger_mutation();

-- Preserve approved vacation days already taken in the old request table.
INSERT INTO hr_vacation_ledger(
  employee_id, source_leave_request_id, entry_type, effective_date,
  days_delta, amount_nio, notes
)
SELECT l.employee_id, l.id, 'enjoyed', l.end_date, -ABS(l.days), 0,
       'Migración 0026: disfrute histórico desde solicitud aprobada'
FROM hr_leave_requests l
WHERE l.status = 'Aprobado'
  AND l.leave_type IN ('Vacaciones', 'Vacation')
  AND COALESCE(l.days, 0) > 0
ON CONFLICT (source_leave_request_id) WHERE source_leave_request_id IS NOT NULL DO NOTHING;

CREATE OR REPLACE FUNCTION hr_ir_annual_tax(p_income NUMERIC, p_brackets JSONB)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_income, 0) <= 0 THEN 0::NUMERIC
    ELSE COALESCE((
      SELECT ROUND(
        (item.value->>'base')::NUMERIC +
        GREATEST(0, p_income - (item.value->>'excess')::NUMERIC) *
        (item.value->>'rate')::NUMERIC / 100,
        2
      )
      FROM jsonb_array_elements(p_brackets) AS item(value)
      WHERE item.value->>'upper' IS NULL
         OR p_income <= (item.value->>'upper')::NUMERIC
      ORDER BY COALESCE((item.value->>'upper')::NUMERIC, 'Infinity'::NUMERIC)
      LIMIT 1
    ), 0::NUMERIC)
  END;
$$;

INSERT INTO app_settings(setting_key, setting_value, updated_at)
VALUES
  ('hr_tax_settings', '{
    "tax_year": 2026,
    "inatec_rate": 2,
    "ir_brackets": [
      {"upper":100000,"base":0,"rate":0,"excess":0},
      {"upper":200000,"base":0,"rate":15,"excess":100000},
      {"upper":350000,"base":15000,"rate":20,"excess":200000},
      {"upper":500000,"base":45000,"rate":25,"excess":350000},
      {"upper":null,"base":82500,"rate":30,"excess":500000}
    ],
    "method":"period-average annual projection; review each fiscal year"
  }'::JSONB, NOW()),
  ('hr_pricing_settings', '{
    "target_margin_percent":35,
    "commission_rate_percent":3,
    "commission_basis":"gross_profit",
    "payment_fee_percent":0,
    "other_variable_cost_percent":0
  }'::JSONB, NOW())
ON CONFLICT (setting_key) DO NOTHING;
