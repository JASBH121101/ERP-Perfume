-- JB PARFUMS ERP: DGI compliance support records.
-- Development-first additive migration. Does not alter invoices or authorize fiscal invoicing.
CREATE TABLE IF NOT EXISTS public.dgi_support_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_date DATE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'purchase_invoice','service_invoice','rent_receipt',
    'municipal_payment','dgi_payment','other'
  )),
  issuer TEXT NOT NULL CHECK (length(issuer) BETWEEN 1 AND 180),
  reference_number TEXT,
  description TEXT,
  fiscal_period TEXT CHECK (fiscal_period IS NULL OR fiscal_period ~ '^\\d{4}-(0[1-9]|1[0-2])$'),
  currency TEXT NOT NULL DEFAULT 'NIO' CHECK (currency IN ('NIO','USD')),
  original_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (original_amount >= 0),
  amount_nio NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_nio >= 0),
  formal_invoice BOOLEAN NOT NULL DEFAULT FALSE,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('application/pdf','image/jpeg','image/png')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 5242880),
  notes TEXT,
  created_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dgi_support_documents_date_idx
  ON public.dgi_support_documents (document_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS dgi_support_documents_type_period_idx
  ON public.dgi_support_documents (document_type, fiscal_period);

INSERT INTO public.app_settings(setting_key, setting_value)
VALUES (
  'dgi_compliance',
  '{
    "taxpayer_name":"",
    "ruc":"",
    "business_address":"",
    "regime_status":"not_confirmed",
    "quota_fixed_amount_nio":0,
    "certificate_available":false,
    "certificate_displayed":false,
    "computerized_invoicing_status":"not_confirmed",
    "dgi_confirmation_date":""
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;
