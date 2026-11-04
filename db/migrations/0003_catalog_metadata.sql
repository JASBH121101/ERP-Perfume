-- JB PARFUMS ERP — catalog and customer metadata.
-- Reconstructed from the verified Development schema.
ALTER TABLE public.products
  ADD COLUMN barcode TEXT,
  ADD COLUMN description TEXT,
  ADD COLUMN supplier_name TEXT,
  ADD COLUMN wholesale_price_usd NUMERIC(14,2),
  ADD COLUMN tone TEXT,
  ADD COLUMN notes TEXT,
  ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.products
  ADD CONSTRAINT products_images_array_check
    CHECK (jsonb_typeof(images) = 'array'),
  ADD CONSTRAINT products_wholesale_price_usd_check
    CHECK (wholesale_price_usd IS NULL OR wholesale_price_usd >= 0);

ALTER TABLE public.customers
  ADD COLUMN customer_type TEXT NOT NULL DEFAULT 'particular'
    CHECK (customer_type IN ('particular','business'));

CREATE UNIQUE INDEX products_barcode_nonempty_uq
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';
CREATE INDEX products_active_category_idx
  ON public.products (active, category, name);
CREATE INDEX customers_active_name_idx
  ON public.customers (active, LOWER(name));
