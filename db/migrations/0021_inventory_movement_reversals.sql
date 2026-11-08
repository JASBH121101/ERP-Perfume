-- 0021: immutable inventory ledger and controlled manual reversals.
-- New version adapted from the reviewed traceability proposal. The historic 0012
-- versions belong to HR and are not interchangeable; this change is numbered 0021.

DO $$
BEGIN
  IF EXISTS (
    SELECT reference_id
    FROM public.inventory_movements
    WHERE reference_type = 'reversal' AND reference_id IS NOT NULL
    GROUP BY reference_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate inventory reversals exist; reconcile them before enabling the unique reversal guard.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movement_single_reversal_uq
  ON public.inventory_movements (reference_id)
  WHERE reference_type = 'reversal' AND reference_id IS NOT NULL;

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

INSERT INTO public.permission_catalog
  (permission_key,label,module_key,parent_key,permission_type,sort_order)
VALUES
  ('inventory.movements.reverse','Revertir movimiento manual','inventory','inventory.adjustments.view','action',20)
ON CONFLICT (permission_key) DO NOTHING;

-- Owner retains the global bypass. Admin receives the action by default, while
-- user-level permission overrides can still deny it.
INSERT INTO public.role_template_permissions (role_key,permission_key,allowed)
SELECT 'admin','inventory.movements.reverse',TRUE
WHERE EXISTS (SELECT 1 FROM public.erp_roles WHERE role_key='admin')
ON CONFLICT (role_key,permission_key)
DO UPDATE SET allowed=EXCLUDED.allowed;
