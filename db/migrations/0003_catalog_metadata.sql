-- JB PARFUMS ERP — catalog and customer metadata.
-- Columns and constraints mirror the verified Development schema.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS wholesale_price_usd NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.products
  ALTER COLUMN images SET DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_images_array_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_images_array_check
      CHECK (jsonb_typeof(images) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_wholesale_price_usd_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_wholesale_price_usd_check
      CHECK (wholesale_price_usd IS NULL OR wholesale_price_usd >= 0);
  END IF;
END
$$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'particular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_customer_type_check'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_customer_type_check
      CHECK (customer_type IN ('particular','business'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_nonempty_uq
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';
CREATE INDEX IF NOT EXISTS products_active_category_idx
  ON public.products (active, category, name);
CREATE INDEX IF NOT EXISTS customers_active_name_idx
  ON public.customers (active, LOWER(name));
