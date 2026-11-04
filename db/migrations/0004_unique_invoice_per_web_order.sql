-- Prevent more than one invoice from being issued for the same web order.
-- A fresh production schema has no historical rows; IF NOT EXISTS makes a retry safe.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_id_unique_idx
  ON public.invoices (order_id)
  WHERE order_id IS NOT NULL;
