-- JB PARFUMS ERP — append-only inventory traceability and controlled manual reversals.
-- This migration only backfills the origin reference for opening balances and adds ledger protections.
-- No product balances or financial records are recalculated.

UPDATE public.inventory_movements
SET reference_id = product_id::text
WHERE reference_type = 'product'
  AND note = 'Existencias iniciales'
  AND reference_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_single_reversal_uq
  ON public.inventory_movements (reference_id)
  WHERE reference_type = 'reversal' AND reference_id IS NOT NULL;

INSERT INTO public.permission_catalog
  (permission_key,label,module_key,parent_key,permission_type,sort_order)
VALUES
  ('inventory.movements.reverse','Revertir movimiento manual','inventory','inventory.adjustments.view','action',20)
ON CONFLICT (permission_key) DO NOTHING;

-- The owner bypass is explicit. Administrators receive this action by default;
-- individual user overrides can still deny it.
INSERT INTO public.role_template_permissions (role_key,permission_key,allowed)
SELECT 'admin','inventory.movements.reverse',TRUE
WHERE EXISTS (SELECT 1 FROM public.erp_roles WHERE role_key='admin')
ON CONFLICT (role_key,permission_key)
DO UPDATE SET allowed=EXCLUDED.allowed;

CREATE OR REPLACE FUNCTION public.prevent_inventory_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is append-only; register a controlled reversal instead'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS inventory_movements_append_only ON public.inventory_movements;

CREATE TRIGGER inventory_movements_append_only
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.prevent_inventory_movement_mutation();
