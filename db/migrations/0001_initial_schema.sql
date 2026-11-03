-- JB PARFUMS ERP — initial schema for development.
-- Money uses fixed-precision decimals. HR salaries and payroll are stored in NIO.
-- Authentication data is owned by Neon Auth in the separate neon_auth schema.
CREATE TABLE IF NOT EXISTS app_users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL,
 display_name TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','hr','finance','inventory','sales','viewer')),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_uq ON app_users (LOWER(email));

CREATE TABLE IF NOT EXISTS employees (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_code TEXT UNIQUE,
 name TEXT NOT NULL,
 position TEXT NOT NULL,
 department TEXT,
 salary_nio NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (salary_nio >= 0),
 status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo','Inactivo','Suspendido')),
 hire_date DATE,
 phone TEXT,
 email TEXT,
 notes TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);

CREATE TABLE IF NOT EXISTS hr_attendance (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id),
 work_date DATE NOT NULL,
 check_in TIMESTAMPTZ,
 check_out TIMESTAMPTZ,
 break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
 status TEXT NOT NULL DEFAULT 'Presente' CHECK (status IN ('Presente','Ausente','Tardanza','Permiso','Vacaciones')),
 notes TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id),
 leave_type TEXT NOT NULL CHECK (leave_type IN ('Vacaciones','Permiso','Incapacidad','Otro')),
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 days NUMERIC(7,2) NOT NULL CHECK (days > 0),
 reason TEXT,
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Aprobado','Rechazado','Cancelado')),
 reviewed_by UUID REFERENCES app_users(id),
 reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS hr_payroll_periods (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 payment_date DATE,
 status TEXT NOT NULL DEFAULT 'Borrador' CHECK (status IN ('Borrador','Aprobada','Pagada','Anulada')),
 notes TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (period_end >= period_start),
 UNIQUE(period_start, period_end)
);

CREATE TABLE IF NOT EXISTS hr_payroll_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 payroll_period_id UUID NOT NULL REFERENCES hr_payroll_periods(id),
 employee_id UUID NOT NULL REFERENCES employees(id),
 base_salary_nio NUMERIC(14,2) NOT NULL CHECK (base_salary_nio >= 0),
 bonuses_nio NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (bonuses_nio >= 0),
 deductions_nio NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (deductions_nio >= 0),
 net_salary_nio NUMERIC(14,2) NOT NULL CHECK (net_salary_nio >= 0),
 notes TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(payroll_period_id, employee_id)
);

CREATE TABLE IF NOT EXISTS customers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL,
 contact TEXT,
 phone TEXT,
 email TEXT,
 notes TEXT,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL,
 contact TEXT,
 phone TEXT,
 email TEXT,
 currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','NIO')),
 notes TEXT,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 sku TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 brand TEXT,
 category TEXT,
 concentration TEXT,
 gender TEXT,
 family TEXT,
 size_ml NUMERIC(8,2) CHECK (size_ml IS NULL OR size_ml > 0),
 presentation TEXT,
 purchase_cost_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (purchase_cost_usd >= 0),
 additional_cost_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (additional_cost_usd >= 0),
 unit_cost_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost_usd >= 0),
 price_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
 min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
 location TEXT,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id UUID NOT NULL REFERENCES products(id),
 movement_type TEXT NOT NULL CHECK (movement_type IN ('Entrada','Salida','Ajuste','Devolucion','Reversion')),
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
 previous_stock INTEGER NOT NULL CHECK (previous_stock >= 0),
 new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
 note TEXT,
 reference_type TEXT,
 reference_id TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_number TEXT NOT NULL UNIQUE,
 customer_id UUID REFERENCES customers(id),
 customer_name TEXT NOT NULL,
 phone TEXT,
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','En preparación','Listo para entrega','En tránsito','Completado','Cancelado')),
 payment_status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (payment_status IN ('Pendiente','Abono parcial','Pagado','Reembolsado')),
 payment_method TEXT,
 delivery_mode TEXT,
 currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','NIO')),
 original_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (original_amount >= 0),
 exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
 total_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
 discount_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_usd >= 0),
 delivery_fee_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_usd >= 0),
 notes TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id),
 product_name TEXT NOT NULL,
 sku_snapshot TEXT,
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 unit_price_usd NUMERIC(14,2) NOT NULL CHECK (unit_price_usd >= 0),
 line_total_usd NUMERIC(14,2) NOT NULL CHECK (line_total_usd >= 0)
);

