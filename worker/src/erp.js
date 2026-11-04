import { loadUserPermissions, hasPermission, hasAnyModuleAccess } from "./permissions.js";

const RESOURCE_DEFS = {
  products: { table: "products", roles: ["owner", "admin", "inventory"], fields: ["sku","name","brand","category","concentration","gender","family","size_ml","presentation","purchase_cost_usd","additional_cost_usd","unit_cost_usd","price_usd","min_stock","location","active","barcode","description","supplier_name","wholesale_price_usd","tone","notes","images"], order: "name ASC" },
  customers: { table: "customers", roles: ["owner", "admin", "sales"], fields: ["name","contact","phone","email","notes","active","customer_type"], order: "name ASC" },
  suppliers: { table: "suppliers", roles: ["owner", "admin", "inventory"], fields: ["name","contact","phone","email","currency","notes","active"], order: "name ASC" },
  orders: { table: "orders", roles: ["owner", "admin", "sales"], fields: ["order_number","customer_id","customer_name","phone","status","payment_status","payment_method","delivery_mode","currency","original_amount","exchange_rate","total_usd","discount_usd","delivery_fee_usd","notes"], order: "created_at DESC" },
  purchases: { table: "purchases", roles: ["owner", "admin", "inventory"], fields: ["purchase_number","supplier_id","supplier_name","currency","exchange_rate","total_usd","paid_usd","status","notes"], order: "created_at DESC" },
  invoices: { table: "invoices", roles: ["owner", "admin", "sales", "finance"], fields: ["invoice_number","source","order_id","order_number_snapshot","customer_id","customer_name","customer_phone","currency","exchange_rate","subtotal_usd","discount_usd","delivery_fee_usd","total_usd","paid_usd","status","payment_method","notes"], order: "created_at DESC" },
  expenses: { table: "expenses", roles: ["owner", "admin", "finance"], fields: ["category","description","currency","original_amount","exchange_rate","amount_usd"], order: "created_at DESC" },
  cash_entries: { table: "cash_entries", roles: ["owner", "admin", "finance"], fields: ["direction","concept","account_id","currency","original_amount","exchange_rate","amount_usd","source_type","source_id"], order: "created_at DESC" },
  cash_accounts: { table: "cash_accounts", roles: ["owner", "admin", "finance"], fields: ["name","currency","account_type","active"], order: "name ASC" },
  employees: { table: "employees", roles: ["owner", "admin", "hr"], fields: ["employee_code","name","position","department","salary_nio","status","hire_date","phone","email","notes"], order: "name ASC" },
  hr_attendance: { table: "hr_attendance", roles: ["owner", "admin", "hr"], fields: ["employee_id","work_date","check_in","check_out","break_minutes","status","notes"], order: "work_date DESC" },
  hr_leave_requests: { table: "hr_leave_requests", roles: ["owner", "admin", "hr"], fields: ["employee_id","leave_type","start_date","end_date","days","reason","status"], order: "created_at DESC" },
  hr_payroll_periods: { table: "hr_payroll_periods", roles: ["owner", "admin", "hr", "finance"], fields: ["period_start","period_end","payment_date","status","notes"], order: "period_start DESC" },
  hr_payroll_items: { table: "hr_payroll_items", roles: ["owner", "admin", "hr", "finance"], fields: ["payroll_period_id","employee_id","base_salary_nio","bonuses_nio","deductions_nio","net_salary_nio","notes"], order: "created_at DESC" },
  dgi_support_documents: { table: "dgi_support_documents", roles: ["owner", "admin", "finance"], fields: ["document_date","document_type","issuer","reference_number","description","fiscal_period","currency","original_amount","amount_nio","formal_invoice","file_key","file_name","file_type","file_size","notes"], order: "document_date DESC, created_at DESC" },
  inventory_movements: { table: "inventory_movements", roles: ["owner", "admin", "inventory"], fields: ["product_id","movement_type","quantity","quantity_delta","previous_stock","new_stock","note","reference_type","reference_id"], order: "created_at DESC" }
};

function erpJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

function erpError(status, code, message) {
  return erpJson({ error: { code, message } }, status);
}

function canAccess(user, roles) {
  // Every request is checked against the granular policy before reaching a handler.
  return Boolean(user && (user._permissionValidated === true || roles.includes(user.role)));
}

async function auditQuery(sql, actorId, action, entity, entityId, details = {}) {
  await sql.query(
    "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [actorId, action, entity, entityId == null ? null : String(entityId), JSON.stringify(details)]
  );
}

async function readBootstrap(sql, user, permissionContext) {
  const [products, movements, customers, suppliers, orders, orderItems, purchases, purchaseItems, invoices, invoiceItems, invoicePayments, expenses, cashAccounts, cashEntries, employees, attendance, leaveRequests, payrollPeriods, payrollItems, settings] =
    await sql.transaction((tx) => [
      tx`SELECT * FROM products ORDER BY name ASC LIMIT 2000`,
      tx`SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT 5000`,
      tx`SELECT * FROM customers ORDER BY name ASC LIMIT 2000`,
      tx`SELECT * FROM suppliers ORDER BY name ASC LIMIT 1000`,
      tx`SELECT * FROM orders ORDER BY created_at DESC LIMIT 2000`,
      tx`SELECT * FROM order_items ORDER BY id ASC LIMIT 10000`,
      tx`SELECT * FROM purchases ORDER BY created_at DESC LIMIT 2000`,
      tx`SELECT * FROM purchase_items ORDER BY id ASC LIMIT 10000`,
      tx`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 2000`,
      tx`SELECT * FROM invoice_items ORDER BY id ASC LIMIT 10000`,
      tx`SELECT * FROM invoice_payments ORDER BY created_at DESC LIMIT 10000`,
      tx`SELECT * FROM expenses ORDER BY created_at DESC LIMIT 5000`,
      tx`SELECT * FROM cash_accounts WHERE active = TRUE ORDER BY name ASC`,
      tx`SELECT * FROM cash_entries ORDER BY created_at DESC LIMIT 10000`,
      tx`SELECT * FROM employees ORDER BY name ASC LIMIT 1000`,
      tx`SELECT * FROM hr_attendance ORDER BY work_date DESC LIMIT 5000`,
      tx`SELECT * FROM hr_leave_requests ORDER BY created_at DESC LIMIT 2000`,
      tx`SELECT * FROM hr_payroll_periods ORDER BY period_start DESC LIMIT 500`,
      tx`SELECT * FROM hr_payroll_items ORDER BY created_at DESC LIMIT 5000`,
      tx`SELECT setting_key, setting_value FROM app_settings ORDER BY setting_key ASC`
    ]);

  const result = {};
  if (hasPermission(permissionContext, "settings.general.view")) {
    result.settings = settings.filter((setting) =>
      setting.setting_key !== "dgi_compliance" || hasPermission(permissionContext, "dgi.documents.view")
    );
  }
  if (hasPermission(permissionContext, "products.catalog.view")) result.products = products;
  const canViewInbound = hasPermission(permissionContext, "inventory.receipts.view") ||
    hasPermission(permissionContext, "purchases.receipts.view");
  const canViewOutbound = hasPermission(permissionContext, "inventory.manual_out.view");
  const canViewAdjustments = hasPermission(permissionContext, "inventory.adjustments.view");
  if (canViewInbound || canViewOutbound || canViewAdjustments) {
    result.inventory_movements = movements.filter((movement) => {
      const delta = Number(movement.quantity_delta ?? movement.quantity ?? 0);
      if (delta < 0) return canViewOutbound;
      if (delta > 0) return canViewInbound;
      return canViewAdjustments;
    });
  }
  if (hasPermission(permissionContext, "suppliers.records.view")) result.suppliers = suppliers;
  if (hasPermission(permissionContext, "purchases.receipts.view")) {
    result.purchases = purchases;
    result.purchase_items = purchaseItems;
  }
  if (hasPermission(permissionContext, "customers.records.view")) result.customers = customers;
  if (hasPermission(permissionContext, "orders.records.view")) {
    result.orders = orders;
    result.order_items = orderItems;
  }
  if (hasPermission(permissionContext, "billing.invoices.view")) {
    result.invoices = invoices;
    result.invoice_items = invoiceItems;
  }
  if (hasPermission(permissionContext, "billing.payments.view")) result.invoice_payments = invoicePayments;
  if (hasPermission(permissionContext, "expenses.records.view")) result.expenses = expenses;
  if (hasPermission(permissionContext, "cash.entries.view")) {
    result.cash_accounts = cashAccounts;
    result.cash_entries = cashEntries;
  }
  if (hasPermission(permissionContext, "hr.employees.view")) result.employees = employees;
  if (hasPermission(permissionContext, "hr.attendance.view")) result.hr_attendance = attendance;
  if (hasPermission(permissionContext, "hr.leave.view")) result.hr_leave_requests = leaveRequests;
  if (hasPermission(permissionContext, "hr.payroll.view")) {
    result.hr_payroll_periods = payrollPeriods;
    result.hr_payroll_items = payrollItems;
  }
  return result;
}

function safeFields(def, body) {
  const keys = Object.keys(body || {}).filter((key) => def.fields.includes(key));
  const values = keys.map((key) => body[key]);
  return { keys, values };
}

async function createGeneric(sql, user, resource, def, body) {
  const { keys, values } = safeFields(def, body);
  if (!keys.length) return erpError(400, "NO_VALID_FIELDS", "Incluye al menos un campo válido.");
  if (keys.includes("created_by")) return erpError(400, "INVALID_FIELD", "created_by se asigna automáticamente.");
  if (def.fields.includes("created_by")) {
    keys.push("created_by");
    values.push(user.id);
  }
  if (["employees","hr_attendance","hr_leave_requests","hr_payroll_periods","dgi_support_documents","inventory_movements","orders","purchases","invoices","expenses","cash_entries"].includes(def.table)) {
    keys.push("created_by");
    values.push(user.id);
  }
  const cols = keys.map((key) => '"' + key + '"').join(", ");
  const placeholders = keys.map((_, index) => "$" + (index + 1)).join(", ");
  const actorIndex = values.length + 1;
  const query = `WITH changed AS (INSERT INTO "${def.table}" (${cols}) VALUES (${placeholders}) RETURNING *), logged AS (INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) SELECT $${actorIndex}, 'create', $${actorIndex + 1}, id::text, to_jsonb(changed) FROM changed) SELECT * FROM changed`;
  try {
    const rows = await sql.query(query, [...values, user.id, resource]);
    if (!rows[0]) return erpError(400, "CREATE_FAILED", "No se pudo crear el registro.");
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_RECORD", "Ya existe un registro con ese código o número.");
    if (error?.code === "23503") return erpError(400, "RELATED_RECORD_NOT_FOUND", "El registro relacionado no existe.");
    if (error?.code === "23514" || error?.code === "22P02") return erpError(400, "INVALID_RECORD", "Uno o más valores no cumplen las reglas del sistema.");
    console.error("[erp] Create failed:", resource, error?.message || "database error");
    return erpError(503, "SAVE_FAILED", "No se pudo guardar el registro en Neon.");
  }
}

async function updateGeneric(sql, user, resource, def, id, body) {
  const { keys, values } = safeFields(def, body);
  if (!keys.length) return erpError(400, "NO_VALID_FIELDS", "Incluye al menos un campo válido.");
  if (keys.includes("created_by") || keys.includes("created_at")) return erpError(400, "INVALID_FIELD", "No se permite modificar la autoría ni la fecha de creación.");
  if (def.table === "products" && ["purchase_cost_usd","additional_cost_usd","unit_cost_usd"].some((key)=>keys.includes(key))) {
    const current = await sql.query("SELECT purchase_cost_usd,additional_cost_usd FROM products WHERE id=$1::uuid LIMIT 1",[id]);
    if (!current[0]) return erpError(404,"RECORD_NOT_FOUND","No se encontró el producto solicitado.");
    const purchaseIndex=keys.indexOf("purchase_cost_usd");
    const additionalIndex=keys.indexOf("additional_cost_usd");
    const purchaseCost=purchaseIndex>=0?Number(values[purchaseIndex]):Number(current[0].purchase_cost_usd||0);
    const additionalCost=additionalIndex>=0?Number(values[additionalIndex]):Number(current[0].additional_cost_usd||0);
    if(!Number.isFinite(purchaseCost)||purchaseCost<0||!Number.isFinite(additionalCost)||additionalCost<0) {
      return erpError(400,"INVALID_PRODUCT_COST","El costo de compra y los costos adicionales deben ser valores no negativos.");
    }
    const unitCostIndex=keys.indexOf("unit_cost_usd");
    const derivedUnitCost=Math.round((purchaseCost+additionalCost)*100)/100;
    if(unitCostIndex>=0) values[unitCostIndex]=derivedUnitCost;
    else { keys.push("unit_cost_usd"); values.push(derivedUnitCost); }
  }
  if (["products","customers","suppliers","employees","orders","purchases","invoices","hr_payroll_periods"].includes(def.table)) {
    keys.push("updated_at");
    values.push(new Date().toISOString());
  }
  const assignments = keys.map((key, index) => '"' + key + '" = $' + (index + 1)).join(", ");
  const idIndex = values.length + 1;
  const actorIndex = values.length + 2;
  const entityIndex = values.length + 3;
  const query = `WITH changed AS (UPDATE "${def.table}" SET ${assignments} WHERE id = $${idIndex} RETURNING *), logged AS (INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) SELECT $${actorIndex}, 'update', $${entityIndex}, id::text, to_jsonb(changed) FROM changed) SELECT * FROM changed`;
  try {
    const rows = await sql.query(query, [...values, id, user.id, resource]);
    if (!rows[0]) return erpError(404, "RECORD_NOT_FOUND", "No se encontró el registro solicitado.");
    return erpJson({ record: rows[0] });
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_RECORD", "Ya existe un registro con ese código o número.");
    if (error?.code === "23503") return erpError(400, "RELATED_RECORD_NOT_FOUND", "El registro relacionado no existe.");
    if (error?.code === "23514" || error?.code === "22P02") return erpError(400, "INVALID_RECORD", "Uno o más valores no cumplen las reglas del sistema.");
    console.error("[erp] Update failed:", resource, error?.message || "database error");
    return erpError(503, "UPDATE_FAILED", "No se pudo actualizar el registro en Neon.");
  }
}

