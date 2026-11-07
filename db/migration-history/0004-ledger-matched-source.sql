-- Prevent issuing more than one invoice for the same web order.
-- The preflight guard makes duplicate historical data an explicit migration failure.
DO $$
BEGIN
  IF EXISTS (
    SELECT order_id
    FROM public.invoices
    WHERE order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add invoices_order_id_unique_idx: duplicate invoices already reference the same order.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_id_unique_idx
  ON public.invoices (order_id)
  WHERE order_id IS NOT NULL;