CREATE TABLE IF NOT EXISTS purchases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 purchase_number TEXT NOT NULL UNIQUE,
 supplier_id UUID REFERENCES suppliers(id),
 supplier_name TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','NIO')),
 exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
 total_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
 paid_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_usd >= 0),
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Abono parcial','Pagado','Anulada')),
 notes TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (paid_usd <= total_usd)
);

CREATE TABLE IF NOT EXISTS purchase_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id),
 product_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 unit_cost_usd NUMERIC(14,2) NOT NULL CHECK (unit_cost_usd >= 0),
 line_total_usd NUMERIC(14,2) NOT NULL CHECK (line_total_usd >= 0)
);

CREATE TABLE IF NOT EXISTS invoices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_number TEXT NOT NULL UNIQUE,
 source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('store','web','manual')),
 order_id UUID REFERENCES orders(id),
 order_number_snapshot TEXT,
 customer_id UUID REFERENCES customers(id),
 customer_name TEXT NOT NULL,
 customer_phone TEXT,
 currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','NIO')),
 exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
 subtotal_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal_usd >= 0),
 discount_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_usd >= 0),
 delivery_fee_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_usd >= 0),
 total_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_usd >= 0),
 paid_usd NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_usd >= 0),
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Abono parcial','Pagada','Anulada')),
 payment_method TEXT,
 notes TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (paid_usd <= total_usd)
);

CREATE TABLE IF NOT EXISTS invoice_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
 product_id UUID REFERENCES products(id),
 product_name TEXT NOT NULL,
 sku_snapshot TEXT,
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 unit_price_usd NUMERIC(14,2) NOT NULL CHECK (unit_price_usd >= 0),
 line_total_usd NUMERIC(14,2) NOT NULL CHECK (line_total_usd >= 0)
);

CREATE TABLE IF NOT EXISTS invoice_payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id UUID NOT NULL REFERENCES invoices(id),
 currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
 original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
 exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
 amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
 account_name TEXT,
 payment_method TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 category TEXT NOT NULL,
 description TEXT NOT NULL,
 currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
 original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
 exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
 amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL UNIQUE,
 currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
 account_type TEXT NOT NULL DEFAULT 'Caja' CHECK (account_type IN ('Caja','Banco','Otro')),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 direction TEXT NOT NULL CHECK (direction IN ('income','expense')),
 concept TEXT NOT NULL,
 account_id UUID REFERENCES cash_accounts(id),
 currency TEXT NOT NULL CHECK (currency IN ('USD','NIO')),
 original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0),
 exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
 amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
 source_type TEXT,
 source_id TEXT,
 created_by UUID REFERENCES app_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
 setting_key TEXT PRIMARY KEY,
 setting_value JSONB NOT NULL,
 updated_by UUID REFERENCES app_users(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id UUID REFERENCES app_users(id),
 action TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id TEXT,
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_status_date_idx ON orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);

CREATE INDEX IF NOT EXISTS invoices_customer_date_idx ON invoices(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS purchases_supplier_date_idx ON purchases(supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_product_created_idx ON inventory_movements(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON invoice_payments(invoice_id, created_at);

CREATE INDEX IF NOT EXISTS expenses_created_idx ON expenses(created_at DESC);

CREATE INDEX IF NOT EXISTS cash_entries_created_idx ON cash_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log(actor_user_id, created_at DESC);

INSERT INTO app_settings(setting_key, setting_value) VALUES
 ('base_currency', '{"value":"USD"}'::jsonb),
 ('payroll_currency', '{"value":"NIO"}'::jsonb),
 ('default_exchange_rate', '{"value":36.60}'::jsonb)
 ON CONFLICT (setting_key) DO NOTHING;