async function softDelete(sql, user, resource, def, id) {
  if (!["products", "customers", "suppliers", "employees"].includes(resource)) {
    return erpError(405, "DELETE_NOT_ALLOWED", "Este registro se conserva por trazabilidad; utiliza su flujo de anulación.");
  }
  const inactiveValue = resource === "employees" ? "Inactivo" : false;
  const column = resource === "employees" ? "status" : "active";
  const rows = await sql.query(
    `WITH changed AS (UPDATE "${def.table}" SET "${column}" = $1, updated_at = NOW() WHERE id = $2 RETURNING *), logged AS (INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) SELECT $3, 'deactivate', $4, id::text, to_jsonb(changed) FROM changed) SELECT * FROM changed`,
    [inactiveValue, id, user.id, resource]
  );
  if (!rows[0]) return erpError(404, "RECORD_NOT_FOUND", "No se encontró el registro solicitado.");
  return erpJson({ record: rows[0] });
}

async function createOrder(sql, user, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const customerId = String(body.customer_id || "").trim();
  const newCustomer = body.new_customer && typeof body.new_customer === "object" ? body.new_customer : null;
  const newCustomerName = String(newCustomer?.name || "").trim();
  const customerName = customerId ? String(body.customer_name || "").trim() : newCustomerName;
  if ((customerId && !/^[0-9a-f-]{36}$/i.test(customerId)) ||
      (customerId && newCustomerName) || (!customerId && !newCustomerName) ||
      !customerName || customerName.length > 160 || !items.length) {
    return erpError(400, "INVALID_ORDER", "El pedido requiere seleccionar un cliente existente o registrar uno nuevo, además de al menos un producto.");
  }
  if (newCustomer && (!newCustomerName || newCustomerName.length > 160 ||
      String(newCustomer.phone || "").length > 40 ||
      String(newCustomer.email || "").length > 120)) {
    return erpError(400, "INVALID_NEW_CUSTOMER", "Revisa el nombre, teléfono y correo del nuevo cliente.");
  }
  if (items.some((item) => !item.product_id || !/^[0-9a-f-]{36}$/i.test(String(item.product_id)) || !item.product_name || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !Number.isFinite(Number(item.unit_price_usd)) || Number(item.unit_price_usd) < 0)) {
    return erpError(400, "INVALID_ORDER_ITEMS", "Cada renglón requiere un producto activo, cantidad y precio válidos.");
  }
  const currency = body.currency === "NIO" ? "NIO" : "USD";
  const rate = Number(body.exchange_rate || 1);
  const totalUsd = Number(body.total_usd);
  const discountUsd = Number(body.discount_usd || 0);
  const deliveryFeeUsd = Number(body.delivery_fee_usd || 0);
  const originalAmount = Number(body.original_amount);
  const subtotalUsd = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price_usd), 0);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(totalUsd) || totalUsd <= 0 ||
      !Number.isFinite(discountUsd) || discountUsd < 0 || discountUsd > subtotalUsd ||
      !Number.isFinite(deliveryFeeUsd) || deliveryFeeUsd < 0 ||
      Math.abs(subtotalUsd - discountUsd + deliveryFeeUsd - totalUsd) > 0.02 ||
      !Number.isFinite(originalAmount) || originalAmount <= 0 ||
      Math.abs((currency === "NIO" ? originalAmount / rate : originalAmount) - totalUsd) > 0.02) {
    return erpError(400, "ORDER_TOTAL_MISMATCH", "El total debe coincidir con productos, descuento, entrega y moneda de cobro.");
  }
  const productIds = [...new Set(items.map((item) => String(item.product_id)))];
  const activeProducts = await sql.query("SELECT id FROM products WHERE id=ANY($1::uuid[]) AND active=TRUE", [productIds]);
  if (activeProducts.length !== productIds.length) return erpError(409, "ORDER_PRODUCT_UNAVAILABLE", "Uno o más perfumes ya no están activos o no existen.");
  const orderNumber = String(body.order_number || "").trim();
  if (!orderNumber) return erpError(400, "ORDER_NUMBER_REQUIRED", "El número de pedido es obligatorio.");
  const payload = {
    order_number: orderNumber, customer_id: customerId || null, customer_name: customerName,
    phone: customerId ? (body.phone || null) : (newCustomer?.phone || null),
    status: "Pendiente", payment_status: "Pendiente",
    payment_method: body.payment_method || null, delivery_mode: body.delivery_mode || null,
    currency, original_amount: originalAmount, exchange_rate: rate, total_usd: totalUsd,
    discount_usd: discountUsd, delivery_fee_usd: deliveryFeeUsd, notes: body.notes || null
  };
  try {
    const rows = await sql.query(
      "WITH new_customer AS (INSERT INTO customers(name,contact,phone,email,customer_type,active) SELECT $18,$19,$20,$21,$22,TRUE WHERE $2::uuid IS NULL RETURNING *), resolved_customer AS (SELECT id,name,phone FROM customers WHERE id=$2::uuid UNION ALL SELECT id,name,phone FROM new_customer), created AS (INSERT INTO orders (order_number,customer_id,customer_name,phone,status,payment_status,payment_method,delivery_mode,currency,original_amount,exchange_rate,total_usd,discount_usd,delivery_fee_usd,notes,created_by) SELECT $1,resolved_customer.id,resolved_customer.name,COALESCE(NULLIF($4,''),resolved_customer.phone),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16 FROM resolved_customer RETURNING *), item_rows AS (INSERT INTO order_items (order_id,product_id,product_name,sku_snapshot,quantity,unit_price_usd,line_total_usd) SELECT created.id, i.product_id, i.product_name, i.sku_snapshot, i.quantity, i.unit_price_usd, i.quantity * i.unit_price_usd FROM created CROSS JOIN LATERAL jsonb_to_recordset($17::jsonb) AS i(product_id uuid, product_name text, sku_snapshot text, quantity integer, unit_price_usd numeric) RETURNING id), customer_logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $16,'create','customer',id::text,jsonb_build_object('entered_name',$3,'record',to_jsonb(new_customer)) FROM new_customer), logged AS (INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) SELECT $16,'create','order',created.id::text,to_jsonb(created) FROM created) SELECT * FROM created",
      [payload.order_number,payload.customer_id,payload.customer_name,payload.phone,payload.status,payload.payment_status,payload.payment_method,payload.delivery_mode,payload.currency,payload.original_amount,payload.exchange_rate,payload.total_usd,payload.discount_usd,payload.delivery_fee_usd,payload.notes,user.id,JSON.stringify(items),
       newCustomerName || null,newCustomer?.contact || null,newCustomer?.phone || null,newCustomer?.email || null,newCustomer?.customer_type || "particular"]
    );
    if (!rows[0]) return erpError(404, "CUSTOMER_NOT_FOUND", "No se encontró el cliente seleccionado. Actualiza la cartera e inténtalo de nuevo.");
    return erpJson({ record: rows[0], customer_created: !customerId }, 201);
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_ORDER", "El número de pedido o la identificación del cliente ya existe.");
    if (error?.code === "23503") return erpError(400, "RELATED_RECORD_NOT_FOUND", "El cliente o uno de los productos relacionados no existe.");
    console.error("[erp] Order creation failed:", error?.message || "database error");
    return erpError(503, "ORDER_SAVE_FAILED", "No se pudo guardar el pedido y su cliente en Neon.");
  }
}

async function createProduct(sql, user, body) {
  const name = String(body.name || "").trim();
  const sku = String(body.sku || "").trim();
  const stock = Number(body.stock || 0);
  if (!name || !sku || !Number.isInteger(stock) || stock < 0) return erpError(400, "INVALID_PRODUCT", "Nombre, SKU y existencias iniciales son obligatorios y deben ser válidos.");
  const allowed = RESOURCE_DEFS.products.fields;
  const values = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body,key)) values[key] = body[key];
  delete values.stock;
  const purchaseCost = Number(values.purchase_cost_usd || 0);
  const additionalCost = Number(values.additional_cost_usd || 0);
  if (!Number.isFinite(purchaseCost) || purchaseCost < 0 || !Number.isFinite(additionalCost) || additionalCost < 0) {
    return erpError(400, "INVALID_PRODUCT_COST", "El costo de compra y los costos adicionales deben ser valores no negativos.");
  }
  values.unit_cost_usd = Math.round((purchaseCost + additionalCost) * 100) / 100;
  const result = await sql.query(
    "WITH created AS (INSERT INTO products (sku,name,brand,category,concentration,gender,family,size_ml,presentation,purchase_cost_usd,additional_cost_usd,unit_cost_usd,price_usd,stock,min_stock,location,active,barcode,description,supplier_name,wholesale_price_usd,tone,notes,images) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb) RETURNING *), movement AS (INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,created_by) SELECT id,'Entrada',$14,$14,0,$14,'Existencias iniciales','product',$25 FROM created WHERE $14>0 RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $25,'create','product',id::text,to_jsonb(created) FROM created) SELECT * FROM created",
    [sku,name,values.brand||null,values.category||null,values.concentration||null,values.gender||null,values.family||null,values.size_ml||null,values.presentation||null,values.purchase_cost_usd||0,values.additional_cost_usd||0,values.unit_cost_usd||0,values.price_usd||0,stock,values.min_stock||0,values.location||null,values.active!==false,values.barcode||null,values.description||null,values.supplier_name||null,values.wholesale_price_usd||null,values.tone||null,values.notes||null,JSON.stringify(values.images||[]),user.id]
  );
  return erpJson({record:result[0]},201);
}


export async function importProducts(sql, user, body) {
  const incoming = Array.isArray(body.records) ? body.records : [];
  if (!incoming.length || incoming.length > 200) {
    return erpError(400, "INVALID_IMPORT_SIZE", "Selecciona entre 1 y 200 productos por importación.");
  }
  const seen = new Set();
  const clean = [];
  const textFields = [
    ["brand", 100], ["category", 80], ["concentration", 80], ["gender", 40],
    ["family", 100], ["presentation", 100], ["location", 120], ["barcode", 80],
    ["description", 1000], ["supplier_name", 120], ["tone", 40], ["notes", 1000]
  ];
  for (const source of incoming) {
    const sku = String(source?.sku || "").trim().toUpperCase();
    const name = String(source?.name || "").trim();
    const stock = Number(source?.stock ?? 0);
    const minStock = Number(source?.min_stock ?? 3);
    if (!sku || sku.length > 80 || !name || name.length > 180 || !Number.isInteger(stock) || stock < 0 || stock > 100000000 || !Number.isInteger(minStock) || minStock < 0 || minStock > 100000000) {
      return erpError(400, "INVALID_IMPORT_ROW", "Cada producto necesita SKU, nombre y existencias enteras no negativas.");
    }
    const normalizedSku = sku.toLowerCase();
    if (seen.has(normalizedSku)) return erpError(409, "DUPLICATE_IMPORT_SKU", "El archivo contiene SKU repetidos: " + sku + ".");
    seen.add(normalizedSku);
    const record = { sku, name, stock, min_stock: minStock, active: source.active !== false, images: [] };
    for (const [field, maxLength] of textFields) {
      const value = source[field] == null ? "" : String(source[field]).trim();
      if (value.length > maxLength) return erpError(400, "IMPORT_FIELD_TOO_LONG", "El campo " + field + " supera el máximo permitido.");
      record[field] = value || null;
    }
    for (const field of ["purchase_cost_usd","additional_cost_usd","unit_cost_usd","price_usd","wholesale_price_usd","size_ml"]) {
      const raw = source[field];
      if (raw == null || raw === "") { record[field] = null; continue; }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 999999999 || (field === "size_ml" && value === 0)) {
        return erpError(400, "INVALID_IMPORT_AMOUNT", "Revisa los costos, precios y tamaños del archivo.");
      }
      record[field] = value;
    }
    const hasPurchaseCost = source.purchase_cost_usd != null && source.purchase_cost_usd !== "";
    const hasAdditionalCost = source.additional_cost_usd != null && source.additional_cost_usd !== "";
    record.purchase_cost_usd = record.purchase_cost_usd ?? 0;
    record.additional_cost_usd = record.additional_cost_usd ?? 0;
    record.unit_cost_usd = hasPurchaseCost || hasAdditionalCost
      ? Math.round((record.purchase_cost_usd + record.additional_cost_usd) * 100) / 100
      : (record.unit_cost_usd ?? 0);
    record.price_usd = record.price_usd ?? 0;
    record.wholesale_price_usd = record.wholesale_price_usd;
    record.size_ml = record.size_ml;
    clean.push(record);
  }
  const skus = clean.map(record => record.sku.toLowerCase());
  const existing = await sql.query("SELECT sku FROM products WHERE LOWER(sku)=ANY($1::text[])", [skus]);
  if (existing.length) {
    const conflicts = existing.slice(0, 8).map(row => row.sku).join(", ");
    return erpError(409, "SKU_ALREADY_EXISTS", "Ya existen SKU en el catálogo: " + conflicts + ". Corrígelos en la vista previa.");
  }
  const sourceFile = String(body.source_file || "").slice(0, 160);
  try {
    const rows = await sql.query(
      "WITH input AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(" +
      "sku text,name text,brand text,category text,concentration text,gender text,family text,size_ml numeric,presentation text," +
      "purchase_cost_usd numeric,additional_cost_usd numeric,unit_cost_usd numeric,price_usd numeric,stock integer,min_stock integer," +
      "location text,active boolean,barcode text,description text,supplier_name text,wholesale_price_usd numeric,tone text,notes text,images jsonb" +
      ")), created AS (" +
      "INSERT INTO products(sku,name,brand,category,concentration,gender,family,size_ml,presentation,purchase_cost_usd,additional_cost_usd," +
      "unit_cost_usd,price_usd,stock,min_stock,location,active,barcode,description,supplier_name,wholesale_price_usd,tone,notes,images) " +
      "SELECT sku,name,brand,category,concentration,gender,family,size_ml,presentation,purchase_cost_usd,additional_cost_usd," +
      "COALESCE(NULLIF(unit_cost_usd,0),purchase_cost_usd+additional_cost_usd,0),price_usd,stock,min_stock,location,active,barcode,description,supplier_name," +
      "wholesale_price_usd,tone,notes,COALESCE(images,'[]'::jsonb) FROM input RETURNING id,sku,name,stock" +
      "), movement AS (" +
      "INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) " +
      "SELECT id,'Entrada',stock,stock,0,stock,'Importación de catálogo','product_import',NULL,$2 FROM created WHERE stock>0 RETURNING id" +
      "), logged AS (" +
      "INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $2,'import','product',id::text,jsonb_build_object('sku',sku,'name',name,'stock',stock,'source_file',$3) FROM created RETURNING id" +
      ") SELECT id,sku,name,stock FROM created ORDER BY name",
      [JSON.stringify(clean), user.id, sourceFile]
    );
    return erpJson({ imported: rows.length, records: rows }, 201);
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_IMPORT_SKU", "Uno o más SKU ya existen en el catálogo.");
    if (error?.code === "23514" || error?.code === "22P02") return erpError(400, "INVALID_IMPORT_ROW", "Uno o más datos no cumplen las reglas del catálogo.");
    console.error("[erp] Product import failed:", error?.message || "database error");
    return erpError(503, "PRODUCT_IMPORT_FAILED", "No se pudo guardar la importación en Neon.");
  }
}

