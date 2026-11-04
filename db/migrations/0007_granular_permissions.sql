-- 0007: granular, hierarchical permissions. Applied first to Neon Development.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS position_title text NOT NULL DEFAULT '';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('invited','registered','active','rejected','disabled'));

CREATE TABLE IF NOT EXISTS erp_roles (
  role_key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

INSERT INTO erp_roles(role_key,name,description,is_system) VALUES
 ('owner','Propietario','Control total protegido del ERP',true),
 ('admin','Administrador','Plantilla inicial editable',true),
 ('hr','Recursos humanos','Plantilla inicial editable',true),
 ('finance','Finanzas','Plantilla inicial editable',true),
 ('inventory','Inventario','Plantilla inicial editable',true),
 ('sales','Ventas','Plantilla inicial editable',true),
 ('viewer','Consulta','Plantilla inicial editable',true)
ON CONFLICT(role_key) DO NOTHING;

-- Every top-level module, sub-section and operation is an independent permission.
WITH modules(module_key,label,sort_order) AS (VALUES
 ('dashboard','Resumen',10),('orders','Pedidos',20),('billing','Facturación',30),
 ('receivables','Cuentas por cobrar',40),('customers','Clientes',50),('products','Productos',60),
 ('inventory','Existencias',70),('purchases','Compras',80),('suppliers','Proveedores',90),
 ('expenses','Gastos',100),('cash','Caja y bancos',110),('payables','Cuentas por pagar',120),
 ('hr','Recursos Humanos',130),('dgi','Obligaciones DGI',140),('analytics','Informes',150),
 ('settings','Configuración',160),('users','Usuarios y accesos',170),('audit','Auditoría',180)
)
INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order)
SELECT module_key||'.view',label,module_key,NULL,'module',sort_order FROM modules
ON CONFLICT(permission_key) DO NOTHING;

WITH modules(module_key,label,sort_order) AS (VALUES
 ('dashboard','Resumen',10),('orders','Pedidos',20),('billing','Facturación',30),
 ('receivables','Cuentas por cobrar',40),('customers','Clientes',50),('products','Productos',60),
 ('inventory','Existencias',70),('purchases','Compras',80),('suppliers','Proveedores',90),
 ('expenses','Gastos',100),('cash','Caja y bancos',110),('payables','Cuentas por pagar',120),
 ('hr','Recursos Humanos',130),('dgi','Obligaciones DGI',140),('analytics','Informes',150),
 ('settings','Configuración',160),('users','Usuarios y accesos',170),('audit','Auditoría',180)
), actions(action_key,label,sort_order) AS (VALUES
 ('create','Crear',10),('edit','Editar',20),('delete','Eliminar',30),('approve','Aprobar',40),
 ('reject','Rechazar',50),('submit','Enviar',60),('export','Exportar',70),('share','Compartir',80),
 ('manage','Administrar',90)
)
INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order)
SELECT m.module_key||'.'||a.action_key,a.label||' · '||m.label,m.module_key,
       m.module_key||'.view','action',a.sort_order
FROM modules m CROSS JOIN actions a
ON CONFLICT(permission_key) DO NOTHING;

WITH sections(module_key,section_key,label,sort_order) AS (VALUES
 ('hr','employees','Empleados',10),('hr','attendance','Asistencia',20),('hr','payroll','Nómina',30),
 ('hr','leave','Vacaciones y permisos',40),('hr','contracts','Contratos',50),
 ('inventory','stock','Consulta de existencias',10),('inventory','receipts','Entradas / Recepciones',20),
 ('inventory','manual_out','Salidas manuales',30),('inventory','adjustments','Ajustes',40),
 ('purchases','purchase_orders','Órdenes de compra',10),('purchases','approvals','Aprobaciones',20),
 ('purchases','receipts','Recepción física',30),('purchases','supplier_invoices','Facturas de proveedor',40),
 ('billing','invoices','Facturas de venta',10),('billing','payments','Cobros',20),
 ('settings','general','Preferencias generales',10),('users','accounts','Cuentas de usuario',10),
 ('users','roles','Roles y permisos',20),('users','devices','Dispositivos',30),('audit','history','Historial de auditoría',10)
)
INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order)
SELECT module_key||'.'||section_key||'.view',label,module_key,module_key||'.view','section',sort_order FROM sections
ON CONFLICT(permission_key) DO NOTHING;

WITH sections(module_key,section_key,label,sort_order) AS (VALUES
 ('hr','employees','Empleados',10),('hr','attendance','Asistencia',20),('hr','payroll','Nómina',30),
 ('hr','leave','Vacaciones y permisos',40),('hr','contracts','Contratos',50),
 ('inventory','stock','Consulta de existencias',10),('inventory','receipts','Entradas / Recepciones',20),
 ('inventory','manual_out','Salidas manuales',30),('inventory','adjustments','Ajustes',40),
 ('purchases','purchase_orders','Órdenes de compra',10),('purchases','approvals','Aprobaciones',20),
 ('purchases','receipts','Recepción física',30),('purchases','supplier_invoices','Facturas de proveedor',40),
 ('billing','invoices','Facturas de venta',10),('billing','payments','Cobros',20),
 ('settings','general','Preferencias generales',10),('users','accounts','Cuentas de usuario',10),
 ('users','roles','Roles y permisos',20),('users','devices','Dispositivos',30),('audit','history','Historial de auditoría',10)
), actions(action_key,label,sort_order) AS (VALUES
 ('create','Crear',10),('edit','Editar',20),('delete','Eliminar',30),('approve','Aprobar',40),
 ('reject','Rechazar',50),('submit','Enviar',60),('export','Exportar',70),('share','Compartir',80),
 ('receive','Confirmar recepción',90),('adjust','Ajustar existencias',100),('manual_out','Registrar salida manual',110),
 ('void','Anular',120),('manage','Administrar',130)
)
INSERT INTO permission_catalog(permission_key,label,module_key,parent_key,permission_type,sort_order)
SELECT s.module_key||'.'||s.section_key||'.'||a.action_key,
       a.label||' · '||s.label,s.module_key,
       s.module_key||'.'||s.section_key||'.view','action',a.sort_order
FROM sections s CROSS JOIN actions a
ON CONFLICT(permission_key) DO NOTHING;

-- Legacy templates retain their former broad module access while the owner can refine them.
INSERT INTO role_template_permissions(role_key,permission_key,allowed)
SELECT r.role_key,p.permission_key,
 CASE WHEN r.role_key='owner' THEN true
      WHEN r.role_key='admin' THEN p.module_key NOT IN ('users','audit')
      WHEN r.role_key='hr' THEN p.module_key='hr'
      WHEN r.role_key='finance' THEN p.module_key IN ('cash','expenses','payables','billing','analytics')
      WHEN r.role_key='inventory' THEN p.module_key IN ('products','inventory','purchases','suppliers')
      WHEN r.role_key='sales' THEN p.module_key IN ('orders','billing','customers','products','inventory')
      ELSE p.permission_type='module' AND p.module_key='dashboard' END
FROM erp_roles r CROSS JOIN permission_catalog p
ON CONFLICT(role_key,permission_key) DO NOTHING;

INSERT INTO app_schema_migrations(version) VALUES ('0007')
ON CONFLICT(version) DO NOTHING;
