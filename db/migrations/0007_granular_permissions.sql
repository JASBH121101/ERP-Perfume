-- 0007: granular hierarchical permissions and explicit ERP account authorization.
-- Additive migration: keeps the legacy role column/constraint for backwards compatibility.

CREATE TABLE IF NOT EXISTS erp_roles (
  role_key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS position_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('invited','registered','active','rejected','disabled')),
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_template_key text REFERENCES erp_roles(role_key) DEFAULT 'viewer';

INSERT INTO erp_roles(role_key,name,description,is_system) VALUES
 ('owner','Propietario','Control total protegido del ERP',true),
 ('admin','Administrador','Plantilla editable de administración',true),
 ('hr','Recursos humanos','Plantilla editable de recursos humanos',true),
 ('finance','Finanzas','Plantilla editable de finanzas',true),
 ('inventory','Inventario','Plantilla editable de inventario',true),
 ('sales','Ventas','Plantilla editable de ventas',true),
 ('viewer','Consulta','Plantilla editable de solo lectura',true)
ON CONFLICT(role_key) DO NOTHING;

UPDATE app_users
SET role_template_key = role
WHERE role_template_key IS NULL OR role_template_key = 'viewer' AND role <> 'viewer';

CREATE TABLE IF NOT EXISTS permission_catalog (
  permission_key text PRIMARY KEY,
  label text NOT NULL,
  module_key text NOT NULL,
  parent_key text REFERENCES permission_catalog(permission_key) ON DELETE CASCADE,
  permission_type text NOT NULL CHECK (permission_type IN ('module','section','action')),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS role_template_permissions (
  role_key text NOT NULL REFERENCES erp_roles(role_key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permission_catalog(permission_key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permission_catalog(permission_key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  updated_by uuid REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS permission_catalog_module_idx ON permission_catalog(module_key, sort_order);
CREATE INDEX IF NOT EXISTS user_permission_overrides_user_idx ON user_permission_overrides(user_id);

-- Module visibility is independent from every section below it.
INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order) VALUES
 ('dashboard.view','Resumen','dashboard',NULL,'module',10),
 ('orders.view','Pedidos','orders',NULL,'module',20),
 ('billing.view','Facturación','billing',NULL,'module',30),
 ('receivables.view','Cuentas por cobrar','receivables',NULL,'module',40),
 ('customers.view','Clientes','customers',NULL,'module',50),
 ('products.view','Productos','products',NULL,'module',60),
 ('inventory.view','Existencias','inventory',NULL,'module',70),
 ('purchases.view','Compras','purchases',NULL,'module',80),
 ('suppliers.view','Proveedores','suppliers',NULL,'module',90),
 ('expenses.view','Gastos','expenses',NULL,'module',100),
 ('cash.view','Caja y bancos','cash',NULL,'module',110),
 ('payables.view','Cuentas por pagar','payables',NULL,'module',120),
 ('hr.view','Recursos Humanos','hr',NULL,'module',130),
 ('dgi.view','Obligaciones DGI','dgi',NULL,'module',140),
 ('analytics.view','Informes','analytics',NULL,'module',150),
 ('settings.view','Configuración','settings',NULL,'module',160),
 ('users.view','Usuarios y accesos','users',NULL,'module',170),
 ('audit.view','Auditoría','audit',NULL,'module',180)
ON CONFLICT(permission_key) DO NOTHING;

INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order) VALUES
 ('orders.records.view','Listado de pedidos','orders','orders.view','section',10),
 ('billing.invoices.view','Facturas de venta','billing','billing.view','section',10),
 ('billing.payments.view','Cobros','billing','billing.view','section',20),
 ('customers.records.view','Directorio de clientes','customers','customers.view','section',10),
 ('products.catalog.view','Catálogo de productos','products','products.view','section',10),
 ('inventory.stock.view','Consulta de existencias','inventory','inventory.view','section',10),
 ('inventory.receipts.view','Entradas y recepciones','inventory','inventory.view','section',20),
 ('inventory.manual_out.view','Salidas manuales','inventory','inventory.view','section',30),
 ('inventory.adjustments.view','Ajustes de inventario','inventory','inventory.view','section',40),
 ('purchases.purchase_orders.view','Órdenes de compra','purchases','purchases.view','section',10),
 ('purchases.approvals.view','Aprobaciones de compra','purchases','purchases.view','section',20),
 ('purchases.receipts.view','Recepción física','purchases','purchases.view','section',30),
 ('purchases.supplier_invoices.view','Facturas de proveedor','purchases','purchases.view','section',40),
 ('suppliers.records.view','Directorio de proveedores','suppliers','suppliers.view','section',10),
 ('expenses.records.view','Registro de gastos','expenses','expenses.view','section',10),
 ('cash.entries.view','Movimientos y cuentas','cash','cash.view','section',10),
 ('payables.payments.view','Pagos a proveedores','payables','payables.view','section',10),
 ('hr.employees.view','Empleados','hr','hr.view','section',10),
 ('hr.attendance.view','Asistencia','hr','hr.view','section',20),
 ('hr.payroll.view','Nómina','hr','hr.view','section',30),
 ('hr.leave.view','Vacaciones y permisos','hr','hr.view','section',40),
 ('hr.contracts.view','Contratos','hr','hr.view','section',50),
 ('dgi.documents.view','Documentos y cumplimiento','dgi','dgi.view','section',10),
 ('analytics.reports.view','Informes y análisis','analytics','analytics.view','section',10),
 ('settings.general.view','Preferencias generales','settings','settings.view','section',10),
 ('users.accounts.view','Cuentas de usuario','users','users.view','section',10),
 ('users.roles.view','Roles y permisos','users','users.view','section',20),
 ('users.devices.view','Dispositivos','users','users.view','section',30),
 ('audit.history.view','Historial de auditoría','audit','audit.view','section',10)
ON CONFLICT(permission_key) DO NOTHING;

-- Only meaningful actions are seeded; action permissions never imply parent visibility.
INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order) VALUES
 ('orders.records.create','Crear pedido','orders','orders.records.view','action',10),
 ('orders.records.edit','Editar pedido','orders','orders.records.view','action',20),
 ('orders.records.cancel','Cancelar pedido','orders','orders.records.view','action',30),
 ('billing.invoices.create','Crear factura','billing','billing.invoices.view','action',10),
 ('billing.invoices.void','Anular factura','billing','billing.invoices.view','action',20),
 ('billing.invoices.export','Exportar factura','billing','billing.invoices.view','action',30),
 ('billing.payments.create','Registrar cobro','billing','billing.payments.view','action',10),
 ('customers.records.create','Crear cliente','customers','customers.records.view','action',10),
 ('customers.records.edit','Editar cliente','customers','customers.records.view','action',20),
 ('customers.records.delete','Eliminar cliente','customers','customers.records.view','action',30),
 ('products.catalog.create','Crear producto','products','products.catalog.view','action',10),
 ('products.catalog.edit','Editar producto','products','products.catalog.view','action',20),
 ('products.catalog.delete','Eliminar producto','products','products.catalog.view','action',30),
 ('inventory.receipts.create','Preparar entrada','inventory','inventory.receipts.view','action',10),
 ('inventory.receipts.receive','Confirmar entrada física','inventory','inventory.receipts.view','action',20),
 ('inventory.manual_out.create','Registrar salida manual','inventory','inventory.manual_out.view','action',10),
 ('inventory.adjustments.adjust','Ajustar existencias','inventory','inventory.adjustments.view','action',10),
 ('purchases.purchase_orders.create','Crear orden de compra','purchases','purchases.purchase_orders.view','action',10),
 ('purchases.purchase_orders.edit','Editar borrador de compra','purchases','purchases.purchase_orders.view','action',20),
 ('purchases.purchase_orders.submit','Enviar a aprobación','purchases','purchases.purchase_orders.view','action',30),
 ('purchases.purchase_orders.cancel','Cancelar orden','purchases','purchases.purchase_orders.view','action',40),
 ('purchases.purchase_orders.export','Exportar orden','purchases','purchases.purchase_orders.view','action',50),
 ('purchases.purchase_orders.share','Compartir orden','purchases','purchases.purchase_orders.view','action',60),
 ('purchases.approvals.approve','Aprobar orden de compra','purchases','purchases.approvals.view','action',10),
 ('purchases.approvals.reject','Rechazar orden de compra','purchases','purchases.approvals.view','action',20),
 ('purchases.approvals.return','Devolver orden para corrección','purchases','purchases.approvals.view','action',30),
 ('purchases.receipts.receive','Confirmar recepción física','purchases','purchases.receipts.view','action',10),
 ('purchases.supplier_invoices.create','Registrar factura de proveedor','purchases','purchases.supplier_invoices.view','action',10),
 ('suppliers.records.create','Crear proveedor','suppliers','suppliers.records.view','action',10),
 ('suppliers.records.edit','Editar proveedor','suppliers','suppliers.records.view','action',20),
 ('expenses.records.create','Registrar gasto','expenses','expenses.records.view','action',10),
 ('expenses.records.approve','Aprobar gasto','expenses','expenses.records.view','action',20),
 ('cash.entries.create','Registrar movimiento de caja','cash','cash.entries.view','action',10),
 ('payables.payments.create','Registrar pago a proveedor','payables','payables.payments.view','action',10),
 ('hr.employees.create','Crear empleado','hr','hr.employees.view','action',10),
 ('hr.employees.edit','Editar empleado','hr','hr.employees.view','action',20),
 ('hr.employees.delete','Dar de baja empleado','hr','hr.employees.view','action',30),
 ('hr.attendance.create','Registrar asistencia','hr','hr.attendance.view','action',10),
 ('hr.attendance.edit','Editar asistencia','hr','hr.attendance.view','action',20),
 ('hr.payroll.create','Preparar nómina','hr','hr.payroll.view','action',10),
 ('hr.payroll.edit','Editar nómina','hr','hr.payroll.view','action',20),
 ('hr.payroll.approve','Aprobar nómina','hr','hr.payroll.view','action',30),
 ('hr.leave.create','Registrar solicitud','hr','hr.leave.view','action',10),
 ('hr.leave.approve','Aprobar permiso','hr','hr.leave.view','action',20),
 ('hr.leave.reject','Rechazar permiso','hr','hr.leave.view','action',30),
 ('hr.contracts.create','Crear contrato','hr','hr.contracts.view','action',10),
 ('hr.contracts.edit','Editar contrato','hr','hr.contracts.view','action',20),
 ('settings.general.manage','Administrar configuración','settings','settings.general.view','action',10),
 ('users.accounts.create','Crear cuenta ERP','users','users.accounts.view','action',10),
 ('users.accounts.edit','Editar cuenta ERP','users','users.accounts.view','action',20),
 ('users.accounts.disable','Deshabilitar cuenta ERP','users','users.accounts.view','action',30),
 ('users.roles.create','Crear plantilla de rol','users','users.roles.view','action',10),
 ('users.roles.edit','Editar plantilla de rol','users','users.roles.view','action',20),
 ('users.devices.manage','Autorizar o bloquear dispositivos','users','users.devices.view','action',10),
 ('audit.history.export','Exportar auditoría','audit','audit.history.view','action',10),
 ('dgi.documents.manage','Administrar documentos DGI','dgi','dgi.documents.view','action',10),
 ('analytics.reports.export','Exportar informes','analytics','analytics.reports.view','action',10)
ON CONFLICT(permission_key) DO NOTHING;

-- Seed editable role templates with conservative operational defaults.
INSERT INTO role_template_permissions(role_key,permission_key,allowed)
SELECT r.role_key, p.permission_key, true
FROM erp_roles r
CROSS JOIN permission_catalog p
WHERE
  r.role_key = 'owner'
  OR (r.role_key = 'admin' AND p.module_key NOT IN ('users','audit')
      AND p.permission_key <> 'purchases.approvals.approve')
  OR (r.role_key = 'hr' AND p.module_key = 'hr')
  OR (r.role_key = 'finance' AND (
       p.module_key IN ('billing','cash','expenses','payables','analytics')
       OR p.permission_key IN ('dashboard.view','products.view','products.catalog.view','orders.view','orders.records.view',
                               'purchases.view','purchases.purchase_orders.view','purchases.supplier_invoices.view',
                               'dgi.view','dgi.documents.view','dgi.documents.manage')))
  OR (r.role_key = 'inventory' AND p.permission_key IN (
       'dashboard.view','products.view','products.catalog.view','inventory.view','inventory.stock.view',
       'inventory.receipts.view','inventory.receipts.create','inventory.receipts.receive',
       'suppliers.view','suppliers.records.view','purchases.view',
       'purchases.purchase_orders.view','purchases.purchase_orders.create','purchases.purchase_orders.edit',
       'purchases.purchase_orders.submit','purchases.receipts.view','purchases.receipts.receive'))
  OR (r.role_key = 'sales' AND p.permission_key IN (
       'dashboard.view','orders.view','orders.records.view','orders.records.create','orders.records.edit',
       'billing.view','billing.invoices.view','billing.invoices.create','billing.payments.view','billing.payments.create',
       'customers.view','customers.records.view','customers.records.create','customers.records.edit',
       'products.view','products.catalog.view','inventory.view','inventory.stock.view'))
  OR (r.role_key = 'viewer' AND p.permission_key = 'dashboard.view')
ON CONFLICT(role_key,permission_key) DO NOTHING;
