-- 0010: server-generated, collision-resistant purchase order codes.
-- Additive only. Existing purchase_orders.order_number UNIQUE constraint remains the final guard.
CREATE SEQUENCE IF NOT EXISTS public.purchase_order_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- Continue above any earlier codes that already use the managed JB-OC format.
SELECT setval(
  'public.purchase_order_number_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX((regexp_match(order_number, '^JB-OC-[0-9]{4}-([0-9]+)$'))[1]::bigint)
       FROM public.purchase_orders),
      0
    ) + 1,
    1
  ),
  false
);
