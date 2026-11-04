-- JB PARFUMS ERP — procurement orders and receiving.
-- Reconstructed from the verified Development schema. Safe to apply to an empty database.
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
  exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
  subtotal_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal_usd >= 0),
  discount_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_usd >= 0),
  estimated_freight_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (estimated_freight_usd >= 0),
  estimated_taxes_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (estimated_taxes_usd >= 0),
  total_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
  status TEXT NOT NULL DEFAULT 'Borrador' CHECK (status IN (
    'Borrador','Enviada','Confirmada','Recepción parcial','Recibida',
    'Cerrada con faltante','Cancelada'
  )),
  expected_delivery_date DATE,
  payment_terms TEXT,
  notes TEXT,
  close_reason TEXT,
  created_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  sku_snapshot TEXT,
  ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
  received_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost_input NUMERIC(14,4) NOT NULL CHECK (unit_cost_input >= 0),
  unit_cost_usd NUMERIC(14,4) NOT NULL CHECK (unit_cost_usd >= 0),
  line_total_usd NUMERIC(14,2) NOT NULL CHECK (line_total_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity)
);

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id),
  actual_freight_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (actual_freight_usd >= 0),
  notes TEXT,
  received_by UUID REFERENCES public.app_users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  landed_unit_cost_usd NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (landed_unit_cost_usd >= 0)
);

CREATE INDEX IF NOT EXISTS purchase_orders_supplier_date_idx
  ON public.purchase_orders (supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx
  ON public.purchase_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_created_by_idx
  ON public.purchase_orders (created_by);
CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx
  ON public.purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_product_idx
  ON public.purchase_order_items (product_id);
CREATE INDEX IF NOT EXISTS purchase_receipts_order_idx
  ON public.purchase_receipts (purchase_order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS purchase_receipts_received_by_idx
  ON public.purchase_receipts (received_by);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_receipt_idx
  ON public.purchase_receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_order_item_idx
  ON public.purchase_receipt_items (purchase_order_item_id);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_product_idx
  ON public.purchase_receipt_items (product_id);
