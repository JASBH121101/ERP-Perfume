-- Product authenticity and inspiration reference.
-- Existing products remain explicitly unclassified; no historical product is
-- silently presented as original, inspired or generic.
ALTER TABLE products
  ADD COLUMN authenticity_type TEXT NOT NULL DEFAULT 'unspecified';

ALTER TABLE products
  ADD COLUMN inspired_by TEXT;

ALTER TABLE products
  ADD CONSTRAINT products_authenticity_type_check
  CHECK (authenticity_type IN ('unspecified', 'original', 'inspired', 'generic'));

ALTER TABLE products
  ADD CONSTRAINT products_inspired_by_check
  CHECK (
    (authenticity_type = 'inspired'
      AND NULLIF(BTRIM(inspired_by), '') IS NOT NULL
      AND CHAR_LENGTH(BTRIM(inspired_by)) <= 120)
    OR
    (authenticity_type <> 'inspired' AND inspired_by IS NULL)
  );