async function createInventoryMovement(sql, user, body) {
  const type = String(body.movement_type || "");
  const quantity = Number(body.quantity);
  const note = body.note == null ? "" : String(body.note).trim();
  if (!body.product_id || !["Entrada","Salida","Ajuste"].includes(type) ||
      !Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647 ||
      (type !== "Ajuste" && quantity < 1) || note.length > 120) {
    return erpError(400, "INVALID_MOVEMENT", "Los movimientos manuales solo permiten Entrada, Salida o Ajuste; revisa producto, cantidad y nota.");
  }
  try {
    const rows = await sql.query(
      "WITH target AS (SELECT id,stock FROM products WHERE id=$1::uuid AND active=TRUE FOR UPDATE), calc AS (SELECT id,stock AS previous_stock, CASE WHEN $2='Salida' THEN -$3 WHEN $2='Ajuste' THEN $3-stock ELSE $3 END AS delta FROM target), updated AS (UPDATE products p SET stock=c.previous_stock+c.delta, updated_at=NOW() FROM calc c WHERE p.id=c.id AND c.previous_stock+c.delta>=0 AND c.delta<>0 RETURNING p.id,p.name,p.sku,c.previous_stock,c.delta,p.stock AS new_stock), movement AS (INSERT INTO inventory_movements (product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) SELECT id,$2,ABS(delta),delta,previous_stock,new_stock,$4,'manual',NULL,$5 FROM updated RETURNING *), logged AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) SELECT $5,'inventory_movement','product',updated.id::text,jsonb_build_object('movement',movement.movement_type,'delta',movement.quantity_delta,'new_stock',movement.new_stock) FROM movement JOIN updated ON updated.id=movement.product_id) SELECT movement.*, updated.name AS product_name, updated.sku FROM movement JOIN updated ON updated.id=movement.product_id",
      [body.product_id,type,quantity,note || null,user.id]
    );
    if (!rows[0]) return erpError(409, "STOCK_CONFLICT", "No se pudo aplicar el movimiento: el producto no existe, está inactivo, el ajuste no cambia el stock o la salida supera las existencias.");
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "22P02") return erpError(400, "INVALID_PRODUCT_ID", "El producto seleccionado no tiene un identificador válido.");
    if (error?.code === "23503") return erpError(400, "PRODUCT_NOT_FOUND", "El producto relacionado no existe.");
    if (error?.code === "23514" || error?.code === "22003") return erpError(400, "INVALID_MOVEMENT", "La cantidad o los datos del movimiento no cumplen las reglas del inventario.");
    console.error("[erp] Inventory movement failed:",error?.message || "database error");
    return erpError(503, "MOVEMENT_SAVE_FAILED", "No se pudo guardar el movimiento en Neon.");
  }
}


async function createPurchase(sql, user, body) {
  const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const rate = Number(body.exchange_rate ?? 1);
  const paidUsd = roundCurrency(body.paid_usd ?? 0);
  const purchaseNumber = String(body.purchase_number || "").trim();
  const supplierName = String(body.supplier_name || "").trim();
  const currency = String(body.currency || "USD").toUpperCase();
  const notes = body.notes == null ? null : String(body.notes).trim();
  const rawItems = Array.isArray(body.items) ? body.items : [{
    product_id: body.product_id,
    quantity: body.quantity,
    unit_cost_usd: body.unit_cost_usd
  }];
  if (!body.supplier_id || !supplierName || supplierName.length > 160 ||
      !purchaseNumber || purchaseNumber.length > 80 ||
      !["USD","NIO"].includes(currency) ||
      !Number.isFinite(rate) || rate <= 0 || rate > 100000 ||
      (notes && notes.length > 500) ||
      !Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) {
    return erpError(400, "INVALID_PURCHASE", "Revisa proveedor, número de compra, moneda y líneas recibidas.");
  }
  const seenProducts = new Set();
  const items = [];
  for (const item of rawItems) {
    const productId = String(item?.product_id || "").trim();
    const quantity = Number(item?.quantity);
    const unitCostUsd = Number(item?.unit_cost_usd);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647 ||
        !Number.isFinite(unitCostUsd) || unitCostUsd <= 0 || unitCostUsd > 999999999999.99) {
      return erpError(400, "INVALID_PURCHASE_LINE", "Cada línea requiere un producto, cantidad entera y costo unitario válidos.");
    }
    if (seenProducts.has(productId)) {
      return erpError(400, "DUPLICATE_PURCHASE_PRODUCT", "No repitas un producto en la misma compra; combina las unidades en una sola línea.");
    }
    seenProducts.add(productId);
    const roundedCost = roundCurrency(unitCostUsd);
    const lineTotalUsd = roundCurrency(quantity * roundedCost);
    if (!Number.isFinite(lineTotalUsd) || lineTotalUsd <= 0 || lineTotalUsd > 999999999999.99) {
      return erpError(400, "INVALID_PURCHASE_LINE_TOTAL", "El total de una línea supera el importe permitido.");
    }
    items.push({ product_id: productId, quantity, unit_cost_usd: roundedCost });
  }
  const totalUsd = roundCurrency(items.reduce((sum, item) => sum + roundCurrency(item.quantity * item.unit_cost_usd), 0));
  if (!Number.isFinite(totalUsd) || totalUsd <= 0 || totalUsd > 999999999999.99) {
    return erpError(400, "INVALID_PURCHASE_TOTAL", "El total de la compra debe ser un importe positivo y válido.");
  }
  const originalAmount = roundCurrency(body.initial_payment_amount ?? 0);
  if (!Number.isFinite(paidUsd) || paidUsd < 0 || paidUsd > totalUsd + 0.001 ||
      !Number.isFinite(originalAmount) || originalAmount < 0) {
    return erpError(400, "INVALID_INITIAL_PAYMENT", "El pago inicial debe estar entre cero y el total de la compra.");
  }
  const convertedPayment = currency === "NIO" ? originalAmount / rate : originalAmount;
  if (Math.abs(convertedPayment - paidUsd) > 0.02) {
    return erpError(400, "PAYMENT_CONVERSION_MISMATCH", "El pago inicial no coincide con el importe convertido a USD.");
  }
  const accountName = String(body.account_name || "").trim();
  if (paidUsd > 0 && (!accountName || accountName.length > 120)) {
    return erpError(400, "INVALID_INITIAL_PAYMENT", "El pago inicial requiere una cuenta de caja o banco.");
  }
  if (paidUsd > 0) {
    const account = await sql.query("SELECT id FROM cash_accounts WHERE name=$1 AND currency=$2 AND active=TRUE LIMIT 1", [accountName, currency]);
    if (!account[0]) return erpError(400, "CASH_ACCOUNT_NOT_FOUND", "La cuenta de pago no existe o no coincide con la moneda.");
  }
  const status = paidUsd >= totalUsd - 0.001 ? "Pagado" : (paidUsd > 0 ? "Abono parcial" : "Pendiente");
  try {
    const rows = await sql.query(
      "WITH input AS (" +
      "SELECT $1::text AS purchase_number,$2::uuid AS supplier_id,$3::text AS supplier_name,$4::text AS currency," +
      "$5::numeric AS rate,$6::numeric AS total_usd,$7::numeric AS paid_usd,$8::text AS status,$9::text AS notes," +
      "$10::jsonb AS items,$11::numeric AS original_payment,$12::text AS account_name,$13::uuid AS actor" +
      "), lines AS (" +
      "SELECT product_id,quantity,unit_cost_usd,ROUND(quantity*unit_cost_usd,2) AS line_total_usd " +
      "FROM jsonb_to_recordset((SELECT items FROM input)) AS x(product_id uuid,quantity integer,unit_cost_usd numeric)" +
      "), validation AS (" +
      "SELECT COUNT(*) FILTER (WHERE p.id IS NULL OR p.active IS NOT TRUE) AS invalid_count,COUNT(*) AS line_count " +
      "FROM lines l LEFT JOIN products p ON p.id=l.product_id" +
      "), targets AS (" +
      "SELECT p.id,p.name,p.sku,p.stock,p.purchase_cost_usd,p.additional_cost_usd,l.quantity,l.unit_cost_usd,l.line_total_usd " +
      "FROM products p JOIN lines l ON l.product_id=p.id WHERE p.active=TRUE FOR UPDATE OF p" +
      "), created AS (" +
      "INSERT INTO purchases(purchase_number,supplier_id,supplier_name,currency,exchange_rate,total_usd,paid_usd,status,notes,created_by) " +
      "SELECT i.purchase_number,i.supplier_id,i.supplier_name,i.currency,i.rate,i.total_usd,i.paid_usd,i.status,i.notes,i.actor " +
      "FROM input i CROSS JOIN validation v WHERE v.invalid_count=0 AND v.line_count=jsonb_array_length(i.items) RETURNING *" +
      "), item_rows AS (" +
      "INSERT INTO purchase_items(purchase_id,product_id,product_name,quantity,unit_cost_usd,line_total_usd) " +
      "SELECT created.id,targets.id,targets.name,targets.quantity,targets.unit_cost_usd,targets.line_total_usd FROM created CROSS JOIN targets RETURNING id" +
      "), updated AS (" +
      "UPDATE products p SET stock=t.stock+t.quantity," +
      "purchase_cost_usd=ROUND(((t.purchase_cost_usd*t.stock)+(t.unit_cost_usd*t.quantity))/(t.stock+t.quantity),2)," +
      "unit_cost_usd=ROUND(((t.purchase_cost_usd*t.stock)+(t.unit_cost_usd*t.quantity))/(t.stock+t.quantity),2)+t.additional_cost_usd," +
      "updated_at=NOW() FROM targets t WHERE p.id=t.id AND EXISTS(SELECT 1 FROM created) " +
      "RETURNING p.id,p.name,p.sku,t.stock AS previous_stock,t.quantity,p.stock AS new_stock" +
      "), movements AS (" +
      "INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) " +
      "SELECT id,'Entrada',quantity,quantity,previous_stock,new_stock,'Entrada por compra '||(SELECT purchase_number FROM input),'purchase'," +
      "(SELECT id::text FROM created),(SELECT actor FROM input) FROM updated RETURNING id" +
      "), cash AS (" +
      "INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) " +
      "SELECT 'expense','Pago inicial de compra '||created.purchase_number," +
      "(SELECT id FROM cash_accounts WHERE name=input.account_name AND currency=input.currency AND active=TRUE LIMIT 1)," +
      "input.currency,input.original_payment,input.rate,input.paid_usd,'purchase',created.id::text,input.actor " +
      "FROM created CROSS JOIN input WHERE input.paid_usd>0 RETURNING id" +
      "), logged AS (" +
      "INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT input.actor,'create','purchase',created.id::text," +
      "jsonb_build_object('purchase',to_jsonb(created),'line_count',(SELECT COUNT(*) FROM item_rows),'total_usd',created.total_usd) " +
      "FROM created CROSS JOIN input RETURNING id" +
      ") SELECT created.*,(SELECT COUNT(*) FROM item_rows)::int AS item_count FROM created",
      [purchaseNumber,body.supplier_id,supplierName,currency,rate,totalUsd,paidUsd,status,notes,JSON.stringify(items),originalAmount,paidUsd>0?accountName:null,user.id]
    );
    if (!rows[0]) return erpError(409, "PURCHASE_PRODUCT_NOT_FOUND", "No se pudo registrar la compra: uno o más productos no existen o están inactivos.");
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "22P02") return erpError(400, "INVALID_PURCHASE_REFERENCE", "El proveedor o uno de los productos tiene un identificador no válido.");
    if (error?.code === "23505") return erpError(409, "DUPLICATE_PURCHASE", "El número de compra ya existe.");
    if (error?.code === "23503") return erpError(400, "RELATED_RECORD_NOT_FOUND", "El proveedor, producto o cuenta seleccionada no existe.");
    if (error?.code === "23514" || error?.code === "22003") return erpError(400, "INVALID_PURCHASE", "Los datos de la compra no cumplen las reglas del sistema.");
    console.error("[erp] Purchase creation failed:", error?.message || "database error");
    return erpError(503, "PURCHASE_SAVE_FAILED", "No se pudo registrar la compra.");
  }
}
export async function createInvoice(sql, user, body) {
  const items=Array.isArray(body.items)?body.items:[];
  const total=Number(body.total_usd),paid=Number(body.paid_usd||0),rate=Number(body.exchange_rate||1);
  const subtotal=Number(body.subtotal_usd??total),discount=Number(body.discount_usd||0),delivery=Number(body.delivery_fee_usd||0);
  const source=["store","web","manual"].includes(body.source)?body.source:"manual";
  const orderId=source==="web"?String(body.order_id||""):"";
  if(!body.customer_name||!items.length||!Number.isFinite(total)||total<=0||!Number.isFinite(paid)||paid<0||paid>total||!Number.isFinite(rate)||rate<=0||
     !Number.isFinite(subtotal)||subtotal<0||!Number.isFinite(discount)||discount<0||discount>subtotal||!Number.isFinite(delivery)||delivery<0)
    return erpError(400,"INVALID_INVOICE","Revisa cliente, productos, subtotal, descuento, entrega, total, pago y tipo de cambio.");
  if(items.some(item=>!item.product_id||!item.product_name||!Number.isInteger(Number(item.quantity))||Number(item.quantity)<1||!Number.isFinite(Number(item.unit_price_usd))||Number(item.unit_price_usd)<0))
    return erpError(400,"INVALID_INVOICE_ITEMS","Cada renglón requiere producto, cantidad y precio válidos.");
  const itemsSubtotal=items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price_usd),0);
  if(Math.abs(itemsSubtotal-subtotal)>0.02||Math.abs((subtotal-discount+delivery)-total)>0.02)
    return erpError(400,"INVOICE_TOTAL_MISMATCH","El subtotal y total no coinciden con los productos, descuento y entrega.");
  if(source==="web"){
    if(!orderId)return erpError(400,"WEB_ORDER_REQUIRED","Selecciona el pedido web que se va a facturar.");
    const sourceRows=await sql.query(
      "SELECT o.order_number,o.customer_id::text AS customer_id,o.customer_name,o.discount_usd::text AS discount_usd,o.delivery_fee_usd::text AS delivery_fee_usd,o.total_usd::text AS total_usd,oi.product_id::text AS product_id,oi.product_name,oi.sku_snapshot,oi.quantity,oi.unit_price_usd::text AS unit_price_usd FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.id=$1::uuid AND o.status<>'Cancelado' ORDER BY oi.id ASC",
      [orderId]
    );
    if(!sourceRows.length)return erpError(404,"WEB_ORDER_NOT_FOUND","El pedido web no existe, está cancelado o no contiene productos.");
    const normalized=(rows)=>rows.map(item=>[
      String(item.product_id||""),String(item.product_name||"").trim(),String(item.sku_snapshot||"").trim(),
      Number(item.quantity),Number(item.unit_price_usd).toFixed(2)
    ].join("|")).sort();
    if(String(body.order_number_snapshot||"")!==String(sourceRows[0].order_number)||
       String(body.customer_id||"")!==String(sourceRows[0].customer_id||"")||
       String(body.customer_name||"").trim().toLocaleLowerCase("es")!==String(sourceRows[0].customer_name||"").trim().toLocaleLowerCase("es")||
       Math.abs(discount-Number(sourceRows[0].discount_usd||0))>0.02||
       Math.abs(delivery-Number(sourceRows[0].delivery_fee_usd||0))>0.02||
       Math.abs(total-Number(sourceRows[0].total_usd||0))>0.02||
       JSON.stringify(normalized(items))!==JSON.stringify(normalized(sourceRows))){
      return erpError(409,"WEB_ORDER_ITEMS_MISMATCH","Los productos, cantidades, precios o cliente de la factura no coinciden con el pedido original.");
    }
  }
  const number=String(body.invoice_number||"").trim();
  if(!number)return erpError(400,"INVOICE_NUMBER_REQUIRED","El número de comprobante es obligatorio.");
  const currency=body.currency==="NIO"?"NIO":"USD";
  const originalPayment=Number(body.original_payment_amount||0);
  if(paid>0&&(!Number.isFinite(originalPayment)||originalPayment<=0||!body.account_name))
    return erpError(400,"INVALID_PAYMENT","El cobro inicial requiere importe y cuenta.");
  if(paid>0){
    const expected=currency==="NIO"?originalPayment/rate:originalPayment;
    if(Math.abs(expected-paid)>0.02)return erpError(400,"PAYMENT_CONVERSION_MISMATCH","El importe recibido no coincide con el pago convertido a USD.");
    const account=await sql.query("SELECT id FROM cash_accounts WHERE name=$1 AND currency=$2 AND active=TRUE LIMIT 1",[body.account_name,currency]);
    if(!account[0])return erpError(400,"CASH_ACCOUNT_NOT_FOUND","La cuenta de cobro no existe o no coincide con la moneda.");
  }
  try{
    const rows=await sql.query(
      "WITH input AS (SELECT $1::text AS invoice_number,$2::text AS source,$3::uuid AS order_id,$4::text AS order_number,$5::uuid AS customer_id,$6::text AS customer_name,$7::text AS customer_phone,$8::text AS currency,$9::numeric AS rate,$10::numeric AS subtotal,$11::numeric AS discount,$12::numeric AS delivery,$13::numeric AS total,$14::numeric AS paid,$15::text AS payment_method,$16::text AS notes,$17::jsonb AS items,$18::numeric AS original_payment,$19::text AS account_name,$20::uuid AS actor), web_order_lock AS (SELECT o.id FROM orders o CROSS JOIN input i WHERE i.source='web' AND o.id=i.order_id AND o.status<>'Cancelado' FOR UPDATE OF o), lock_gate AS (SELECT 1 AS ok FROM input i WHERE i.source<>'web' OR EXISTS(SELECT 1 FROM web_order_lock)), customer_new AS (INSERT INTO customers(name,contact,phone,customer_type,active) SELECT input.customer_name,input.customer_phone,input.customer_phone,'particular',TRUE FROM input WHERE input.customer_id IS NULL AND NOT EXISTS(SELECT 1 FROM customers c WHERE LOWER(c.name)=LOWER(input.customer_name)) RETURNING id), customer_resolved AS (SELECT COALESCE(input.customer_id,(SELECT c.id FROM customers c WHERE LOWER(c.name)=LOWER(input.customer_name) ORDER BY c.created_at ASC LIMIT 1),(SELECT id FROM customer_new LIMIT 1)) AS customer_id FROM input), item_totals AS (SELECT product_id,SUM(quantity)::int AS quantity FROM jsonb_to_recordset((SELECT items FROM input)) AS x(product_id uuid,product_name text,sku_snapshot text,quantity integer,unit_price_usd numeric,unit_cost_usd numeric) GROUP BY product_id), targets AS (SELECT p.id,p.name,p.sku,p.stock,p.unit_cost_usd,t.quantity FROM products p JOIN item_totals t ON t.product_id=p.id CROSS JOIN lock_gate WHERE p.active=TRUE FOR UPDATE OF p), order_stock AS (SELECT COALESCE((SELECT BOOL_AND(COALESCE(m.quantity_delta,0)=-o.quantity) FROM (SELECT product_id,SUM(quantity)::int AS quantity FROM order_items WHERE order_id=(SELECT order_id FROM input) AND product_id IS NOT NULL GROUP BY product_id) o LEFT JOIN (SELECT product_id,SUM(quantity_delta)::int AS quantity_delta FROM inventory_movements WHERE reference_type='order' AND reference_id=(SELECT order_id::text FROM input) GROUP BY product_id) m ON m.product_id=o.product_id),FALSE) AS already_applied), validation AS (SELECT COUNT(*) FILTER(WHERE targets.id IS NULL OR (targets.stock<targets.quantity AND NOT order_stock.already_applied)) AS invalid_count FROM item_totals LEFT JOIN targets ON targets.id=item_totals.product_id CROSS JOIN order_stock), created AS (INSERT INTO invoices(invoice_number,source,order_id,order_number_snapshot,customer_id,customer_name,customer_phone,currency,exchange_rate,subtotal_usd,discount_usd,delivery_fee_usd,total_usd,paid_usd,status,payment_method,notes,created_by) SELECT i.invoice_number,CASE WHEN i.source IN('store','web','manual') THEN i.source ELSE 'manual' END,i.order_id,i.order_number,r.customer_id,i.customer_name,i.customer_phone,i.currency,i.rate,i.subtotal,i.discount,i.delivery,i.total,i.paid,CASE WHEN i.paid>=i.total THEN 'Pagada' WHEN i.paid>0 THEN 'Abono parcial' ELSE 'Pendiente' END,i.payment_method,i.notes,i.actor FROM input i CROSS JOIN customer_resolved r CROSS JOIN validation v WHERE v.invalid_count=0 AND EXISTS(SELECT 1 FROM lock_gate) AND NOT EXISTS(SELECT 1 FROM input x WHERE x.source='web' AND x.order_id IS NOT NULL AND EXISTS(SELECT 1 FROM invoices old WHERE old.order_id=x.order_id)) RETURNING *), invoice_lines AS (INSERT INTO invoice_items(invoice_id,product_id,product_name,sku_snapshot,quantity,unit_price_usd,line_total_usd,unit_cost_usd) SELECT created.id,x.product_id,x.product_name,x.sku_snapshot,x.quantity,x.unit_price_usd,x.quantity*x.unit_price_usd,COALESCE(t.unit_cost_usd,0) FROM created CROSS JOIN input CROSS JOIN LATERAL jsonb_to_recordset(input.items) AS x(product_id uuid,product_name text,sku_snapshot text,quantity integer,unit_price_usd numeric,unit_cost_usd numeric) JOIN targets t ON t.id=x.product_id RETURNING id), updated AS (UPDATE products p SET stock=p.stock-t.quantity,updated_at=NOW() FROM targets t CROSS JOIN order_stock os WHERE p.id=t.id AND EXISTS(SELECT 1 FROM created) AND NOT os.already_applied RETURNING p.id,p.name,p.sku,t.stock AS previous_stock,t.quantity,p.stock AS new_stock), movements AS (INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) SELECT id,'Salida',quantity,-quantity,previous_stock,new_stock,'Venta por factura '||(SELECT invoice_number FROM created),'invoice',(SELECT id::text FROM created),(SELECT actor FROM input) FROM updated RETURNING id), payment AS (INSERT INTO invoice_payments(invoice_id,currency,original_amount,exchange_rate,amount_usd,account_name,payment_method,created_by) SELECT created.id,input.currency,input.original_payment,input.rate,input.paid,input.account_name,input.payment_method,input.actor FROM created CROSS JOIN input WHERE input.paid>0 RETURNING id), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'income','Cobro inicial factura '||created.invoice_number,(SELECT id FROM cash_accounts WHERE name=input.account_name AND currency=input.currency AND active=TRUE LIMIT 1),input.currency,input.original_payment,input.rate,input.paid,'invoice',created.id::text,input.actor FROM created CROSS JOIN input WHERE input.paid>0 RETURNING id), order_update AS (UPDATE orders o SET payment_status=CASE WHEN created.paid_usd>=created.total_usd THEN 'Pagado' WHEN created.paid_usd>0 THEN 'Abono parcial' ELSE 'Pendiente' END,payment_method=created.payment_method,status=CASE WHEN o.status='Pendiente' THEN 'En preparación' ELSE o.status END,updated_at=NOW() FROM created WHERE created.order_id=o.id RETURNING o.id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT input.actor,'create','invoice',created.id::text,to_jsonb(created) FROM created CROSS JOIN input) SELECT created.* FROM created",
      [number,source,orderId||null,source==="web"?body.order_number_snapshot:null,body.customer_id||null,String(body.customer_name).trim(),body.customer_phone||null,currency,rate,subtotal,discount,delivery,total,paid,body.payment_method||null,body.notes||null,JSON.stringify(items),originalPayment,body.account_name||null,user.id]
    );
    if(!rows[0]){
      const check=await sql.query("SELECT COUNT(*)::int AS invalid_count FROM jsonb_to_recordset($1::jsonb) AS x(product_id uuid,quantity integer) LEFT JOIN products p ON p.id=x.product_id AND p.active=TRUE WHERE p.id IS NULL OR p.stock<x.quantity",[JSON.stringify(items)]);
      if(check[0]?.invalid_count)return erpError(409,"INSUFFICIENT_STOCK","Uno o más perfumes no tienen existencias suficientes o están inactivos.");
      return erpError(409,"DUPLICATE_WEB_INVOICE","El pedido web seleccionado ya tiene una factura.");
    }
    return erpJson({record:rows[0]},201);
  }catch(error){
    if(error?.code==="23505"&&error?.constraint==="invoices_order_id_unique_idx")return erpError(409,"DUPLICATE_WEB_INVOICE","Este pedido web ya tiene una factura registrada.");
    if(error?.code==="23505")return erpError(409,"DUPLICATE_INVOICE","El número de factura ya existe.");
    if(error?.code==="23503")return erpError(400,"RELATED_RECORD_NOT_FOUND","El cliente, pedido o producto relacionado no existe.");
    console.error("[erp] Invoice creation failed:",error?.message||"database error");
    return erpError(503,"INVOICE_SAVE_FAILED","No se pudo registrar la factura.");
  }
}

