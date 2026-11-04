-- JB PARFUMS ERP · procurement and landed-cost extensions
-- Additive migration for Development validation. Do not apply to Production until reviewed.

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('USD','NIO')),
  exchange_rate numeric(14,6) NOT NULL CHECK (exchange_rate > 0),
  subtotal_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal_usd >= 0),
  discount_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_usd >= 0),
  estimated_freight_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_freight_usd >= 0),
  estimated_taxes_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_taxes_usd >= 0),
  total_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
  status text NOT NULL DEFAULT 'Borrador'
    CHECK (status IN ('Borrador','Enviada','Confirmada','Recepción parcial','Recibida','Cerrada con faltante','Cancelada')),
  expected_delivery_date date,
  payment_terms text,
  notes text,
  close_reason text,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  sku_snapshot text,
  ordered_quantity integer NOT NULL CHECK (ordered_quantity > 0),
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity),
  unit_cost_input numeric(14,4) NOT NULL CHECK (unit_cost_input >= 0),
  unit_cost_usd numeric(14,4) NOT NULL CHECK (unit_cost_usd >= 0),
  line_total_usd numeric(14,2) NOT NULL CHECK (line_total_usd >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  actual_freight_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (actual_freight_usd >= 0),
  notes text,
  received_by uuid REFERENCES app_users(id),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL REFERENCES purchase_order_items(id),
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  quantity_received integer NOT NULL CHECK (quantity_received > 0),
  landed_unit_cost_usd numeric(14,4) NOT NULL DEFAULT 0 CHECK (landed_unit_cost_usd >= 0)
);

-- Snapshot COGS at the moment of sale. Historical profit must not depend on
-- whatever the product's current cost becomes after a future replenishment.
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit_cost_usd numeric(14,4) NOT NULL DEFAULT 0
  CHECK (unit_cost_usd >= 0);

CREATE INDEX IF NOT EXISTS purchase_orders_supplier_date_idx
  ON purchase_orders(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx
  ON purchase_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx
  ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_product_idx
  ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS purchase_receipts_order_idx
  ON purchase_receipts(purchase_order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_receipt_idx
  ON purchase_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS purchase_orders_created_by_idx
  ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS purchase_receipts_received_by_idx
  ON purchase_receipts(received_by);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_order_item_idx
  ON purchase_receipt_items(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_product_idx
  ON purchase_receipt_items(product_id);

-- A purchase order is a commitment only: no inventory, cash or accounts-payable
-- row is created here. Inventory is updated from receipt items; payables are
-- recognized separately from the supplier invoice / obligation.
