-- 0009: supplier invoices and supplier payable payments.
-- Schema-equivalent recovery reconstructed from the Neon Development catalog on 2026-11-05.
-- The original SQL source was never committed; see docs/migration-history-reconciliation.md.
-- Additive and idempotent. Do not replay on a branch where this migration is already registered.

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
  exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  paid_amount_usd NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (paid_amount_usd >= 0 AND paid_amount_usd <= amount_usd),
  status TEXT NOT NULL DEFAULT 'Pendiente'
    CHECK (status IN ('Pendiente','Abono parcial','Pagada','Anulada')),
  notes TEXT,
  created_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.supplier_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id),
  account_id UUID NOT NULL REFERENCES public.cash_accounts(id),
  currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
  exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  payment_reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_invoices_supplier_date_idx
  ON public.supplier_invoices(supplier_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS supplier_invoices_status_due_idx
  ON public.supplier_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS supplier_invoices_purchase_order_idx
  ON public.supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS supplier_invoice_payments_invoice_idx
  ON public.supplier_invoice_payments(supplier_invoice_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS supplier_invoice_payments_account_idx
  ON public.supplier_invoice_payments(account_id, paid_at DESC);