async function handleProductAsset(request,env,user,sql) {
  if(!canAccess(user,RESOURCE_DEFS.products.roles))return erpError(403,"FORBIDDEN","No tienes permiso para administrar imágenes de productos.");
  if(!env?.ERP_ASSETS)return erpError(503,"R2_NOT_CONFIGURED","El almacenamiento privado de imágenes no está disponible.");
  if(request.method==="POST"){
    let form;
    try{form=await request.formData();}catch{return erpError(400,"INVALID_FORM_DATA","El formulario de carga no es válido.");}
    const productId=String(form.get("product_id")||"");
    const file=form.get("file");
    if(!/^[0-9a-f-]{36}$/i.test(productId)||!file||typeof file.stream!=="function")return erpError(400,"INVALID_UPLOAD","Selecciona un producto e imagen válidos.");
    const allowed=new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"],["image/avif","avif"]]);
    const extension=allowed.get(String(file.type||"").toLowerCase());
    if(!extension)return erpError(415,"UNSUPPORTED_IMAGE_TYPE","Solo se permiten imágenes JPG, PNG, WebP o AVIF.");
    if(file.size<1||file.size>2*1024*1024)return erpError(413,"IMAGE_TOO_LARGE","La imagen debe pesar como máximo 2 MB.");
    const product=await sql.query("SELECT id,name,images FROM products WHERE id=$1::uuid LIMIT 1",[productId]);
    if(!product[0])return erpError(404,"PRODUCT_NOT_FOUND","No se encontró el producto.");
    const key="products/"+productId+"/"+crypto.randomUUID()+"."+extension;
    try{
      await env.ERP_ASSETS.put(key,file.stream(),{
        httpMetadata:{contentType:file.type,cacheControl:"private, no-store"},
        customMetadata:{productId,uploadedBy:user.id,originalName:String(file.name||"image").slice(0,180)}
      });
      const imageRecord={key,name:String(file.name||("product-image."+extension)).slice(0,180),contentType:file.type,size:file.size,uploadedAt:new Date().toISOString()};
      const rows=await sql.query(
        "UPDATE products SET images=COALESCE(images,'[]'::jsonb)||$2::jsonb,updated_at=NOW() WHERE id=$1::uuid AND jsonb_array_length(COALESCE(images,'[]'::jsonb))<3 RETURNING id,images",
        [productId,JSON.stringify([imageRecord])]
      );
      if(!rows[0]){
        await env.ERP_ASSETS.delete(key);
        return erpError(409,"PRODUCT_IMAGE_LIMIT_REACHED","Cada producto puede conservar un máximo de tres fotografías. Elimina una antes de agregar otra.");
      }
      await auditQuery(sql,user.id,"upload","product_asset",key,{productId,fileName:imageRecord.name,contentType:file.type,size:file.size});
      return erpJson({asset:imageRecord,productId:rows[0].id},201);
    }catch(error){
      try{await env.ERP_ASSETS.delete(key);}catch{}
      console.error("[r2] Product image upload failed:",error?.message||"storage error");
      return erpError(503,"IMAGE_UPLOAD_FAILED","No se pudo guardar la imagen y asociarla al producto.");
    }
  }
  if(request.method==="GET"){
    const key=String(new URL(request.url).searchParams.get("key")||"");
    const match=key.match(/^products\/([0-9a-f-]{36})\/[A-Za-z0-9._-]+$/i);
    if(!match)return erpError(400,"INVALID_ASSET_KEY","La referencia de imagen no es válida.");
    const productId=match[1];
    const rows=await sql.query("SELECT 1 FROM products WHERE id=$1::uuid AND images @> $2::jsonb LIMIT 1",[productId,JSON.stringify([{key}])]);
    if(!rows[0])return erpError(404,"ASSET_NOT_FOUND","La imagen no está asociada a un producto autorizado.");
    const object=await env.ERP_ASSETS.get(key);
    if(!object)return erpError(404,"ASSET_NOT_FOUND","La imagen no existe en el almacenamiento.");
    const headers=new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag",object.httpEtag);
    headers.set("cache-control","private, no-store");
    headers.set("x-content-type-options","nosniff");
    headers.set("content-security-policy","default-src 'none'; sandbox");
    return new Response(object.body,{status:200,headers});
  }
  if(request.method==="DELETE"){
    let body;try{body=await request.json();}catch{return erpError(400,"INVALID_JSON","El cuerpo JSON no es válido.");}
    const key=String(body.key||""),productId=String(body.product_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(productId)||!key.startsWith("products/"+productId+"/"))return erpError(400,"INVALID_ASSET_KEY","La referencia de imagen no corresponde al producto.");
    const rows=await sql.query(
      "UPDATE products SET images=COALESCE((SELECT jsonb_agg(image) FROM jsonb_array_elements(COALESCE(images,'[]'::jsonb)) image WHERE image->>'key'<>$2),'[]'::jsonb),updated_at=NOW() WHERE id=$1::uuid AND images @> $3::jsonb RETURNING id",
      [productId,key,JSON.stringify([{key}])]
    );
    if(!rows[0])return erpError(404,"ASSET_NOT_FOUND","La imagen no está asociada al producto.");
    await env.ERP_ASSETS.delete(key);
    await auditQuery(sql,user.id,"delete","product_asset",key,{productId});
    return erpJson({deleted:true,key});
  }
  return erpError(405,"METHOD_NOT_ALLOWED","Método no permitido para el archivo.");
}

