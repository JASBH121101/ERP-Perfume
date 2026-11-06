-- 0013: private employee documents stored in the ERP R2 bucket.
-- Additive schema only. Apply on Neon Development before deploying the upload endpoint.

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN ('Contrato','Identificación','Constancia','Otro')),
  file_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('application/pdf','image/jpeg','image/png')),
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  uploaded_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_documents_employee_date_idx
  ON public.employee_documents(employee_id,created_at DESC);
