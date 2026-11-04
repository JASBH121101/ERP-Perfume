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
  return Boolean(user && roles.includes(user.role));
}

async function auditQuery(sql, actorId, action, entity, entityId, details = {}) {
  await sql.query(
    "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [actorId, action, entity, entityId == null ? null : String(entityId), JSON.stringify(details)]
  );
}

async function readBootstrap(sql, user) {
  const isOwner = ["owner", "admin"].includes(user.role);
  const canInventory = isOwner || user.role === "inventory";
  const canSales = isOwner || user.role === "sales";
  const canFinance = isOwner || user.role === "finance";
  const canHR = isOwner || user.role === "hr";
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

  const result = { settings };
  if (isOwner || canInventory) {
    result.products = products;
    result.inventory_movements = movements;
    result.suppliers = suppliers;
    result.purchases = purchases;
    result.purchase_items = purchaseItems;
  }
  if (isOwner || canSales) {
    result.customers = customers;
    result.orders = orders;
    result.order_items = orderItems;
    result.invoices = invoices;
    result.invoice_items = invoiceItems;
    result.invoice_payments = invoicePayments;
  }
  if (isOwner || canFinance) {
    result.expenses = expenses;
    result.cash_accounts = cashAccounts;
    result.cash_entries = cashEntries;
    result.purchases = purchases;
    result.purchase_items = purchaseItems;
    result.invoices = invoices;
    result.invoice_items = invoiceItems;
    result.invoice_payments = invoicePayments;
  }
  if (isOwner || canHR) {
    result.employees = employees;
    result.hr_attendance = attendance;
    result.hr_leave_requests = leaveRequests;
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
  if (["employees","hr_attendance","hr_leave_requests","hr_payroll_periods","inventory_movements","orders","purchases","invoices","expenses","cash_entries"].includes(def.table)) {
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
  if (!body.customer_name || !items.length) return erpError(400, "INVALID_ORDER", "El pedido requiere cliente y al menos un producto.");
  if (items.some((item) => !item.product_name || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !Number.isFinite(Number(item.unit_price_usd)) || Number(item.unit_price_usd) < 0)) {
    return erpError(400, "INVALID_ORDER_ITEMS", "Revisa los productos, cantidades y precios del pedido.");
  }
  const orderNumber = String(body.order_number || "").trim();
  if (!orderNumber) return erpError(400, "ORDER_NUMBER_REQUIRED", "El número de pedido es obligatorio.");
  const payload = {
    order_number: orderNumber, customer_id: body.customer_id || null, customer_name: String(body.customer_name).trim(),
    phone: body.phone || null, status: body.status || "Pendiente", payment_status: body.payment_status || "Pendiente",
    payment_method: body.payment_method || null, delivery_mode: body.delivery_mode || null,
    currency: body.currency === "NIO" ? "NIO" : "USD", original_amount: Number(body.original_amount || 0),
    exchange_rate: Number(body.exchange_rate || 1), total_usd: Number(body.total_usd || 0),
    discount_usd: Number(body.discount_usd || 0), delivery_fee_usd: Number(body.delivery_fee_usd || 0), notes: body.notes || null
  };
  try {
    const rows = await sql.query(
      "WITH created AS (INSERT INTO orders (order_number,customer_id,customer_name,phone,status,payment_status,payment_method,delivery_mode,currency,original_amount,exchange_rate,total_usd,discount_usd,delivery_fee_usd,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *), item_rows AS (INSERT INTO order_items (order_id,product_id,product_name,sku_snapshot,quantity,unit_price_usd,line_total_usd) SELECT created.id, i.product_id, i.product_name, i.sku_snapshot, i.quantity, i.unit_price_usd, i.quantity * i.unit_price_usd FROM created CROSS JOIN LATERAL jsonb_to_recordset($17::jsonb) AS i(product_id uuid, product_name text, sku_snapshot text, quantity integer, unit_price_usd numeric) RETURNING id), logged AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) SELECT $16,'create','order',created.id::text,to_jsonb(created) FROM created) SELECT * FROM created",
      [payload.order_number,payload.customer_id,payload.customer_name,payload.phone,payload.status,payload.payment_status,payload.payment_method,payload.delivery_mode,payload.currency,payload.original_amount,payload.exchange_rate,payload.total_usd,payload.discount_usd,payload.delivery_fee_usd,payload.notes,user.id,JSON.stringify(items)]
    );
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_ORDER", "El número de pedido ya existe.");
    if (error?.code === "23503") return erpError(400, "PRODUCT_NOT_FOUND", "Uno de los productos del pedido no existe.");
    console.error("[erp] Order creation failed:", error?.message || "database error");
    return erpError(503, "ORDER_SAVE_FAILED", "No se pudo guardar el pedido.");
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
  const result = await sql.query(
    "WITH created AS (INSERT INTO products (sku,name,brand,category,concentration,gender,family,size_ml,presentation,purchase_cost_usd,additional_cost_usd,unit_cost_usd,price_usd,stock,min_stock,location,active,barcode,description,supplier_name,wholesale_price_usd,tone,notes,images) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb) RETURNING *), movement AS (INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,created_by) SELECT id,'Entrada',$14,$14,0,$14,'Existencias iniciales','product',$25 FROM created WHERE $14>0 RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $25,'create','product',id::text,to_jsonb(created) FROM created) SELECT * FROM created",
    [sku,name,values.brand||null,values.category||null,values.concentration||null,values.gender||null,values.family||null,values.size_ml||null,values.presentation||null,values.purchase_cost_usd||0,values.additional_cost_usd||0,values.unit_cost_usd||0,values.price_usd||0,stock,values.min_stock||0,values.location||null,values.active!==false,values.barcode||null,values.description||null,values.supplier_name||null,values.wholesale_price_usd||null,values.tone||null,values.notes||null,JSON.stringify(values.images||[]),user.id]
  );
  return erpJson({record:result[0]},201);
}

async function createInventoryMovement(sql, user, body) {
  const type = String(body.movement_type || "");
  const quantity = Number(body.quantity);
  if (!body.product_id || !["Entrada","Salida","Ajuste","Devolucion","Reversion"].includes(type) || !Number.isInteger(quantity) || quantity < 0 || (type !== "Ajuste" && quantity < 1)) {
    return erpError(400, "INVALID_MOVEMENT", "Selecciona un tipo de movimiento y una cantidad válida.");
  }
  const rows = await sql.query(
    "WITH target AS (SELECT id,stock FROM products WHERE id=$1::uuid AND active=TRUE FOR UPDATE), calc AS (SELECT id,stock AS previous_stock, CASE WHEN $2='Salida' THEN -$3 WHEN $2='Ajuste' THEN $3-stock ELSE $3 END AS delta FROM target), updated AS (UPDATE products p SET stock=c.previous_stock+c.delta, updated_at=NOW() FROM calc c WHERE p.id=c.id AND c.previous_stock+c.delta>=0 AND c.delta<>0 RETURNING p.id,p.name,p.sku,c.previous_stock,c.delta,p.stock AS new_stock), movement AS (INSERT INTO inventory_movements (product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) SELECT id,$2,ABS(delta),delta,previous_stock,new_stock,$4,$5,$6,$7 FROM updated RETURNING *), logged AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) SELECT $7,'inventory_movement','product',updated.id::text,jsonb_build_object('movement',movement.movement_type,'delta',movement.quantity_delta,'new_stock',movement.new_stock) FROM movement JOIN updated ON updated.id=movement.product_id) SELECT movement.*, updated.name AS product_name, updated.sku FROM movement JOIN updated ON updated.id=movement.product_id",
    [body.product_id,type,quantity,body.note || null,body.reference_type || null,body.reference_id || null,user.id]
  );
  if (!rows[0]) return erpError(409, "STOCK_CONFLICT", "No se pudo aplicar el movimiento: el producto no existe, está inactivo, el ajuste no cambia el stock o la salida supera las existencias.");
  return erpJson({ record: rows[0] }, 201);
}


async function createPurchase(sql, user, body) {
  const quantity = Number(body.quantity), unitCostUsd = Number(body.unit_cost_usd);
  const rate = Number(body.exchange_rate || 1), paidUsd = Number(body.paid_usd || 0);
  if (!body.supplier_id || !body.product_id || !body.supplier_name || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitCostUsd) || unitCostUsd <= 0 || !Number.isFinite(rate) || rate <= 0) {
    return erpError(400, "INVALID_PURCHASE", "Revisa proveedor, producto, cantidad, costo y tipo de cambio.");
  }
  const totalUsd = Math.round(unitCostUsd * quantity * 100) / 100;
  if (!Number.isFinite(paidUsd) || paidUsd < 0 || paidUsd > totalUsd) return erpError(400, "INVALID_INITIAL_PAYMENT", "El pago inicial debe estar entre cero y el total de la compra.");
  const purchaseNumber = String(body.purchase_number || "").trim();
  if (!purchaseNumber) return erpError(400, "PURCHASE_NUMBER_REQUIRED", "El número de compra es obligatorio.");
  const currency = body.currency === "NIO" ? "NIO" : "USD";
  const originalAmount = Number(body.initial_payment_amount || 0);
  if (paidUsd > 0 && (!Number.isFinite(originalAmount) || originalAmount <= 0 || !body.account_name)) return erpError(400, "INVALID_INITIAL_PAYMENT", "El pago inicial requiere importe, moneda y cuenta.");
  try {
    const rows = await sql.query(
      "WITH input AS (SELECT $1::text AS purchase_number,$2::uuid AS supplier_id,$3::text AS supplier_name,$4::text AS currency,$5::numeric AS rate,$6::numeric AS total_usd,$7::numeric AS paid_usd,$8::text AS notes,$9::uuid AS product_id,$10::int AS quantity,$11::numeric AS unit_cost_usd,$12::numeric AS original_payment,$13::text AS account_name,$14::uuid AS actor), target AS (SELECT p.id,p.name,p.sku,p.stock,p.purchase_cost_usd,p.additional_cost_usd,i.quantity,i.unit_cost_usd FROM products p JOIN input i ON i.product_id=p.id WHERE p.active=TRUE FOR UPDATE), created AS (INSERT INTO purchases(purchase_number,supplier_id,supplier_name,currency,exchange_rate,total_usd,paid_usd,status,notes,created_by) SELECT purchase_number,supplier_id,supplier_name,currency,rate,total_usd,paid_usd,CASE WHEN paid_usd>=total_usd THEN 'Pagado' WHEN paid_usd>0 THEN 'Abono parcial' ELSE 'Pendiente' END,notes,actor FROM input WHERE EXISTS(SELECT 1 FROM target) RETURNING *), item AS (INSERT INTO purchase_items(purchase_id,product_id,product_name,quantity,unit_cost_usd,line_total_usd) SELECT created.id,target.id,target.name,input.quantity,input.unit_cost_usd,input.total_usd FROM created CROSS JOIN target CROSS JOIN input RETURNING id), updated AS (UPDATE products p SET stock=t.stock+t.quantity,purchase_cost_usd=CASE WHEN t.stock+t.quantity>0 THEN ROUND(((t.purchase_cost_usd*t.stock)+(t.unit_cost_usd*t.quantity))/(t.stock+t.quantity),2) ELSE t.unit_cost_usd END,unit_cost_usd=CASE WHEN t.stock+t.quantity>0 THEN ROUND(((t.purchase_cost_usd*t.stock)+(t.unit_cost_usd*t.quantity))/(t.stock+t.quantity),2)+t.additional_cost_usd ELSE t.unit_cost_usd+t.additional_cost_usd END,updated_at=NOW() FROM target t WHERE p.id=t.id AND p.active=TRUE AND EXISTS(SELECT 1 FROM created) RETURNING p.id,p.name,p.sku,t.stock AS previous_stock,t.quantity,p.stock AS new_stock), movement AS (INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) SELECT id,'Entrada',quantity,quantity,previous_stock,new_stock,'Entrada por compra '||(SELECT purchase_number FROM input),'purchase',(SELECT id::text FROM created),(SELECT actor FROM input) FROM updated RETURNING id), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'expense','Pago inicial de compra '||created.purchase_number,(SELECT id FROM cash_accounts WHERE name=input.account_name AND currency=input.currency AND active=TRUE LIMIT 1),input.currency,input.original_payment,input.rate,input.paid_usd,'purchase',created.id::text,input.actor FROM created CROSS JOIN input WHERE input.paid_usd>0 RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT input.actor,'create','purchase',created.id::text,to_jsonb(created) FROM created CROSS JOIN input) SELECT created.* FROM created",
      [purchaseNumber,body.supplier_id,body.supplier_name,currency,rate,totalUsd,paidUsd,body.notes || null,body.product_id,quantity,unitCostUsd,originalAmount,body.account_name || null,user.id]
    );
    if (!rows[0]) return erpError(409, "PURCHASE_PRODUCT_NOT_FOUND", "No se pudo registrar la compra: el producto no existe o está inactivo.");
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_PURCHASE", "El número de compra ya existe.");
    if (error?.code === "23503") return erpError(400, "RELATED_RECORD_NOT_FOUND", "El proveedor o producto seleccionado no existe.");
    console.error("[erp] Purchase creation failed:", error?.message || "database error");
    return erpError(503, "PURCHASE_SAVE_FAILED", "No se pudo registrar la compra.");
  }
}

async function createInvoice(sql, user, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const total = Number(body.total_usd), paid = Number(body.paid_usd || 0), rate = Number(body.exchange_rate || 1);
  if (!body.customer_name || !items.length || !Number.isFinite(total) || total < 0 || !Number.isFinite(paid) || paid < 0 || paid > total || !Number.isFinite(rate) || rate <= 0) {
    return erpError(400, "INVALID_INVOICE", "Revisa cliente, productos, total, pago y tipo de cambio.");
  }
  if (items.some((item) => !item.product_id || !item.product_name || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || !Number.isFinite(Number(item.unit_price_usd)) || Number(item.unit_price_usd) < 0)) {
    return erpError(400, "INVALID_INVOICE_ITEMS", "Cada renglón requiere producto, cantidad y precio válidos.");
  }
  const number = String(body.invoice_number || "").trim();
  if (!number) return erpError(400, "INVOICE_NUMBER_REQUIRED", "El número de comprobante es obligatorio.");
  const currency = body.currency === "NIO" ? "NIO" : "USD";
  const originalPayment = Number(body.original_payment_amount || 0);
  if (paid > 0 && (!Number.isFinite(originalPayment) || originalPayment <= 0 || !body.account_name)) return erpError(400, "INVALID_PAYMENT", "El cobro inicial requiere importe y cuenta.");
  try {
    const rows = await sql.query(
      "WITH input AS (SELECT $1::text AS invoice_number,$2::text AS source,$3::uuid AS order_id,$4::text AS order_number,$5::uuid AS customer_id,$6::text AS customer_name,$7::text AS customer_phone,$8::text AS currency,$9::numeric AS rate,$10::numeric AS subtotal,$11::numeric AS discount,$12::numeric AS delivery,$13::numeric AS total,$14::numeric AS paid,$15::text AS payment_method,$16::text AS notes,$17::jsonb AS items,$18::numeric AS original_payment,$19::text AS account_name,$20::uuid AS actor), item_totals AS (SELECT product_id,SUM(quantity)::int AS quantity FROM jsonb_to_recordset((SELECT items FROM input)) AS x(product_id uuid,product_name text,sku_snapshot text,quantity integer,unit_price_usd numeric,unit_cost_usd numeric) GROUP BY product_id), targets AS (SELECT p.id,p.name,p.sku,p.stock,t.quantity FROM products p JOIN item_totals t ON t.product_id=p.id), validation AS (SELECT COUNT(*) FILTER(WHERE targets.id IS NULL OR targets.stock<targets.quantity) AS invalid_count FROM item_totals LEFT JOIN targets ON targets.id=item_totals.product_id), created AS (INSERT INTO invoices(invoice_number,source,order_id,order_number_snapshot,customer_id,customer_name,customer_phone,currency,exchange_rate,subtotal_usd,discount_usd,delivery_fee_usd,total_usd,paid_usd,status,payment_method,notes,created_by) SELECT invoice_number,CASE WHEN source IN('store','web','manual') THEN source ELSE 'manual' END,order_id,order_number,customer_id,customer_name,customer_phone,currency,rate,subtotal,discount,delivery,total,paid,CASE WHEN paid>=total AND total>0 THEN 'Pagada' WHEN paid>0 THEN 'Abono parcial' ELSE 'Pendiente' END,payment_method,notes,actor FROM input WHERE (SELECT invalid_count FROM validation)=0 AND NOT EXISTS(SELECT 1 FROM input WHERE source='web' AND order_id IS NOT NULL AND EXISTS(SELECT 1 FROM invoices i WHERE i.order_id=input.order_id)) RETURNING *), invoice_lines AS (INSERT INTO invoice_items(invoice_id,product_id,product_name,sku_snapshot,quantity,unit_price_usd,line_total_usd,unit_cost_usd) SELECT created.id,x.product_id,x.product_name,x.sku_snapshot,x.quantity,x.unit_price_usd,x.quantity*x.unit_price_usd,COALESCE(x.unit_cost_usd,0) FROM created CROSS JOIN input CROSS JOIN LATERAL jsonb_to_recordset(input.items) AS x(product_id uuid,product_name text,sku_snapshot text,quantity integer,unit_price_usd numeric,unit_cost_usd numeric) RETURNING id), updated AS (UPDATE products p SET stock=p.stock-t.quantity,updated_at=NOW() FROM targets t WHERE p.id=t.id AND EXISTS(SELECT 1 FROM created) RETURNING p.id,p.name,p.sku,t.stock AS previous_stock,t.quantity,p.stock AS new_stock), movements AS (INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) SELECT id,'Salida',quantity,-quantity,previous_stock,new_stock,'Venta por factura '||(SELECT invoice_number FROM created),'invoice',(SELECT id::text FROM created),(SELECT actor FROM input) FROM updated RETURNING id), payment AS (INSERT INTO invoice_payments(invoice_id,currency,original_amount,exchange_rate,amount_usd,account_name,payment_method,created_by) SELECT created.id,input.currency,input.original_payment,input.rate,input.paid,input.account_name,input.payment_method,input.actor FROM created CROSS JOIN input WHERE input.paid>0 RETURNING id), cash AS (INSERT INTO cash_entries(direction,concept,account_id,currency,original_amount,exchange_rate,amount_usd,source_type,source_id,created_by) SELECT 'income','Cobro inicial factura '||created.invoice_number,(SELECT id FROM cash_accounts WHERE name=input.account_name AND currency=input.currency AND active=TRUE LIMIT 1),input.currency,input.original_payment,input.rate,input.paid,'invoice',created.id::text,input.actor FROM created CROSS JOIN input WHERE input.paid>0 RETURNING id), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT input.actor,'create','invoice',created.id::text,to_jsonb(created) FROM created CROSS JOIN input) SELECT created.* FROM created",
      [number,body.source || "manual",body.order_id || null,body.order_number_snapshot || null,body.customer_id || null,String(body.customer_name).trim(),body.customer_phone || null,currency,rate,Number(body.subtotal_usd || total),Number(body.discount_usd || 0),Number(body.delivery_fee_usd || 0),total,paid,body.payment_method || null,body.notes || null,JSON.stringify(items),originalPayment,body.account_name || null,user.id]
    );
    if (!rows[0]) {
      const check = await sql.query("SELECT COUNT(*)::int AS invalid_count FROM jsonb_to_recordset($1::jsonb) AS x(product_id uuid,quantity integer) LEFT JOIN products p ON p.id=x.product_id AND p.active=TRUE WHERE p.id IS NULL OR p.stock < x.quantity", [JSON.stringify(items)]);
      if (check[0]?.invalid_count) return erpError(409, "INSUFFICIENT_STOCK", "Uno o más perfumes no tienen existencias suficientes o están inactivos.");
      return erpError(409, "DUPLICATE_WEB_INVOICE", "El pedido web seleccionado ya tiene una factura.");
    }
    return erpJson({ record: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "23505") return erpError(409, "DUPLICATE_INVOICE", "El número de factura ya existe.");
    if (error?.code === "23503") return erpError(400, "RELATED_RECORD_NOT_FOUND", "El cliente, pedido o producto relacionado no existe.");
    console.error("[erp] Invoice creation failed:", error?.message || "database error");
    return erpError(503, "INVOICE_SAVE_FAILED", "No se pudo registrar la factura.");
  }
}

async function addInvoicePayment(sql, user, body) {
  const original = Number(body.original_amount), rate = Number(body.exchange_rate || 1), usd = Number(body.amount_usd);
  if (!body.invoice_id || !Number.isFinite(original) || original <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(usd) || usd <= 0 || !body.account_name) return erpError(400, "INVALID_PAYMENT", "Revisa factura, importe, tipo de cambio y cuenta.");
  const currency = body.currency === "NIO" ? "NIO" : "USD";
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
  const rows = await sql.query(
    "WITH target AS (SELECT o.id,o.order_number,o.status AS old_status FROM orders o WHERE o.id=$1::uuid FOR UPDATE), totals AS (SELECT product_id,SUM(quantity)::int AS quantity FROM order_items WHERE order_id=$1::uuid AND product_id IS NOT NULL GROUP BY product_id), products_before AS (SELECT p.id,p.name,p.sku,p.stock,t.quantity FROM products p JOIN totals t ON t.product_id=p.id), direction AS (SELECT CASE WHEN target.old_status='Pendiente' AND $2 IN ('En preparación','Listo para entrega','En tránsito','Completado') THEN -1 WHEN target.old_status IN ('En preparación','Listo para entrega','En tránsito') AND $2 IN ('Pendiente','Cancelado') THEN 1 ELSE 0 END AS factor FROM target), validation AS (SELECT COUNT(*) FILTER(WHERE products_before.stock < products_before.quantity OR products_before.id IS NULL) AS insufficient FROM totals LEFT JOIN products_before ON products_before.id=totals.product_id CROSS JOIN direction WHERE direction.factor=-1), changed_stock AS (UPDATE products p SET stock=p.stock+(direction.factor*products_before.quantity),updated_at=NOW() FROM products_before CROSS JOIN direction WHERE p.id=products_before.id AND direction.factor<>0 AND (direction.factor=1 OR products_before.stock>=products_before.quantity) AND (SELECT insufficient FROM validation)=0 RETURNING p.id,p.name,p.sku,products_before.stock AS previous_stock,products_before.quantity,p.stock AS new_stock), movements AS (INSERT INTO inventory_movements(product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,reference_id,created_by) SELECT id,CASE WHEN quantity_delta<0 THEN 'Salida' ELSE 'Reversion' END,quantity,quantity_delta,previous_stock,new_stock,'Cambio de estado del pedido '||(SELECT order_number FROM target),'order',$1::text,$3 FROM (SELECT id,quantity,previous_stock,new_stock,(new_stock-previous_stock) AS quantity_delta FROM changed_stock) s RETURNING id), changed_order AS (UPDATE orders o SET status=$2,updated_at=NOW() FROM target WHERE o.id=target.id AND (SELECT insufficient FROM validation)=0 RETURNING o.*), logged AS (INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) SELECT $3,'status_change','order',id::text,jsonb_build_object('status',$2) FROM changed_order) SELECT * FROM changed_order",
    [id,status,user.id]
  );
  if (!rows[0]) return erpError(409, "ORDER_STOCK_CONFLICT", "No se pudo cambiar el estado: el pedido no existe o no hay existencias suficientes.");
  return erpJson({ record: rows[0] });
}

export async function handleERPRequest(request, env, user, sql) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[2] || "";
  const id = parts[3] || "";
  if (!canAccess(user, ["owner","admin","sales","inventory","finance","hr"])) {
    return erpError(403, "INSUFFICIENT_ROLE", "Tu cuenta no tiene un rol operativo habilitado.");
  }
  if (resource === "bootstrap" && request.method === "GET") {
    try {
      const data = await readBootstrap(sql, user);
      return erpJson({ data });
    } catch (error) {
      console.error("[erp] Bootstrap failed:", error?.message || "database error");
      return erpError(503, "BOOTSTRAP_FAILED", "No se pudieron cargar los datos operativos desde Neon.");
    }
  }
  if (resource === "settings" && request.method === "GET") {
    const rows = await sql.query("SELECT setting_key, setting_value FROM app_settings ORDER BY setting_key");
    return erpJson({ records: rows });
  }
  if (resource === "settings" && request.method === "PATCH") {
    if (!["owner","admin"].includes(user.role)) return erpError(403, "FORBIDDEN", "Solo propietario o administración puede cambiar la configuración.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    const key = String(body.setting_key || "");
    if (!["default_exchange_rate","base_currency","payroll_currency"].includes(key)) return erpError(400, "INVALID_SETTING", "La configuración solicitada no está permitida.");
    const value = body.setting_value;
    if (key === "default_exchange_rate" && (!Number.isFinite(Number(value?.value)) || Number(value.value) <= 0 || Number(value.value) > 100000)) return erpError(400, "INVALID_EXCHANGE_RATE", "El tipo de cambio debe ser mayor que cero.");
    const rows = await sql.query("INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES($1,$2::jsonb,$3,NOW()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING setting_key,setting_value", [key,JSON.stringify(value),user.id]);
    await auditQuery(sql,user.id,"update","app_setting",key,value);
    return erpJson({ record: rows[0] });
  }
  if (resource === "orders" && request.method === "POST") {
    if (!canAccess(user, RESOURCE_DEFS.orders.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para registrar pedidos.");
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    return createOrder(sql, user, body);
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
    let body; try { body = await request.json(); } catch { return erpError(400, "INVALID_JSON", "El cuerpo JSON no es válido."); }
    if (normalizedResource === "orders" && Object.prototype.hasOwnProperty.call(body,"status")) {
      if (!canAccess(user, RESOURCE_DEFS.orders.roles)) return erpError(403, "FORBIDDEN", "No tienes permiso para cambiar pedidos.");
      return updateOrderStatus(sql,user,id,body);
    }
    return updateGeneric(sql, user, normalizedResource, def, id, body);
  }
  if (request.method === "DELETE" && id) return softDelete(sql, user, normalizedResource, def, id);
  return erpError(405, "METHOD_NOT_ALLOWED", "El método HTTP no está disponible para este recurso.");
}