async function createDgiSupportDocument(request, env, user, sql) {
  if (!canAccess(user, ["owner","admin","finance"])) return erpError(403,"FORBIDDEN","No tienes permiso para registrar documentos DGI.");
  if (!env?.ERP_ASSETS) return erpError(503,"R2_NOT_CONFIGURED","El almacenamiento privado de documentos no está disponible.");
  let form;
  try { form = await request.formData(); } catch { return erpError(400,"INVALID_FORM_DATA","El formulario del documento no es válido."); }
  const documentDate=String(form.get("document_date")||"");
  const documentType=String(form.get("document_type")||"");
  const issuer=String(form.get("issuer")||"").trim();
  const referenceNumber=String(form.get("reference_number")||"").trim();
  const description=String(form.get("description")||"").trim();
  const fiscalPeriod=String(form.get("fiscal_period")||"").trim();
  const currency=form.get("currency")==="USD"?"USD":"NIO";
  const originalAmount=Number(form.get("original_amount")||0);
  const rate=Number(form.get("exchange_rate")||1);
  const formalInvoice=form.get("formal_invoice")==="true";
  const notes=String(form.get("notes")||"").trim();
  const file=form.get("file");
  const allowedTypes=new Map([["application/pdf","pdf"],["image/jpeg","jpg"],["image/png","png"]]);
  const extension=allowedTypes.get(String(file?.type||"").toLowerCase());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate) || !["purchase_invoice","service_invoice","rent_receipt","municipal_payment","dgi_payment","other"].includes(documentType) ||
      !issuer || issuer.length>180 || referenceNumber.length>100 || description.length>240 ||
      (fiscalPeriod && !/^\d{4}-(0[1-9]|1[0-2])$/.test(fiscalPeriod)) ||
      !Number.isFinite(originalAmount) || originalAmount<0 || !Number.isFinite(rate) || rate<=0 ||
      !file || typeof file.stream!=="function" || !extension || file.size<1 || file.size>5*1024*1024) {
    return erpError(400,"INVALID_DGI_DOCUMENT","Revisa fecha, tipo, emisor, período, importe y archivo PDF/JPG/PNG (máximo 5 MB).");
  }
  const id=crypto.randomUUID();
  const key="dgi-documents/"+id+"/"+crypto.randomUUID()+"."+extension;
  const amountNio=Math.round((currency==="NIO"?originalAmount:originalAmount*rate)*100)/100;
  const fileName=String(file.name||("document."+extension)).slice(0,180);
  try {
    await env.ERP_ASSETS.put(key,file.stream(),{
      httpMetadata:{contentType:file.type,cacheControl:"private, no-store"},
      customMetadata:{documentId:id,uploadedBy:user.id,originalName:fileName}
    });
    const rows=await sql.query(
      "WITH created AS (INSERT INTO dgi_support_documents(id,document_date,document_type,issuer,reference_number,description,fiscal_period,currency,original_amount,amount_nio,formal_invoice,file_key,file_name,file_type,file_size,notes,created_by) VALUES($1::uuid,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $17,'upload','dgi_support_document',id::text,jsonb_build_object('document_type',$3,'issuer',$4,'document_date',$2,'file_name',$13) FROM created) SELECT * FROM created",
      [id,documentDate,documentType,issuer,referenceNumber||null,description||null,fiscalPeriod||null,currency,originalAmount,amountNio,formalInvoice,key,fileName,file.type,file.size,notes||null,user.id]
    );
    if(!rows[0])throw new Error("El registro del documento no se creó.");
    return erpJson({record:rows[0]},201);
  } catch(error) {
    try { await env.ERP_ASSETS.delete(key); } catch {}
    if(error?.code==="23514"||error?.code==="22P02")return erpError(400,"INVALID_DGI_DOCUMENT","El documento no cumple las reglas de almacenamiento.");
    console.error("[dgi] Document upload failed:",error?.message||"database error");
    return erpError(503,"DGI_DOCUMENT_SAVE_FAILED","No se pudo guardar el documento y su respaldo.");
  }
}

async function getDgiSupportDocumentFile(request, env, user, sql, id) {
  if (!canAccess(user, ["owner","admin","finance"])) return erpError(403,"FORBIDDEN","No tienes permiso para consultar documentos DGI.");
  if (!env?.ERP_ASSETS) return erpError(503,"R2_NOT_CONFIGURED","El almacenamiento privado no está disponible.");
  if (!/^[0-9a-f-]{36}$/i.test(String(id||""))) return erpError(400,"INVALID_DOCUMENT_ID","La referencia del documento no es válida.");
  const rows=await sql.query("SELECT file_key,file_name,file_type FROM dgi_support_documents WHERE id=$1::uuid LIMIT 1",[id]);
  if(!rows[0])return erpError(404,"DGI_DOCUMENT_NOT_FOUND","No se encontró el documento.");
  const object=await env.ERP_ASSETS.get(rows[0].file_key);
  if(!object)return erpError(404,"DGI_FILE_NOT_FOUND","El archivo no existe en el almacenamiento privado.");
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control","private, no-store");
  headers.set("x-content-type-options","nosniff");
  headers.set("content-security-policy","default-src 'none'; sandbox");
  headers.set("content-disposition","inline; filename*=UTF-8''"+encodeURIComponent(rows[0].file_name||"documento"));
  return new Response(object.body,{status:200,headers});
}

async function createPayrollItem(sql,user,body) {
  const periodId=String(body.payroll_period_id||"");
  const employeeId=String(body.employee_id||"");
  const base=Number(body.base_salary_nio),bonus=Number(body.bonuses_nio||0),deductions=Number(body.deductions_nio||0);
  if(!periodId||!employeeId||![base,bonus,deductions].every(Number.isFinite)||base<0||bonus<0||deductions<0||deductions>base+bonus)
    return erpError(400,"INVALID_PAYROLL_ITEM","Revisa período, colaborador, salario base, bonos y deducciones.");
  try{
    const rows=await sql.query(
      "WITH period AS (SELECT id,status FROM hr_payroll_periods WHERE id=$1::uuid FOR UPDATE), employee AS (SELECT id FROM employees WHERE id=$2::uuid AND status='Activo'), created AS (INSERT INTO hr_payroll_items(payroll_period_id,employee_id,base_salary_nio,bonuses_nio,deductions_nio,net_salary_nio,notes) SELECT period.id,employee.id,$3,$4,$5,ROUND($3+$4-$5,2),$6 FROM period CROSS JOIN employee WHERE period.status='Borrador' RETURNING *), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $7,'create','hr_payroll_item',id::text,to_jsonb(created) FROM created) SELECT created.* FROM created",
      [periodId,employeeId,base,bonus,deductions,body.notes||null,user.id]
    );
    if(!rows[0]){
      const status=await sql.query("SELECT status FROM hr_payroll_periods WHERE id=$1::uuid",[periodId]);
      if(!status[0])return erpError(404,"PAYROLL_PERIOD_NOT_FOUND","No existe el período de nómina.");
      if(status[0].status!=="Borrador")return erpError(409,"PAYROLL_PERIOD_LOCKED","Solo se pueden agregar partidas a un período en borrador.");
      return erpError(404,"ACTIVE_EMPLOYEE_NOT_FOUND","El colaborador no existe o está inactivo.");
    }
    return erpJson({record:rows[0]},201);
  }catch(error){
    if(error?.code==="23505")return erpError(409,"DUPLICATE_PAYROLL_ITEM","Ya existe una partida de este colaborador en el período.");
    if(error?.code==="23503")return erpError(400,"RELATED_RECORD_NOT_FOUND","El período o colaborador seleccionado no existe.");
    console.error("[hr] Payroll item insert failed:",error?.message||"database error");
    return erpError(503,"PAYROLL_SAVE_FAILED","No se pudo guardar la partida de nómina.");
  }
}

async function changePayrollPeriodStatus(sql,user,id,body) {
  const status=String(body.status||"");
  if(status==="Aprobada"){
    const rows=await sql.query(
      "WITH target AS (SELECT id,status FROM hr_payroll_periods WHERE id=$1::uuid FOR UPDATE), totals AS (SELECT COUNT(*)::int AS item_count FROM hr_payroll_items WHERE payroll_period_id=$1::uuid), updated AS (UPDATE hr_payroll_periods p SET status='Aprobada',updated_at=NOW() FROM target,totals WHERE p.id=target.id AND target.status='Borrador' AND totals.item_count>0 RETURNING p.*), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $2,'approve','hr_payroll_period',id::text,to_jsonb(updated) FROM updated) SELECT * FROM updated",
      [id,user.id]
    );
    if(!rows[0])return erpError(409,"PAYROLL_CANNOT_APPROVE","El período no está en borrador o no contiene partidas de nómina.");
    return erpJson({record:rows[0]});
  }
  if(status==="Anulada"){
    const rows=await sql.query(
      "WITH changed AS (UPDATE hr_payroll_periods SET status='Anulada',updated_at=NOW() WHERE id=$1::uuid AND status='Borrador' RETURNING *), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $2,'void','hr_payroll_period',id::text,to_jsonb(changed) FROM changed) SELECT * FROM changed",
      [id,user.id]
    );
    if(!rows[0])return erpError(409,"PAYROLL_CANNOT_VOID","Solo se puede anular un período que siga en borrador.");
    return erpJson({record:rows[0]});
  }
  if(status==="Pagada"){
    const accountName=String(body.account_name||"");
    const account=await sql.query("SELECT id FROM cash_accounts WHERE name=$1 AND currency='NIO' AND active=TRUE LIMIT 1",[accountName]);
    if(!account[0])return erpError(400,"PAYROLL_ACCOUNT_NOT_FOUND","Selecciona una cuenta activa en córdobas.");
    const setting=await sql.query("SELECT setting_value->>'value' AS value FROM app_settings WHERE setting_key='default_exchange_rate' LIMIT 1");
    const rate=Number(setting[0]?.value||36.6);
    if(!Number.isFinite(rate)||rate<=0)return erpError(409,"PAYROLL_EXCHANGE_RATE_INVALID","Configura un tipo de cambio válido antes de pagar la nómina.");
    const rows=await sql.query(
      "WITH target AS (SELECT id,period_start,period_end,status FROM hr_payroll_periods WHERE id=$1::uuid FOR UPDATE), totals AS (SELECT COUNT(*)::int AS item_count,COALESCE(SUM(net_salary_nio),0)::numeric(14,2) AS total_nio FROM hr_payroll_items WHERE payroll_period_id=$1::uuid), updated AS (UPDATE hr_payroll_periods p SET status='Pagada',payment_date=COALESCE(p.payment_date,CURRENT_DATE),updated_at=NOW() FROM target,totals WHERE p.id=target.id AND target.status='Aprobada' AND totals.item_count>0 AND totals.total_nio>0 AND NOT EXISTS(SELECT 1 FROM cash_entries ce WHERE ce.source_type='payroll' AND ce.source_id=target.id::text) RETURNING p.*), expense AS (INSERT INTO expenses(category,description,currency,original_amount,exchange_rate,amount_usd,created_by) SELECT 'Nómina','Pago de nómina '||to_char(updated.period_start,'YYYY-MM-DD')||' al '||to_char(updated.period_end,'YYYY-MM-DD'),'NIO',totals.total_nio,$3,ROUND(totals.total_nio/$3,2),$4 FROM updated CROSS JOIN totals RETURNING id), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'expense','Pago de nómina '||to_char(updated.period_start,'YYYY-MM-DD')||' al '||to_char(updated.period_end,'YYYY-MM-DD'),$5,'NIO',totals.total_nio,$3,ROUND(totals.total_nio/$3,2),'payroll',updated.id::text,$4 FROM updated CROSS JOIN totals RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $4,'pay','hr_payroll_period',updated.id::text,jsonb_build_object('total_nio',totals.total_nio,'exchange_rate',$3,'account',$6) FROM updated CROSS JOIN totals) SELECT updated.* FROM updated",
      [id,account[0].id,rate,user.id,account[0].id,accountName]
    );
    if(!rows[0])return erpError(409,"PAYROLL_CANNOT_PAY","El período debe estar aprobado, tener partidas y no haber sido pagado.");
    return erpJson({record:rows[0]});
  }
  return erpError(400,"INVALID_PAYROLL_STATUS","La acción solicitada para el período no está permitida.");
}

async function reviewLeaveRequest(sql,user,id,body) {
  const status=String(body.status||"");
  if(!["Aprobado","Rechazado"].includes(status))return erpError(400,"INVALID_LEAVE_STATUS","La solicitud solo puede aprobarse o rechazarse.");
  const rows=await sql.query(
    "WITH changed AS (UPDATE hr_leave_requests SET status=$1,reviewed_by=$2,reviewed_at=NOW() WHERE id=$3::uuid AND status='Pendiente' RETURNING *), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $2,'review','hr_leave_request',id::text,jsonb_build_object('status',$1) FROM changed) SELECT * FROM changed",
    [status,user.id,id]
  );
  if(!rows[0])return erpError(409,"LEAVE_REQUEST_NOT_PENDING","La solicitud no existe o ya fue revisada.");
  return erpJson({record:rows[0]});
}

