-- JB PARFUMS ERP — supplier contact details and product sourcing links.
-- Additive only: existing suppliers, products, purchase history and stock are preserved.

ALTER TABLE public.suppliers
  ADD COLUMN address TEXT,
  ADD COLUMN payment_terms TEXT,
  ADD COLUMN minimum_order_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN lead_time_days INTEGER;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_minimum_order_nonnegative_check CHECK (minimum_order_usd >= 0),
  ADD CONSTRAINT suppliers_lead_time_range_check CHECK (lead_time_days IS NULL OR lead_time_days BETWEEN 0 AND 365);

CREATE UNIQUE INDEX suppliers_normalized_name_uq
  ON public.suppliers (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

CREATE TABLE public.supplier_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_phone_numbers_phone_nonempty_check CHECK (length(btrim(phone)) BETWEEN 8 AND 20),
  CONSTRAINT supplier_phone_numbers_supplier_phone_uq UNIQUE (supplier_id, phone),
  CONSTRAINT supplier_phone_numbers_supplier_order_uq UNIQUE (supplier_id, display_order)
);

CREATE INDEX supplier_phone_numbers_supplier_idx
  ON public.supplier_phone_numbers (supplier_id, display_order);

ALTER TABLE public.products
  ADD COLUMN supplier_id UUID;

ALTER TABLE public.products
  ADD CONSTRAINT products_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX products_supplier_id_idx ON public.products (supplier_id) WHERE supplier_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_phone_numbers TO jb_erp_runtime_sql;
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO jb_erp_runtime_sql;
GRANT SELECT, UPDATE ON public.products TO jb_erp_runtime_sql;
