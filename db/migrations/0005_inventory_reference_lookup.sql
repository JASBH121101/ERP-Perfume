-- Speed up idempotency checks for order and invoice inventory movements.
CREATE INDEX IF NOT EXISTS inventory_reference_product_idx
  ON public.inventory_movements (reference_type, reference_id, product_id);