async function createCashEntry(sql,user,body) {
  const concept=String(body.concept||"").trim();
  const direction=String(body.direction||"");
  const currency=body.currency==="NIO"?"NIO":"USD";
  const original=Number(body.original_amount),rate=Number(body.exchange_rate||1),amountUsd=Number(body.amount_usd);
  if(!concept||concept.length>180||!["income","expense"].includes(direction)||!body.account_id||
     !Number.isFinite(original)||original<=0||!Number.isFinite(rate)||rate<=0||!Number.isFinite(amountUsd)||amountUsd<=0)
    return erpError(400,"INVALID_CASH_ENTRY","Revisa cuenta, concepto, dirección, importe y tipo de cambio.");
  const expected=currency==="NIO"?original/rate:original;
  if(Math.abs(expected-amountUsd)>0.02)return erpError(400,"AMOUNT_CONVERSION_MISMATCH","El movimiento no coincide con el importe convertido a USD.");
  const account=await sql.query("SELECT id FROM cash_accounts WHERE id=$1::uuid AND currency=$2 AND active=TRUE LIMIT 1",[body.account_id,currency]);
  if(!account[0])return erpError(400,"CASH_ACCOUNT_NOT_FOUND","La cuenta no existe, está inactiva o utiliza otra moneda.");
  try{
    const rows=await sql.query(
      "WITH created AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $10,'create','cash_entry',id::text,to_jsonb(created) FROM created) SELECT * FROM created",
      [direction,concept,body.account_id,currency,original,rate,amountUsd,"manual",null,user.id]
    );
    return erpJson({record:rows[0]},201);
  }catch(error){
    if(error?.code==="23503")return erpError(400,"RELATED_RECORD_NOT_FOUND","La cuenta o referencia relacionada no existe.");
    console.error("[finance] Cash entry failed:",error?.message||"database error");
    return erpError(503,"CASH_ENTRY_FAILED","No se pudo registrar el movimiento de caja.");
  }
}

async function createCashAccount(sql,user,body) {
  const name=String(body.name||"").trim();
  const currency=body.currency==="NIO"?"NIO":"USD";
  const accountType=["Caja","Banco","Otro"].includes(body.account_type)?body.account_type:"Caja";
  const opening=Number(body.opening_balance||0),rate=Number(body.exchange_rate||1);
  if(!name||name.length>80||!Number.isFinite(opening)||opening<0||!Number.isFinite(rate)||rate<=0)return erpError(400,"INVALID_CASH_ACCOUNT","Revisa nombre, saldo inicial y tipo de cambio.");
  const openingUsd=currency==="NIO"?opening/rate:opening;
  try{
    const rows=await sql.query(
      "WITH created AS (INSERT INTO cash_accounts(name,currency,account_type,active) VALUES($1,$2,$3,TRUE) RETURNING *), opening AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'income','Saldo inicial · '||created.name,created.id,$2,$4,CASE WHEN $2='NIO' THEN $5 ELSE 1 END,$6,'opening_balance',created.id::text,$7 FROM created WHERE $4>0 RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $7,'create','cash_account',created.id::text,jsonb_build_object('name',created.name,'currency',created.currency,'account_type',created.account_type,'opening_balance',$4) FROM created) SELECT * FROM created",
      [name,currency,accountType,opening,rate,openingUsd,user.id]
    );
    return erpJson({record:rows[0]},201);
  }catch(error){
    if(error?.code==="23505")return erpError(409,"DUPLICATE_CASH_ACCOUNT","Ya existe una cuenta con ese nombre.");
    console.error("[finance] Cash account creation failed:",error?.message||"database error");
    return erpError(503,"CASH_ACCOUNT_SAVE_FAILED","No se pudo crear la cuenta.");
  }
}

async function createExpense(sql,user,body) {
  const amount=Number(body.original_amount),rate=Number(body.exchange_rate||1),amountUsd=Number(body.amount_usd);
  if(!body.category||!body.description||!Number.isFinite(amount)||amount<=0||!Number.isFinite(rate)||rate<=0||!Number.isFinite(amountUsd)||amountUsd<=0||!body.account_name) return erpError(400,"INVALID_EXPENSE","Revisa categoría, descripción, importe, tasa y cuenta.");
  const currency=body.currency==="NIO"?"NIO":"USD";
  const expected=currency==="NIO"?amount/rate:amount;
  if(Math.abs(expected-amountUsd)>0.02)return erpError(400,"AMOUNT_CONVERSION_MISMATCH","El gasto no coincide con el importe convertido a USD.");
  const account=await sql.query("SELECT id FROM cash_accounts WHERE name=$1 AND currency=$2 AND active=TRUE LIMIT 1",[body.account_name,currency]);
  if(!account[0])return erpError(400,"CASH_ACCOUNT_NOT_FOUND","La cuenta del gasto no existe o no coincide con la moneda.");
  try {
    const rows=await sql.query(
      "WITH created AS (INSERT INTO expenses(category,description,currency,original_amount,exchange_rate,amount_usd,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'expense','Gasto: '||created.description,(SELECT id FROM cash_accounts WHERE name=$8 AND currency=$3 AND active=TRUE LIMIT 1),$3,$4,$5,$6,'expense',created.id::text,$7 FROM created RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $7,'create','expense',created.id::text,to_jsonb(created) FROM created) SELECT * FROM created",
      [body.category,body.description,currency,amount,rate,amountUsd,user.id,body.account_name]
    );
    if(!rows[0]) return erpError(400,"EXPENSE_SAVE_FAILED","No se pudo registrar el gasto.");
    return erpJson({record:rows[0]},201);
  } catch(error) {
    if(error?.code==="23503") return erpError(400,"CASH_ACCOUNT_NOT_FOUND","La cuenta de caja o banco no está configurada.");
    console.error("[erp] Expense creation failed:",error?.message||"database error");
    return erpError(503,"EXPENSE_SAVE_FAILED","No se pudo registrar el gasto.");
  }
}

async function addInvoicePayment(sql, user, body) {
  const original = Number(body.original_amount), rate = Number(body.exchange_rate || 1), usd = Number(body.amount_usd);
  if (!body.invoice_id || !Number.isFinite(original) || original <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(usd) || usd <= 0 || !body.account_name) return erpError(400, "INVALID_PAYMENT", "Revisa factura, importe, tipo de cambio y cuenta.");
  const currency = body.currency === "NIO" ? "NIO" : "USD";
  const expected=currency==="NIO"?original/rate:original;
  if(Math.abs(expected-usd)>0.02)return erpError(400,"AMOUNT_CONVERSION_MISMATCH","El abono no coincide con el importe convertido a USD.");
  const account=await sql.query("SELECT id FROM cash_accounts WHERE name=$1 AND currency=$2 AND active=TRUE LIMIT 1",[body.account_name,currency]);
  if(!account[0])return erpError(400,"CASH_ACCOUNT_NOT_FOUND","La cuenta de cobro no existe o no coincide con la moneda.");
  try {
    const rows = await sql.query(
      "WITH target AS (SELECT id,invoice_number,total_usd,paid_usd FROM invoices WHERE id=$1::uuid FOR UPDATE), updated AS (UPDATE invoices i SET paid_usd=t.paid_usd+$2,status=CASE WHEN t.paid_usd+$2>=t.total_usd THEN 'Pagada' ELSE 'Abono parcial' END,updated_at=NOW() FROM target t WHERE i.id=t.id AND t.paid_usd+$2<=t.total_usd RETURNING i.*), payment AS (INSERT INTO invoice_payments(invoice_id,currency,original_amount,exchange_rate,amount_usd,account_name,payment_method,created_by) SELECT id,$3,$4,$5,$2,$6,$7,$8 FROM updated RETURNING id), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'income','Abono factura '||invoice_number,(SELECT id FROM cash_accounts WHERE name=$6 AND currency=$3 AND active=TRUE LIMIT 1),$3,$4,$5,$2,'invoice',id::text,$8 FROM updated RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $8,'payment','invoice',id::text,jsonb_build_object('amount_usd',$2,'currency',$3,'original_amount',$4) FROM updated) SELECT * FROM updated",
      [body.invoice_id,usd,currency,original,rate,body.account_name,body.payment_method || null,user.id]
    );
    if (!rows[0]) return erpError(409, "PAYMENT_EXCEEDS_BALANCE", "La factura no existe o el abono supera su saldo pendiente.");
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    console.error("[erp] Invoice payment failed:", error?.message || "database error");
    return erpError(503, "PAYMENT_FAILED", "No se pudo registrar el abono.");
  }
}

async function addPurchasePayment(sql, user, body) {
  const original = Number(body.original_amount), rate = Number(body.exchange_rate || 1), usd = Number(body.amount_usd);
  if (!body.purchase_id || !Number.isFinite(original) || original <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(usd) || usd <= 0 || !body.account_name) return erpError(400, "INVALID_PAYMENT", "Revisa compra, importe, tipo de cambio y cuenta.");
  const currency = body.currency === "NIO" ? "NIO" : "USD";
  const expected=currency==="NIO"?original/rate:original;
  if(Math.abs(expected-usd)>0.02)return erpError(400,"AMOUNT_CONVERSION_MISMATCH","El pago no coincide con el importe convertido a USD.");
  const account=await sql.query("SELECT id FROM cash_accounts WHERE name=$1 AND currency=$2 AND active=TRUE LIMIT 1",[body.account_name,currency]);
  if(!account[0])return erpError(400,"CASH_ACCOUNT_NOT_FOUND","La cuenta de pago no existe o no coincide con la moneda.");
  try {
    const rows = await sql.query(
      "WITH target AS (SELECT id,purchase_number,total_usd,paid_usd FROM purchases WHERE id=$1::uuid FOR UPDATE), updated AS (UPDATE purchases p SET paid_usd=t.paid_usd+$2,status=CASE WHEN t.paid_usd+$2>=t.total_usd THEN 'Pagado' ELSE 'Abono parcial' END,updated_at=NOW() FROM target t WHERE p.id=t.id AND t.paid_usd+$2<=t.total_usd RETURNING p.*), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'expense','Abono compra '||purchase_number||CASE WHEN COALESCE($7,'')='' THEN '' ELSE ' · '||$7 END,(SELECT id FROM cash_accounts WHERE name=$6 AND currency=$3 AND active=TRUE LIMIT 1),$3,$4,$5,$2,'purchase',id::text,$8 FROM updated RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $8,'payment','purchase',id::text,jsonb_build_object('amount_usd',$2,'currency',$3,'original_amount',$4) FROM updated) SELECT * FROM updated",
      [body.purchase_id,usd,currency,original,rate,body.account_name,body.payment_method || null,user.id]
    );
    if (!rows[0]) return erpError(409, "PAYMENT_EXCEEDS_BALANCE", "La compra no existe o el abono supera su saldo pendiente.");
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    console.error("[erp] Purchase payment failed:", error?.message || "database error");
    return erpError(503, "PAYMENT_FAILED", "No se pudo registrar el abono.");
  }
}

async function updateOrderStatus(sql, user, id, body) {
  const status = String(body.status || "");
  const allowed = ["Pendiente","En preparación","Listo para entrega","En tránsito","Completado","Cancelado"];
  if (!allowed.includes(status)) return erpError(400, "INVALID_ORDER_STATUS", "El estado del pedido no es válido.");

  // Order workflow statuses never mutate stock. Stock OUT is an atomic effect
  // of invoice creation, and reversals must use an explicit return flow.
  const rows = await sql.query(
    "WITH target AS (SELECT o.id,o.status AS old_status FROM orders o WHERE o.id=$1::uuid FOR UPDATE), " +
    "linked_invoice AS (SELECT EXISTS(SELECT 1 FROM invoices WHERE order_id=$1::uuid) AS is_invoiced), " +
    "changed AS (UPDATE orders o SET status=$2,updated_at=NOW() FROM target,linked_invoice " +
    "WHERE o.id=target.id " +
    "AND (target.old_status NOT IN ('Completado','Cancelado') OR target.old_status=$2) " +
    "AND NOT (linked_invoice.is_invoiced AND $2='Cancelado') RETURNING o.*), " +
    "logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) " +
    "SELECT $3,'status_change','order',id::text,jsonb_build_object('old_status',(SELECT old_status FROM target),'status',$2) FROM changed) " +
    "SELECT * FROM changed",
    [id,status,user.id]
  );
  if (!rows[0]) {
    const linkedInvoice = await sql.query("SELECT 1 FROM invoices WHERE order_id=$1::uuid LIMIT 1", [id]);
    if (linkedInvoice[0] && status === "Cancelado") {
      return erpError(409, "ORDER_ALREADY_INVOICED", "El pedido ya tiene una factura. Para evitar alterar el inventario, gestiona cualquier devolución desde el flujo de devoluciones.");
    }
    return erpError(409, "ORDER_STATUS_CONFLICT", "No se pudo cambiar el estado: el pedido no existe o ya está finalizado/cancelado.");
  }
  return erpJson({ record: rows[0] });
}

