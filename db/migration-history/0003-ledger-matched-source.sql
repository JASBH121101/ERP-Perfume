-- JB PARFUMS ERP · catalog metadata for Neon-backed product records
-- Additive migration for Development validation. Product images remain private R2 objects;
-- this column stores object keys/metadata only, never public URLs or binary content.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS wholesale_price_usd numeric(14,2),
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
  ADD CONSTRAINT products_wholesale_price_usd_check
  CHECK (wholesale_price_usd IS NULL OR wholesale_price_usd >= 0);

ALTER TABLE products
  ADD CONSTRAINT products_images_array_check
  CHECK (jsonb_typeof(images) = 'array');

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_nonempty_uq
  ON products (barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'particular';

ALTER TABLE customers
  ADD CONSTRAINT customers_customer_type_check
  CHECK (customer_type IN ('particular','business'));

CREATE INDEX IF NOT EXISTS customers_active_name_idx
  ON customers (active, lower(name));

CREATE INDEX IF NOT EXISTS products_active_category_idx
  ON products (active, category, name);
