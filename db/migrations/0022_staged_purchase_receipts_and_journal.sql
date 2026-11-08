-- 0022: staged purchase receipts and immutable purchase journal.
-- Emission records the supplier invoice and reserves ordered quantities.
-- Inventory, payables and the accounting journal change only on explicit posting.

CREATE SEQUENCE IF NOT EXISTS public.purchase_receipt_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

SELECT setval(
  'public.purchase_receipt_number_seq',
  GREATEST(
    COALESCE((SELECT MAX(receipt_number::bigint)
      FROM public.purchase_receipts
      WHERE receipt_number ~ '^[0-9]+$'), 0) + 1,
    1
  ),
  false
);

CREATE SEQUENCE IF NOT EXISTS public.purchase_code_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

SELECT setval(
  'public.purchase_code_seq',
  GREATEST(COALESCE((SELECT MAX(purchase_code) FROM public.purchase_receipts), 0) + 1, 1),
  false
);

CREATE SEQUENCE IF NOT EXISTS public.purchase_journal_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

ALTER TABLE public.purchase_receipts
  ADD COLUMN IF NOT EXISTS document_status TEXT NOT NULL DEFAULT 'Contabilizada',
  ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_currency TEXT,
  ADD COLUMN IF NOT EXISTS invoice_exchange_rate NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS invoice_original_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS invoice_total_usd NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS actual_taxes_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS emitted_by UUID REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS emitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purchase_code BIGINT,
  ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES public.supplier_invoices(id);

UPDATE public.purchase_receipts
SET emitted_by = COALESCE(emitted_by, received_by),
    emitted_at = COALESCE(emitted_at, received_at),
    posted_by = COALESCE(posted_by, received_by),
    posted_at = COALESCE(posted_at, received_at)
WHERE document_status = 'Contabilizada';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_receipts'::regclass
      AND conname = 'purchase_receipts_document_status_check'
  ) THEN
    ALTER TABLE public.purchase_receipts
      ADD CONSTRAINT purchase_receipts_document_status_check
      CHECK (document_status IN ('Emitida','Contabilizada','Anulada'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_receipts'::regclass
      AND conname = 'purchase_receipts_invoice_currency_check'
  ) THEN
    ALTER TABLE public.purchase_receipts
      ADD CONSTRAINT purchase_receipts_invoice_currency_check
      CHECK (invoice_currency IS NULL OR invoice_currency IN ('USD','NIO'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_receipts'::regclass
      AND conname = 'purchase_receipts_nonnegative_invoice_values_check'
  ) THEN
    ALTER TABLE public.purchase_receipts
      ADD CONSTRAINT purchase_receipts_nonnegative_invoice_values_check
      CHECK (
        actual_taxes_usd >= 0 AND
        (invoice_exchange_rate IS NULL OR invoice_exchange_rate > 0) AND
        (invoice_original_total IS NULL OR invoice_original_total > 0) AND
        (invoice_total_usd IS NULL OR invoice_total_usd > 0)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_receipts_purchase_code_uq
  ON public.purchase_receipts(purchase_code)
  WHERE purchase_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_receipts_supplier_invoice_uq
  ON public.purchase_receipts(supplier_invoice_id)
  WHERE supplier_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_receipts_status_date_idx
  ON public.purchase_receipts(document_status, emitted_at DESC);

CREATE INDEX IF NOT EXISTS purchase_receipts_invoice_lookup_idx
  ON public.purchase_receipts(supplier_invoice_number, supplier_invoice_date)
  WHERE supplier_invoice_number IS NOT NULL;

ALTER TABLE public.purchase_receipt_items
  ADD COLUMN IF NOT EXISTS invoice_unit_cost_input NUMERIC(14,4) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_receipt_items'::regclass
      AND conname = 'purchase_receipt_items_invoice_unit_cost_check'
  ) THEN
    ALTER TABLE public.purchase_receipt_items
      ADD CONSTRAINT purchase_receipt_items_invoice_unit_cost_check
      CHECK (invoice_unit_cost_input >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number BIGINT NOT NULL UNIQUE,
  purchase_receipt_id UUID NOT NULL UNIQUE REFERENCES public.purchase_receipts(id),
  purchase_code BIGINT NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
  exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
  total_debit_usd NUMERIC(14,2) NOT NULL CHECK (total_debit_usd > 0),
  total_credit_usd NUMERIC(14,2) NOT NULL CHECK (total_credit_usd > 0),
  status TEXT NOT NULL DEFAULT 'Contabilizado' CHECK (status IN ('Contabilizado','Anulado')),
  created_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (total_debit_usd = total_credit_usd)
);

CREATE TABLE IF NOT EXISTS public.purchase_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.purchase_journal_entries(id),
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  account_key TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit_usd >= 0),
  credit_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (journal_entry_id, line_number),
  CHECK ((debit_usd > 0 AND credit_usd = 0) OR (credit_usd > 0 AND debit_usd = 0))
);

CREATE INDEX IF NOT EXISTS purchase_journal_entries_date_idx
  ON public.purchase_journal_entries(entry_date DESC, journal_number DESC);

CREATE INDEX IF NOT EXISTS purchase_journal_lines_entry_idx
  ON public.purchase_journal_lines(journal_entry_id, line_number);

CREATE OR REPLACE FUNCTION public.prevent_purchase_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'purchase journal is append-only; use a controlled reversal'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS purchase_journal_entries_append_only ON public.purchase_journal_entries;
CREATE TRIGGER purchase_journal_entries_append_only
BEFORE UPDATE OR DELETE ON public.purchase_journal_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_purchase_journal_mutation();

DROP TRIGGER IF EXISTS purchase_journal_lines_append_only ON public.purchase_journal_lines;
CREATE TRIGGER purchase_journal_lines_append_only
BEFORE UPDATE OR DELETE ON public.purchase_journal_lines
FOR EACH ROW EXECUTE FUNCTION public.prevent_purchase_journal_mutation();

INSERT INTO public.permission_catalog
  (permission_key,label,module_key,parent_key,permission_type,sort_order)
VALUES
  ('purchases.receipts.post','Contabilizar recepción','purchases','purchases.receipts.view','action',31),
  ('purchases.receipts.journal.view','Consultar comprobante diario','purchases','purchases.receipts.view','action',32)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.role_template_permissions (role_key,permission_key,allowed)
SELECT role_key,permission_key,TRUE
FROM (VALUES
  ('admin','purchases.receipts.post'),
  ('finance','purchases.receipts.post'),
  ('admin','purchases.receipts.journal.view'),
  ('finance','purchases.receipts.journal.view'),
  ('inventory','purchases.receipts.journal.view')
) AS grants(role_key,permission_key)
WHERE EXISTS (SELECT 1 FROM public.erp_roles r WHERE r.role_key=grants.role_key)
ON CONFLICT (role_key,permission_key)
DO UPDATE SET allowed=EXCLUDED.allowed;