export function resolveRoutePermission(resource, method, id, parts, body) {
  const action = method === "GET" ? "view" :
    method === "POST" ? "create" :
    method === "PATCH" ? "edit" :
    method === "DELETE" ? "delete" : null;
  if (!action) return null;

  if (resource === "users") {
    if (method === "GET") return "users.accounts.view";
    if (method === "POST") return "users.accounts.create";
    if (method === "PATCH") {
      return String(body?.account_status || "").toLowerCase() === "disabled"
        ? "users.accounts.disable" : "users.accounts.edit";
    }
    return null;
  }
  if (resource === "roles") {
    return method === "GET" ? "users.roles.view" :
      method === "POST" ? "users.roles.create" :
      method === "PATCH" ? "users.roles.edit" : null;
  }
  if (resource === "permissions") return method === "GET" ? "users.roles.view" : null;
  if (resource === "audit") return method === "GET" ? "audit.history.view" : null;
  if (resource === "settings") {
    return method === "GET" ? "settings.general.view" : method === "PATCH" ? "settings.general.manage" : null;
  }
  if (resource === "orders") {
    if (method === "POST") return "orders.records.create";
    if (method === "PATCH" && String(body?.status || "").toLowerCase() === "cancelado") return "orders.records.cancel";
    return method === "GET" ? "orders.records.view" : method === "PATCH" ? "orders.records.edit" : null;
  }
  if (resource === "products") {
    if (id === "import" && method === "POST") return "products.catalog.create";
    if (method === "GET") return "products.catalog.view";
    if (method === "POST") return "products.catalog.create";
    if (method === "PATCH") return "products.catalog.edit";
    if (method === "DELETE") return "products.catalog.delete";
    return null;
  }
  if (resource === "inventory-movements") {
    if (method === "GET") return "inventory.stock.view";
    if (method !== "POST") return null;
    const movement = String(body?.movement_type || body?.type || body?.direction || "").toLowerCase();
    if (["salida", "out", "egreso"].includes(movement)) return "inventory.manual_out.create";
    if (["ajuste", "adjustment", "adjust"].includes(movement)) return "inventory.adjustments.adjust";
    if (["entrada", "in", "ingreso"].includes(movement)) return "inventory.receipts.receive";
    return null;
  }
  if (resource === "purchases") {
    return method === "GET" ? "purchases.receipts.view" : method === "POST" ? "purchases.receipts.receive" : null;
  }
  if (resource === "payroll-periods") {
    if (parts[4] === "status" && method === "PATCH") return "hr.payroll.approve";
    return method === "GET" ? "hr.payroll.view" : null;
  }
  if (resource === "hr-payroll-items") return method === "POST" ? "hr.payroll.create" : method === "GET" ? "hr.payroll.view" : null;
  if (resource === "hr-leave-requests") {
    if (method === "PATCH") {
      const status = String(body?.status || "").toLowerCase();
      if (/(aprob|approved)/.test(status)) return "hr.leave.approve";
      if (/(rechaz|rejected|denied)/.test(status)) return "hr.leave.reject";
      return null;
    }
    return method === "GET" ? "hr.leave.view" : method === "POST" ? "hr.leave.create" : null;
  }
  if (resource === "cash-accounts" || resource === "cash_entries") {
    return method === "GET" ? "cash.entries.view" : method === "POST" ? "cash.entries.create" : null;
  }
  if (resource === "expenses") {
    return method === "GET" ? "expenses.records.view" : method === "POST" ? "expenses.records.create" : null;
  }
  if (resource === "invoices") {
    if (method === "POST") return "billing.invoices.create";
    return method === "GET" ? "billing.invoices.view" : null;
  }
  if (resource === "invoice-payments") return method === "POST" ? "billing.payments.create" : null;
  if (resource === "purchase-payments") return method === "POST" ? "payables.payments.create" : null;
  if (resource === "assets") {
    return method === "GET" ? "products.catalog.view" : "products.catalog.edit";
  }
  if (resource === "dgi-support-documents") {
    if (method === "GET") return "dgi.documents.view";
    return method === "POST" ? "dgi.documents.manage" : null;
  }

  const resourcePolicies = {
    products: "products.catalog",
    customers: "customers.records",
    suppliers: "suppliers.records",
    orders: "orders.records",
    invoices: "billing.invoices",
    expenses: "expenses.records",
    cash_accounts: "cash.entries",
    cash_entries: "cash.entries",
    employees: "hr.employees",
    hr_attendance: "hr.attendance",
    hr_leave_requests: "hr.leave",
    hr_payroll_periods: "hr.payroll",
    hr_payroll_items: "hr.payroll",
    dgi_support_documents: "dgi.documents",
    inventory_movements: "inventory.stock"
  };
  const normalized = resource.replace(/-/g, "_");
  const section = resourcePolicies[normalized];
  if (!section) return null;
  if (method === "GET") return section + ".view";
  if (method === "POST") return section + ".create";
  if (method === "PATCH") return section + ".edit";
  if (method === "DELETE") return section + ".delete";
  return null;
}

