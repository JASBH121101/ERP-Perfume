-- 0012: inventory traceability, manual reversals and append-only ledger.
-- Additive migration. Existing history is preserved and classified as legacy/source-derived.

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS reference_document TEXT,
  ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES public.inventory_movements(id);

UPDATE public.inventory_movements
SET reason_code = CASE
  WHEN movement_type = 'Reversion' THEN 'reversal'
  WHEN reference_type = 'purchase_receipt' THEN 'purchase_receipt'
  WHEN reference_type = 'purchase' THEN 'purchase'
  WHEN reference_type = 'invoice' THEN 'sale_invoice'
  WHEN reference_type = 'order' THEN 'sale_order'
  WHEN reference_type = 'product_import' THEN 'catalog_import'
  WHEN reference_type = 'product' THEN 'opening_balance'
  WHEN reference_type = 'manual' AND movement_type = 'Entrada' THEN 'manual_receipt'
  WHEN reference_type = 'manual' AND movement_type = 'Salida' THEN 'manual_issue'
  WHEN reference_type = 'manual' AND movement_type = 'Ajuste' THEN 'physical_count'
  ELSE 'legacy'
END
WHERE reason_code IS NULL;

ALTER TABLE public.inventory_movements
  ALTER COLUMN reason_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_movements_reason_code_check'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT inventory_movements_reason_code_check
      CHECK (reason_code IN (
        'opening_balance',
        'catalog_import',
        'purchase_receipt',
        'purchase',
        'sale_order',
        'sale_invoice',
        'manual_receipt',
        'manual_issue',
        'physical_count',
        'correction',
        'reversal',
        'legacy'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_movements_reference_document_check'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT inventory_movements_reference_document_check
      CHECK (reference_document IS NULL OR char_length(btrim(reference_document)) BETWEEN 1 AND 120);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_single_reversal_idx
  ON public.inventory_movements (reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_movements_reason_created_idx
  ON public.inventory_movements (reason_code, created_at DESC);

-- A movement is an immutable fact. Correct it by inserting a linked reversal,
-- never by editing or deleting its original row.
CREATE OR REPLACE FUNCTION public.prevent_inventory_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is append-only; insert a reversal instead.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS inventory_movements_append_only ON public.inventory_movements;
CREATE TRIGGER inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_movement_mutation();

INSERT INTO public.permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order)
VALUES (
  'inventory.movements.reverse',
  'Revertir movimiento manual',
  'inventory',
  'inventory.adjustments.view',
  'action',
  20
)
ON CONFLICT(permission_key) DO NOTHING;