export async function handleERPRequest(request, env, user, sql) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[2] || "";
  const id = parts[3] || "";
  const permissionContext = await loadUserPermissions(sql, user);
  const contentType = request.headers.get("content-type") || "";
  let requestBody = null;
  if (request.method !== "GET" && contentType.includes("application/json")) {
    try { requestBody = await request.clone().json(); } catch { requestBody = null; }
  }

  const permissionKey = resolveRoutePermission(resource, request.method, id, parts, requestBody);
  if (["users","roles","permissions","devices","audit"].includes(resource) && user.role !== "owner") {
    return erpError(403, "OWNER_REQUIRED", "Solo el propietario puede administrar cuentas, permisos, dispositivos y auditoría.");
  }
  if (resource === "bootstrap" && request.method === "GET") {
    if (!hasPermission(permissionContext, "dashboard.view") && !hasAnyModuleAccess(permissionContext)) {
      return erpError(403, "FORBIDDEN", "Tu cuenta no tiene módulos habilitados.");
    }
  } else if (!permissionKey) {
    return erpError(403, "PERMISSION_POLICY_MISSING", "La ruta todavía no tiene una política de acceso definida.");
  } else if (!hasPermission(permissionContext, permissionKey)) {
    return erpError(403, "FORBIDDEN", "No tienes permiso para realizar esta operación.");
  }
  user._permissionValidated = true;
  if (resource === "bootstrap" && request.method === "GET") {
    try {
      const data = await readBootstrap(sql, user, permissionContext);
      return erpJson({ data });
    } catch (error) {
      console.error("[erp] Bootstrap failed:", error?.message || "database error");
      return erpError(503, "BOOTSTRAP_FAILED", "No se pudieron cargar los datos operativos desde Neon.");
    }
  }
  if (resource === "users" && request.method === "GET") {
    try {
      const [users, pendingIdentities] = await Promise.all([
        sql.query(
          "SELECT u.id,u.auth_user_id,u.email,u.display_name,u.position_title,u.role,u.role_template_key," +
          "u.account_status,u.active,u.must_change_password,u.created_at,u.updated_at,r.name AS role_template_name " +
          "FROM app_users u LEFT JOIN erp_roles r ON r.role_key=u.role_template_key ORDER BY u.created_at DESC LIMIT 500"
        ),
        sql.query(
          'SELECT au.id AS auth_user_id,au.email,au.name AS display_name,au."emailVerified" AS email_verified,au."createdAt" AS created_at ' +
          'FROM neon_auth."user" au LEFT JOIN app_users u ON u.auth_user_id=au.id ' +
          'WHERE u.id IS NULL ORDER BY au."createdAt" DESC LIMIT 200'
        )
      ]);
      return erpJson({ users, pendingIdentities });
    } catch (error) {
      console.error("[erp] User directory failed:", error?.message || "database error");
      return erpError(503, "USER_DIRECTORY_FAILED", "No se pudo consultar el directorio de cuentas.");
    }
  }

  if (resource === "users" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    const email = String(body.email || "").trim().toLowerCase();
    const displayName = String(body.display_name || "").trim();
    const positionTitle = String(body.position_title || "").trim();
    const roleTemplateKey = String(body.role_template_key || "viewer").trim();
    const mustChangePassword = body.must_change_password !== false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180 || !displayName || displayName.length > 180 || positionTitle.length > 120) {
      return erpError(400, "INVALID_USER_PROFILE", "Indica un correo válido, nombre completo y cargo de hasta 120 caracteres.");
    }
    if (roleTemplateKey === "owner") {
      return erpError(403, "OWNER_ROLE_PROTECTED", "La plantilla owner no se puede asignar desde el panel.");
    }
    try {
      const roleRows = await sql.query("SELECT role_key FROM erp_roles WHERE role_key=$1 LIMIT 1", [roleTemplateKey]);
      if (!roleRows[0]) return erpError(400, "INVALID_ROLE_TEMPLATE", "La plantilla de permisos no existe.");
      const identityRows = await sql.query(
        'SELECT id,email,name,"emailVerified" AS email_verified FROM neon_auth."user" WHERE LOWER(email)=LOWER($1) LIMIT 1',
        [email]
      );
      const identity = identityRows[0];
      if (!identity) return erpError(404, "AUTH_IDENTITY_NOT_FOUND", "La persona debe tener una identidad registrada en Neon Auth antes de poder autorizarla.");
      const accountStatus = identity.email_verified === true ? "invited" : "registered";
      const created = await sql.query(
        "INSERT INTO app_users(auth_user_id,email,display_name,position_title,role,role_template_key,account_status,active,must_change_password) " +
        "VALUES($1,$2,$3,$4,'viewer',$5,$6,FALSE,$7) " +
        "RETURNING id,auth_user_id,email,display_name,position_title,role,role_template_key,account_status,active,must_change_password,created_at",
        [identity.id,email,displayName,positionTitle,roleTemplateKey,accountStatus,mustChangePassword]
      );
      await auditQuery(sql,user.id,"provision","app_user",created[0].id,{email,role_template_key:roleTemplateKey,account_status:accountStatus});
      return erpJson({ user: created[0] }, 201);
    } catch (error) {
      if (error?.code === "23505") return erpError(409, "USER_ALREADY_PROVISIONED", "Ya existe una cuenta ERP para ese correo.");
      console.error("[erp] User provisioning failed:", error?.message || "database error");
      return erpError(503, "USER_PROVISION_FAILED", "No se pudo preparar la cuenta ERP.");
    }
  }

  if (resource === "users" && request.method === "PATCH" && id) {
    let body;
    try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    const existing = await sql.query("SELECT id,role,role_template_key FROM app_users WHERE id=$1::uuid LIMIT 1", [id]);
    if (!existing[0]) return erpError(404, "USER_NOT_FOUND", "La cuenta ERP solicitada no existe.");
    if (existing[0].role === "owner") return erpError(403, "OWNER_ACCOUNT_PROTECTED", "La cuenta propietaria no se puede editar, desactivar ni degradar.");
    const accountStatus = body.account_status == null ? null : String(body.account_status);
    if (accountStatus && !["invited","registered","active","rejected","disabled"].includes(accountStatus)) {
      return erpError(400, "INVALID_ACCOUNT_STATUS", "El estado de la cuenta no es válido.");
    }
    const roleTemplateKey = body.role_template_key == null ? null : String(body.role_template_key);
    if (roleTemplateKey === "owner") return erpError(403, "OWNER_ROLE_PROTECTED", "La plantilla owner no se puede asignar desde el panel.");
    if (roleTemplateKey) {
      const roleRows = await sql.query("SELECT role_key FROM erp_roles WHERE role_key=$1 LIMIT 1", [roleTemplateKey]);
      if (!roleRows[0]) return erpError(400, "INVALID_ROLE_TEMPLATE", "La plantilla de permisos no existe.");
    }
    const positionTitle = body.position_title == null ? null : String(body.position_title).trim();
    if (positionTitle != null && positionTitle.length > 120) return erpError(400, "INVALID_POSITION_TITLE", "El cargo no puede superar 120 caracteres.");
    if (body.must_change_password != null && typeof body.must_change_password !== "boolean") {
      return erpError(400, "INVALID_PASSWORD_POLICY", "La opción de cambio de contraseña debe ser booleana.");
    }
    const overrides = body.overrides;
    if (overrides != null && !Array.isArray(overrides)) return erpError(400, "INVALID_PERMISSION_OVERRIDES", "Los permisos individuales deben enviarse como una lista.");
    if (Array.isArray(overrides)) {
      const seen = new Set();
      for (const item of overrides) {
        if (!item || typeof item.permission_key !== "string" || typeof item.allowed !== "boolean" || seen.has(item.permission_key)) {
          return erpError(400, "INVALID_PERMISSION_OVERRIDES", "Cada permiso individual debe tener una clave única y un valor booleano.");
        }
        seen.add(item.permission_key);
      }
      const keys = [...seen];
      if (keys.length) {
        const valid = await sql.query("SELECT permission_key FROM permission_catalog WHERE permission_key = ANY($1::text[])", [keys]);
        if (valid.length !== keys.length) return erpError(400, "UNKNOWN_PERMISSION", "Uno o más permisos no existen en el catálogo.");
      }
    }
    try {
      const updated = await sql.query(
        "UPDATE app_users SET " +
        "role_template_key=COALESCE($2,role_template_key),position_title=COALESCE($3,position_title)," +
        "account_status=COALESCE($4,account_status),active=CASE WHEN $4 IS NULL THEN active ELSE ($4='active') END," +
        "must_change_password=COALESCE($5,must_change_password),updated_at=NOW() " +
        "WHERE id=$1::uuid AND role <> 'owner' " +
        "RETURNING id,email,display_name,position_title,role,role_template_key,account_status,active,must_change_password",
        [id,roleTemplateKey,positionTitle,accountStatus,body.must_change_password ?? null]
      );
      if (!updated[0]) return erpError(404, "USER_NOT_FOUND", "La cuenta ERP solicitada no existe.");
      if (Array.isArray(overrides)) {
        const payload = JSON.stringify(overrides);
        await sql.transaction((tx) => [
          tx`DELETE FROM user_permission_overrides WHERE user_id=${id}::uuid`,
          tx`INSERT INTO user_permission_overrides(user_id,permission_key,allowed,updated_by,updated_at)
             SELECT ${id}::uuid,x.permission_key,x.allowed,${user.id},NOW()
             FROM jsonb_to_recordset(${payload}::jsonb) AS x(permission_key text,allowed boolean)`
        ]);
      }
      await auditQuery(sql,user.id,"update","app_user",id,{
        role_template_key:roleTemplateKey,position_title:positionTitle,account_status:accountStatus,
        must_change_password:body.must_change_password,overrides_updated:Array.isArray(overrides)
      });
      return erpJson({ user: updated[0] });
    } catch (error) {
      console.error("[erp] User update failed:", error?.message || "database error");
      return erpError(503, "USER_UPDATE_FAILED", "No se pudo actualizar la cuenta ERP.");
    }
  }

  if (resource === "roles" && request.method === "GET") {
    try {
      const [roles, permissions, grants] = await Promise.all([
        sql.query("SELECT role_key,name,description,is_system,created_at,updated_at FROM erp_roles ORDER BY is_system DESC,name ASC"),
        sql.query("SELECT permission_key,label,module_key,parent_key,permission_type,sort_order FROM permission_catalog ORDER BY module_key,sort_order,permission_key"),
        sql.query("SELECT role_key,permission_key,allowed FROM role_template_permissions ORDER BY role_key,permission_key")
      ]);
      return erpJson({ roles, permissions, grants });
    } catch (error) {
      console.error("[erp] Role catalog failed:", error?.message || "database error");
      return erpError(503, "ROLE_CATALOG_FAILED", "No se pudo consultar el catálogo de roles y permisos.");
    }
  }

  if (resource === "roles" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    const roleKey = String(body.role_key || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(roleKey) || ["owner","admin","hr","finance","inventory","sales","viewer"].includes(roleKey) ||
        !name || name.length > 80 || description.length > 240) {
      return erpError(400, "INVALID_ROLE", "Indica una clave nueva, nombre y descripción válidos. La plantilla owner está protegida.");
    }
    try {
      const rows = await sql.query("INSERT INTO erp_roles(role_key,name,description,is_system,created_by) VALUES($1,$2,$3,FALSE,$4) RETURNING role_key,name,description,is_system,created_at", [roleKey,name,description,user.id]);
      await auditQuery(sql,user.id,"create","erp_role",roleKey,{name,description});
      return erpJson({ role: rows[0] }, 201);
    } catch (error) {
      if (error?.code === "23505") return erpError(409, "ROLE_EXISTS", "Ya existe una plantilla con esa clave.");
      console.error("[erp] Role creation failed:", error?.message || "database error");
      return erpError(503, "ROLE_CREATE_FAILED", "No se pudo crear la plantilla.");
    }
  }

  if (resource === "roles" && request.method === "PATCH" && id) {
    let body;
    try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    if (id === "owner") return erpError(403, "OWNER_ROLE_PROTECTED", "La plantilla owner está protegida y no se puede modificar.");
    const name = body.name == null ? null : String(body.name).trim();
    const description = body.description == null ? null : String(body.description).trim();
    if ((name != null && (!name || name.length > 80)) || (description != null && description.length > 240)) {
      return erpError(400, "INVALID_ROLE", "El nombre o la descripción de la plantilla no son válidos.");
    }
    if (body.permissions != null && !Array.isArray(body.permissions)) return erpError(400, "INVALID_ROLE_PERMISSIONS", "Los permisos de la plantilla deben enviarse como una lista.");
    const roleRows = await sql.query("SELECT role_key FROM erp_roles WHERE role_key=$1 LIMIT 1", [id]);
    if (!roleRows[0]) return erpError(404, "ROLE_NOT_FOUND", "La plantilla solicitada no existe.");
    if (Array.isArray(body.permissions)) {
      const seen = new Set();
      for (const item of body.permissions) {
        if (!item || typeof item.permission_key !== "string" || typeof item.allowed !== "boolean" || seen.has(item.permission_key)) {
          return erpError(400, "INVALID_ROLE_PERMISSIONS", "Cada permiso debe tener una clave única y un valor booleano.");
        }
        seen.add(item.permission_key);
      }
      const keys = [...seen];
      if (keys.length) {
        const valid = await sql.query("SELECT permission_key FROM permission_catalog WHERE permission_key=ANY($1::text[])", [keys]);
        if (valid.length !== keys.length) return erpError(400, "UNKNOWN_PERMISSION", "Uno o más permisos no existen en el catálogo.");
      }
    }
    try {
      const updated = await sql.query(
        "UPDATE erp_roles SET name=COALESCE($2,name),description=COALESCE($3,description),updated_at=NOW() WHERE role_key=$1 RETURNING role_key,name,description,is_system",
        [id,name,description]
      );
      if (Array.isArray(body.permissions)) {
        await sql.transaction((tx) => [
          tx`DELETE FROM role_template_permissions WHERE role_key=${id}`,
          tx`INSERT INTO role_template_permissions(role_key,permission_key,allowed)
             SELECT ${id},x.permission_key,x.allowed
             FROM jsonb_to_recordset(${JSON.stringify(body.permissions)}::jsonb) AS x(permission_key text,allowed boolean)`
        ]);
      }
      await auditQuery(sql,user.id,"update","erp_role",id,{name,description,permissions_updated:Array.isArray(body.permissions)});
      return erpJson({ role: updated[0] });
    } catch (error) {
      console.error("[erp] Role update failed:", error?.message || "database error");
      return erpError(503, "ROLE_UPDATE_FAILED", "No se pudo actualizar la plantilla.");
    }
  }

  if (resource === "audit" && request.method === "GET") {
    try {
      const rows = await sql.query(
        "SELECT a.id,a.actor_user_id,u.display_name AS actor_name,a.action,a.entity_type,a.entity_id,a.details,a.created_at " +
        "FROM audit_log a LEFT JOIN app_users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 500"
      );
      return erpJson({ records: rows });
    } catch (error) {
      console.error("[erp] Audit history failed:", error?.message || "database error");
      return erpError(503, "AUDIT_READ_FAILED", "No se pudo consultar el historial de auditoría.");
    }
  }

  if (resource === "settings" && request.method === "GET") {
    const rows = await sql.query("SELECT setting_key, setting_value FROM app_settings ORDER BY setting_key");
    return erpJson({ records: rows });
  }
  if (resource === "settings" && request.method === "PATCH") {
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    const key = String(body.setting_key || "");
    if (!["default_exchange_rate","base_currency","payroll_currency","dgi_compliance"].includes(key)) return erpError(400, "INVALID_SETTING", "La configuración solicitada no está permitida.");
    const value = body.setting_value;
    if (key === "default_exchange_rate" && (!Number.isFinite(Number(value?.value)) || Number(value.value) <= 0 || Number(value.value) > 100000)) return erpError(400, "INVALID_EXCHANGE_RATE", "El tipo de cambio debe ser mayor que cero.");
    if (key === "dgi_compliance") {
      const allowed = new Set(["taxpayer_name","ruc","business_address","regime_status","regime_confirmation_reference","quota_fixed_amount_nio","certificate_available","certificate_displayed","computerized_invoicing_status","dgi_confirmation_date","computerized_invoicing_authorization_number","computerized_invoicing_confirmation_reference"]);
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((field) => !allowed.has(field))) {
        return erpError(400, "INVALID_DGI_SETTINGS", "La configuración tributaria contiene campos no permitidos.");
      }
      if (!["not_confirmed","cuota_fija","general"].includes(String(value.regime_status || "not_confirmed"))) {
        return erpError(400, "INVALID_DGI_REGIME", "Selecciona un régimen tributario válido.");
      }
      if (!["not_confirmed","pending_authorization","authorized","not_applicable_confirmed"].includes(String(value.computerized_invoicing_status || "not_confirmed"))) {
        return erpError(400, "INVALID_DGI_INVOICING_STATUS", "Selecciona un estado de autorización de facturación válido.");
      }
      const fee = Number(value.quota_fixed_amount_nio || 0);
      if (!Number.isFinite(fee) || fee < 0 || fee > 10000000) return erpError(400, "INVALID_DGI_FEE", "La cuota mensual debe ser un importe válido en córdobas.");
      if (typeof value.certificate_available !== "boolean" || typeof value.certificate_displayed !== "boolean") {
        return erpError(400, "INVALID_DGI_CERTIFICATE", "Indica si el certificado está disponible y exhibido.");
      }
      for (const field of ["taxpayer_name","ruc","business_address","dgi_confirmation_date","regime_confirmation_reference","computerized_invoicing_authorization_number","computerized_invoicing_confirmation_reference"]) {
        if (value[field] != null && (typeof value[field] !== "string" || value[field].length > 180)) {
          return erpError(400, "INVALID_DGI_FIELD", "Uno de los datos de identificación o respaldo tributario no es válido.");
        }
      }
      const confirmationDate = String(value.dgi_confirmation_date || "").trim();
      const ruc = String(value.ruc || "").trim();
      const regimeReference = String(value.regime_confirmation_reference || "").trim();
      const authorizationNumber = String(value.computerized_invoicing_authorization_number || "").trim();
      const invoicingConfirmationReference = String(value.computerized_invoicing_confirmation_reference || "").trim();
      if (confirmationDate && !/^\d{4}-\d{2}-\d{2}$/.test(confirmationDate)) {
        return erpError(400, "INVALID_DGI_CONFIRMATION_DATE", "La fecha de confirmación DGI debe tener formato AAAA-MM-DD.");
      }
      if (value.regime_status !== "not_confirmed" && (!ruc || !confirmationDate || !regimeReference)) {
        return erpError(400, "DGI_REGIME_CONFIRMATION_REQUIRED", "Antes de marcar un régimen como confirmado, registra el RUC, la fecha y la referencia de la constancia o respuesta de la DGI.");
      }
      if (value.computerized_invoicing_status === "authorized" && (!ruc || !confirmationDate || !authorizationNumber)) {
        return erpError(400, "DGI_INVOICING_AUTHORIZATION_REQUIRED", "Para marcar la facturación computarizada como autorizada, registra el RUC, la fecha y el número de autorización otorgado por la DGI.");
      }
      if (value.computerized_invoicing_status === "not_applicable_confirmed" && (!ruc || !confirmationDate || !invoicingConfirmationReference)) {
        return erpError(400, "DGI_INVOICING_CONFIRMATION_REQUIRED", "Para indicar que la autorización no aplica, registra el RUC, la fecha y la referencia de la respuesta escrita de la DGI.");
      }
    }
    const rows = await sql.query("INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES($1,$2::jsonb,$3,NOW()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING setting_key,setting_value", [key,JSON.stringify(value),user.id]);
    await auditQuery(sql,user.id,"update","app_setting",key,value);
    return erpJson({ record: rows[0] });
  }
  if (resource === "orders" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.orders.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar pedidos.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createOrder(sql, user, body);
  }
  if (resource === "products" && id === "import" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.products.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para importar productos.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return importProducts(sql, user, body);
  }
  if (resource === "products" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.products.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar productos.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    try { return await createProduct(sql,user,body); } catch(error) {
      if (error?.code === "23505") return erpError(409, "DUPLICATE_SKU", "El SKU ya existe.");
      console.error("[erp] Product creation failed:",error?.message||"database error");
      return erpError(503,"PRODUCT_SAVE_FAILED","No se pudo guardar el producto.");
    }
  }
  if (resource === "inventory-movements" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.inventory_movements.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para modificar existencias.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createInventoryMovement(sql, user, body);
  }
  if (resource === "purchases" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.purchases.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar compras.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createPurchase(sql,user,body);
  }
  if (resource === "payroll-periods" && parts[4] === "status" && request.method === "PATCH") {
    if (!canAccess(user, RESOURCE_DEFS.hr_payroll_periods.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para administrar nómina.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return changePayrollPeriodStatus(sql,user,id,body);
  }
  if (resource === "assets") return handleProductAsset(request,env,user,sql);
  if (resource === "dgi-support-documents" && request.method === "POST" && !id) {
    return createDgiSupportDocument(request,env,user,sql);
  }
  if (resource === "dgi-support-documents" && id && parts[4] === "file" && request.method === "GET") {
    return getDgiSupportDocumentFile(request,env,user,sql,id);
  }
  if (resource === "hr-payroll-items" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.hr_payroll_items.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para administrar nómina.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createPayrollItem(sql,user,body);
  }
  if (resource === "hr-leave-requests" && request.method === "PATCH" && id) {
    if (!canAccess(user, RESOURCE_DEFS.hr_leave_requests.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para revisar solicitudes.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return reviewLeaveRequest(sql,user,id,body);
  }
  if (resource === "cash_entries" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.cash_entries.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar movimientos de caja.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createCashEntry(sql,user,body);
  }
  if (resource === "cash-accounts" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.cash_accounts.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para crear cuentas.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createCashAccount(sql,user,body);
  }
  if (resource === "expenses" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.expenses.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar gastos.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createExpense(sql,user,body);
  }
  if (resource === "invoices" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.invoices.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para facturar.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createInvoice(sql,user,body);
  }
  if (resource === "invoice-payments" && request.method === "POST") {
    if (!canAccess(user, ["owner","admin","finance","sales"])) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar cobros.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return addInvoicePayment(sql,user,body);
  }
  if (resource === "purchase-payments" && request.method === "POST") {
    if (!canAccess(user, ["owner","admin","finance","inventory"])) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar pagos a proveedores.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return addPurchasePayment(sql,user,body);
  }
  const normalizedResource = resource.replace(/-/g, "_");
  const def = RESOURCE_DEFS[normalizedResource];
  if (!def) return erpError(404, "RESOURCE_NOT_FOUND", "El módulo solicitado no existe.");
  if (normalizedResource === "dgi_support_documents" && request.method !== "GET") return erpError(405, "DGI_DOCUMENT_WRITE_REQUIRES_UPLOAD", "Los respaldos DGI solo se registran mediante el flujo seguro de carga de archivos.");
  if (!canAccess(user, def.roles)) return erpError(403, "FORBIDDEN", "Tu rol no permite operar este módulo.");
  if (request.method === "GET" && !id) {
    try {
      const rows = await sql.query(`SELECT * FROM "${def.table}" ORDER BY ${def.order} LIMIT 5000`);
      return erpJson({ records: rows });
    } catch (error) {
      console.error("[erp] List failed:", resource, error?.message || "database error");
      return erpError(503, "LIST_FAILED", "No se pudieron consultar los registros.");
    }
  }
  if (request.method === "POST" && !id) {
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    if (resource === "orders" || resource === "purchases" || resource === "invoices" || resource === "inventory_movements") return erpError(400, "USE_OPERATION_ENDPOINT", "Utiliza el flujo de operación específico para este registro.");
    return createGeneric(sql, user, normalizedResource, def, body);
  }
  if (request.method === "PATCH" && id) {
    const transactionalResources = new Set(["inventory_movements","cash_entries","invoices","purchases","expenses","cash_accounts","hr_payroll_items","hr_payroll_periods"]);
    if (transactionalResources.has(normalizedResource)) {
      return erpError(405, "IMMUTABLE_TRANSACTION", "Este registro forma parte de un historial financiero, de inventario o de nómina. Utiliza el flujo específico de anulación, devolución o pago.");
    }
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    if (normalizedResource === "orders" && Object.prototype.hasOwnProperty.call(body,"status")) {
      if (!canAccess(user, RESOURCE_DEFS.orders.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para cambiar pedidos.");
      return updateOrderStatus(sql,user,id,body);
    }
    if (normalizedResource === "orders") {
      return erpError(405, "ORDER_FIELDS_LOCKED", "Los datos y renglones de un pedido se conservan como fotografía histórica. Solo se puede cambiar su estado mediante el flujo de pedidos.");
    }
    if (normalizedResource === "hr_leave_requests" && Object.prototype.hasOwnProperty.call(body,"status")) {
      if (!canAccess(user, RESOURCE_DEFS.hr_leave_requests.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para revisar solicitudes.");
      return reviewLeaveRequest(sql,user,id,body);
    }
    return updateGeneric(sql, user, normalizedResource, def, id, body);
  }
  if (request.method === "DELETE" && id) return softDelete(sql, user, normalizedResource, def, id);
  return erpError(405, "METHOD_NOT_ALLOWED", "El método HTTP no está disponible para este recurso.");
}
