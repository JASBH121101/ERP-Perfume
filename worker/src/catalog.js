const PRODUCT_READ_ROLES = ["owner", "admin", "inventory", "finance"];
const PRODUCT_WRITE_ROLES = ["owner", "admin", "inventory"];
const CONTACT_ROLES = ["owner", "admin"];

const PRODUCT_COLUMNS = `
  id, sku, name, brand, category, concentration, gender, family, size_ml,
  presentation, barcode, description, supplier_name, purchase_cost_usd,
  additional_cost_usd, unit_cost_usd, price_usd, wholesale_price_usd,
  stock, min_stock, location, tone, notes, images, active, created_at, updated_at
`;

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function textValue(value, max = 500) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function numericValue(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

async function readBody(request, errorResponse) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { error: errorResponse(400, "INVALID_BODY", "The request body must be a JSON object.") };
    }
    return { body };
  } catch {
    return { error: errorResponse(400, "INVALID_JSON", "The request body must be valid JSON.") };
  }
}

async function audit(sql, userId, action, entityType, entityId, details) {
  await sql.query(
    "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5::jsonb)",
    [userId, action, entityType, String(entityId), JSON.stringify(details || {})]
  );
}

async function getBootstrap(request, env, context) {
  const auth = await context.requireUser(request, env, PRODUCT_READ_ROLES);
  if (auth.response) return auth.response;

  try {
    const canReadContacts = ["owner", "admin"].includes(auth.user.role);
    const [products, suppliers, customers, movements, setting] = await Promise.all([
      auth.sql.query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY created_at DESC, name`),
      canReadContacts
        ? auth.sql.query("SELECT id, name, contact, phone, email, currency, notes, active, created_at FROM suppliers WHERE active = TRUE ORDER BY LOWER(name)")
        : Promise.resolve([]),
      canReadContacts
        ? auth.sql.query(
            "SELECT c.id, c.name, c.contact, c.phone, c.email, c.customer_type, c.active, c.created_at, " +
            "COALESCE((SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = c.id), 0) AS orders, " +
            "COALESCE((SELECT SUM(o.total_usd) FROM orders o WHERE o.customer_id = c.id), 0)::text AS spent_usd " +
            "FROM customers c WHERE c.active = TRUE ORDER BY LOWER(c.name)"
          )
        : Promise.resolve([]),
      auth.sql.query(
        "SELECT m.id, m.product_id, p.name AS product_name, p.sku AS sku_snapshot, m.movement_type, " +
        "m.quantity, m.quantity_delta, m.previous_stock, m.new_stock, m.note, m.reference_type, " +
        "m.reference_id, m.created_at FROM inventory_movements m JOIN products p ON p.id = m.product_id " +
        "ORDER BY m.created_at DESC LIMIT 500"
      ),
      auth.sql.query("SELECT setting_value->>'value' AS value FROM app_settings WHERE setting_key = 'default_exchange_rate' LIMIT 1")
    ]);
    return context.json({
      products,
      suppliers,
      customers,
      inventoryMovements: movements,
      exchangeRate: numericValue(setting[0]?.value, 36.6)
    });
  } catch (error) {
    console.error("[catalog] Bootstrap failed:", error?.message || "database error");
    return context.errorResponse(503, "ERP_DATA_UNAVAILABLE", "The ERP catalog data could not be loaded.");
  }
}

async function listProducts(request, env, context) {
  const auth = await context.requireUser(request, env, PRODUCT_READ_ROLES);
  if (auth.response) return auth.response;
  try {
    const products = await auth.sql.query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY created_at DESC, name`);
    return context.json({ products });
  } catch (error) {
    console.error("[catalog] Product list failed:", error?.message || "database error");
    return context.errorResponse(503, "PRODUCTS_UNAVAILABLE", "Products could not be loaded.");
  }
}

function validateProduct(body) {
  const product = {
    sku: textValue(body.sku, 80),
    name: textValue(body.name, 160),
    brand: textValue(body.brand, 100),
    category: textValue(body.category, 100),
    concentration: textValue(body.concentration, 100),
    gender: textValue(body.gender, 40),
    family: textValue(body.family, 100),
    sizeMl: body.sizeMl == null || body.sizeMl === "" ? null : numericValue(body.sizeMl, NaN),
    presentation: textValue(body.presentation, 120),
    barcode: textValue(body.barcode, 100),
    description: textValue(body.description, 4000),
    supplierName: textValue(body.supplier, 160),
    purchaseCost: numericValue(body.purchaseCost, 0),
    additionalCost: numericValue(body.additionalCost, 0),
    price: numericValue(body.price, 0),
    wholesalePrice: body.wholesalePrice == null || body.wholesalePrice === "" ? null : numericValue(body.wholesalePrice, NaN),
    minStock: numericValue(body.minStock, 0),
    location: textValue(body.location, 120),
    tone: textValue(body.tone, 40),
    notes: textValue(body.notes, 2000)
  };
  if (!product.sku || !product.name) return { error: "SKU and product name are required." };
  if ([product.purchaseCost, product.additionalCost, product.price].some(v => !Number.isFinite(v) || v < 0) || product.price <= 0) {
    return { error: "Enter valid non-negative costs and a selling price greater than zero." };
  }
  if (product.wholesalePrice !== null && (!Number.isFinite(product.wholesalePrice) || product.wholesalePrice < 0)) {
    return { error: "Wholesale price must be zero or greater." };
  }
  if (product.sizeMl !== null && (!Number.isFinite(product.sizeMl) || product.sizeMl <= 0)) {
    return { error: "Product size must be greater than zero." };
  }
  if (!Number.isInteger(product.minStock) || product.minStock < 0) {
    return { error: "Minimum stock must be a non-negative whole number." };
  }
  product.unitCost = product.purchaseCost + product.additionalCost;
  return { product };
}

async function createProduct(request, env, context) {
  const auth = await context.requireUser(request, env, PRODUCT_WRITE_ROLES);
  if (auth.response) return auth.response;
  const parsed = await readBody(request, context.errorResponse);
  if (parsed.error) return parsed.error;
  const checked = validateProduct(parsed.body);
  if (checked.error) return context.errorResponse(400, "INVALID_PRODUCT", checked.error);
  const p = checked.product;

  try {
    const rows = await auth.sql.query(
      "WITH saved AS (INSERT INTO products (sku, name, brand, category, concentration, gender, family, size_ml, presentation, " +
      "barcode, description, supplier_name, purchase_cost_usd, additional_cost_usd, unit_cost_usd, price_usd, " +
      "wholesale_price_usd, stock, min_stock, location, tone, notes) " +
      "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,$18,$19,$20,$21) " +
      `RETURNING ${PRODUCT_COLUMNS}` +
      "), audit AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $22,'create','product',id::text,jsonb_build_object('sku',sku,'name',name) FROM saved) SELECT * FROM saved",
      [p.sku,p.name,p.brand,p.category,p.concentration,p.gender,p.family,p.sizeMl,p.presentation,p.barcode,
        p.description,p.supplierName,p.purchaseCost,p.additionalCost,p.unitCost,p.price,p.wholesalePrice,
        p.minStock,p.location,p.tone,p.notes,auth.user.id]
    );
    const product = rows[0];
    return context.json({ product }, 201);
  } catch (error) {
    if (error?.code === "23505") return context.errorResponse(409, "DUPLICATE_PRODUCT", "The SKU or barcode is already in use.");
    console.error("[catalog] Product insert failed:", error?.message || "database error");
    return context.errorResponse(503, "PRODUCT_SAVE_FAILED", "The product could not be saved.");
  }
}

async function updateProduct(request, env, context, productId) {
  const auth = await context.requireUser(request, env, PRODUCT_WRITE_ROLES);
  if (auth.response) return auth.response;
  if (!isUuid(productId)) return context.errorResponse(400, "INVALID_PRODUCT_ID", "The product identifier is invalid.");
  const parsed = await readBody(request, context.errorResponse);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    if (typeof body.active === "boolean" && Object.keys(body).length === 1) {
      const rows = await auth.sql.query(
        `WITH saved AS (UPDATE products SET active = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING ${PRODUCT_COLUMNS}), ` +
        "audit AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
        "SELECT $3,'update','product',id::text,jsonb_build_object('active',active) FROM saved) SELECT * FROM saved",
        [body.active, productId, auth.user.id]
      );
      if (!rows[0]) return context.errorResponse(404, "PRODUCT_NOT_FOUND", "The product was not found.");
      return context.json({ product: rows[0] });
    }

    const checked = validateProduct(body);
    if (checked.error) return context.errorResponse(400, "INVALID_PRODUCT", checked.error);
    const p = checked.product;
    const rows = await auth.sql.query(
      "WITH saved AS (UPDATE products SET sku=$1, name=$2, brand=$3, category=$4, concentration=$5, gender=$6, family=$7, size_ml=$8, " +
      "presentation=$9, barcode=$10, description=$11, supplier_name=$12, purchase_cost_usd=$13, additional_cost_usd=$14, " +
      "unit_cost_usd=$15, price_usd=$16, wholesale_price_usd=$17, min_stock=$18, location=$19, tone=$20, notes=$21, updated_at=NOW() " +
      `WHERE id=$22::uuid RETURNING ${PRODUCT_COLUMNS}` +
      "), audit AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $23,'update','product',id::text,jsonb_build_object('sku',sku,'name',name) FROM saved) SELECT * FROM saved",
      [p.sku,p.name,p.brand,p.category,p.concentration,p.gender,p.family,p.sizeMl,p.presentation,p.barcode,p.description,
        p.supplierName,p.purchaseCost,p.additionalCost,p.unitCost,p.price,p.wholesalePrice,p.minStock,p.location,p.tone,p.notes,productId,auth.user.id]
    );
    if (!rows[0]) return context.errorResponse(404, "PRODUCT_NOT_FOUND", "The product was not found.");
    return context.json({ product: rows[0] });
  } catch (error) {
    if (error?.code === "23505") return context.errorResponse(409, "DUPLICATE_PRODUCT", "The SKU or barcode is already in use.");
    console.error("[catalog] Product update failed:", error?.message || "database error");
    return context.errorResponse(503, "PRODUCT_UPDATE_FAILED", "The product could not be updated.");
  }
}

async function deleteProduct(request, env, context, productId) {
  const auth = await context.requireUser(request, env, PRODUCT_WRITE_ROLES);
  if (auth.response) return auth.response;
  if (!isUuid(productId)) return context.errorResponse(400, "INVALID_PRODUCT_ID", "The product identifier is invalid.");
  try {
    const history = await auth.sql.query(
      "SELECT EXISTS (SELECT 1 FROM inventory_movements WHERE product_id=$1::uuid) OR " +
      "EXISTS (SELECT 1 FROM invoice_items WHERE product_id=$1::uuid) OR " +
      "EXISTS (SELECT 1 FROM order_items WHERE product_id=$1::uuid) OR " +
      "EXISTS (SELECT 1 FROM purchase_items WHERE product_id=$1::uuid) OR " +
      "EXISTS (SELECT 1 FROM purchase_order_items WHERE product_id=$1::uuid) OR " +
      "EXISTS (SELECT 1 FROM purchase_receipt_items WHERE product_id=$1::uuid) AS has_history",
      [productId]
    );
    if (history[0]?.has_history) return context.errorResponse(409, "PRODUCT_HAS_HISTORY", "This product has history. Deactivate it to preserve traceability.");
    const rows = await auth.sql.query(
      "WITH deleted AS (DELETE FROM products WHERE id=$1::uuid RETURNING id, sku, name), " +
      "audit AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $2,'delete','product',id::text,jsonb_build_object('sku',sku,'name',name) FROM deleted) SELECT * FROM deleted",
      [productId, auth.user.id]
    );
    if (!rows[0]) return context.errorResponse(404, "PRODUCT_NOT_FOUND", "The product was not found.");
    return context.json({ deleted: true, product: rows[0] });
  } catch (error) {
    console.error("[catalog] Product delete failed:", error?.message || "database error");
    return context.errorResponse(503, "PRODUCT_DELETE_FAILED", "The product could not be deleted.");
  }
}

async function listSuppliers(request, env, context) {
  const auth = await context.requireUser(request, env, PRODUCT_READ_ROLES);
  if (auth.response) return auth.response;
  try {
    const suppliers = await auth.sql.query("SELECT id, name, contact, phone, email, currency, notes, active, created_at FROM suppliers ORDER BY active DESC, LOWER(name)");
    return context.json({ suppliers });
  } catch (error) {
    console.error("[catalog] Supplier list failed:", error?.message || "database error");
    return context.errorResponse(503, "SUPPLIERS_UNAVAILABLE", "Suppliers could not be loaded.");
  }
}

async function createSupplier(request, env, context) {
  const auth = await context.requireUser(request, env, CONTACT_ROLES);
  if (auth.response) return auth.response;
  const parsed = await readBody(request, context.errorResponse);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  const name = textValue(body.name, 160);
  const contact = textValue(body.contact, 120);
  const phone = textValue(body.phone, 60);
  const email = textValue(body.email, 160);
  const currency = body.currency === "NIO" ? "NIO" : "USD";
  const notes = textValue(body.notes, 2000);
  if (!name) return context.errorResponse(400, "INVALID_SUPPLIER", "Supplier name is required.");
  try {
    const rows = await auth.sql.query(
      "WITH saved AS (INSERT INTO suppliers (name, contact, phone, email, currency, notes) VALUES ($1,$2,$3,$4,$5,$6) " +
      "RETURNING id, name, contact, phone, email, currency, notes, active, created_at), " +
      "audit AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $7,'create','supplier',id::text,jsonb_build_object('name',name) FROM saved) SELECT * FROM saved",
      [name,contact,phone,email,currency,notes,auth.user.id]
    );
    return context.json({ supplier: rows[0] }, 201);
  } catch (error) {
    console.error("[catalog] Supplier insert failed:", error?.message || "database error");
    return context.errorResponse(503, "SUPPLIER_SAVE_FAILED", "The supplier could not be saved.");
  }
}

async function listCustomers(request, env, context) {
  const auth = await context.requireUser(request, env, CONTACT_ROLES);
  if (auth.response) return auth.response;
  try {
    const customers = await auth.sql.query(
      "SELECT c.id, c.name, c.contact, c.phone, c.email, c.customer_type, c.active, c.created_at, " +
      "COALESCE((SELECT COUNT(*)::int FROM orders o WHERE o.customer_id=c.id),0) AS orders, " +
      "COALESCE((SELECT SUM(o.total_usd) FROM orders o WHERE o.customer_id=c.id),0)::text AS spent_usd " +
      "FROM customers c ORDER BY c.active DESC, LOWER(c.name)"
    );
    return context.json({ customers });
  } catch (error) {
    console.error("[catalog] Customer list failed:", error?.message || "database error");
    return context.errorResponse(503, "CUSTOMERS_UNAVAILABLE", "Customers could not be loaded.");
  }
}

async function createCustomer(request, env, context) {
  const auth = await context.requireUser(request, env, CONTACT_ROLES);
  if (auth.response) return auth.response;
  const parsed = await readBody(request, context.errorResponse);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  const name = textValue(body.name, 160);
  const contact = textValue(body.contact, 120);
  const phone = textValue(body.phone, 60);
  const email = textValue(body.email, 160);
  const customerType = body.customerType === "business" ? "business" : "particular";
  if (!name) return context.errorResponse(400, "INVALID_CUSTOMER", "Customer name is required.");
  try {
    const rows = await auth.sql.query(
      "WITH saved AS (INSERT INTO customers (name, contact, phone, email, customer_type) VALUES ($1,$2,$3,$4,$5) " +
      "RETURNING id, name, contact, phone, email, customer_type, active, created_at), " +
      "audit AS (INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $6,'create','customer',id::text,jsonb_build_object('name',name,'customer_type',customer_type) FROM saved) SELECT * FROM saved",
      [name,contact,phone,email,customerType,auth.user.id]
    );
    return context.json({ customer: { ...rows[0], orders: 0, spent_usd: "0" } }, 201);
  } catch (error) {
    console.error("[catalog] Customer insert failed:", error?.message || "database error");
    return context.errorResponse(503, "CUSTOMER_SAVE_FAILED", "The customer could not be saved.");
  }
}

async function createInventoryMovement(request, env, context) {
  const auth = await context.requireUser(request, env, ["owner", "admin", "inventory"]);
  if (auth.response) return auth.response;
  const parsed = await readBody(request, context.errorResponse);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  const productId = String(body.productId || "");
  const type = body.type;
  const quantity = numericValue(body.quantity, NaN);
  const note = textValue(body.note, 500);
  if (!isUuid(productId) || !["entry", "exit", "adjustment"].includes(type) ||
      !Number.isInteger(quantity) || quantity < 0 || (type !== "adjustment" && quantity === 0)) {
    return context.errorResponse(400, "INVALID_MOVEMENT", "Select a product, movement type and valid whole-unit quantity.");
  }

  try {
    const rows = await auth.sql.query(
      "WITH locked AS MATERIALIZED (SELECT id, stock, active FROM products WHERE id=$1::uuid FOR UPDATE), " +
      "calc AS (SELECT id, stock, active, CASE $2 WHEN 'entry' THEN $3::int WHEN 'exit' THEN -$3::int ELSE $3::int-stock END AS delta FROM locked), " +
      "updated AS (UPDATE products p SET stock=p.stock+c.delta, updated_at=NOW() FROM calc c " +
      "WHERE p.id=c.id AND c.active=TRUE AND c.delta<>0 AND p.stock+c.delta>=0 " +
      "RETURNING p.id, p.name, p.sku, p.stock, c.stock AS previous_stock, c.delta), " +
      "movement AS (INSERT INTO inventory_movements (product_id,movement_type,quantity,quantity_delta,previous_stock,new_stock,note,reference_type,created_by) " +
      "SELECT u.id, CASE $2 WHEN 'entry' THEN 'Entrada' WHEN 'exit' THEN 'Salida' ELSE 'Ajuste' END, " +
      "ABS(u.delta), u.delta, u.previous_stock, u.stock, $4, 'manual', $5 FROM updated u " +
      "RETURNING id, product_id, movement_type, quantity, quantity_delta, previous_stock, new_stock, note, reference_type, created_at) " +
      "INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,details) " +
      "SELECT $5,'create','inventory_movement',m.id::text,jsonb_build_object('product_id',m.product_id,'quantity_delta',m.quantity_delta,'new_stock',m.new_stock) " +
      "FROM movement m RETURNING entity_id",
      [productId,type,quantity,note,auth.user.id]
    );
    if (!rows.length) {
      const current = await auth.sql.query("SELECT id, stock, active FROM products WHERE id=$1::uuid LIMIT 1", [productId]);
      if (!current[0]) return context.errorResponse(404, "PRODUCT_NOT_FOUND", "The product was not found.");
      if (!current[0].active) return context.errorResponse(409, "PRODUCT_INACTIVE", "An inactive product cannot receive inventory movements.");
      if (type === "exit" && quantity > Number(current[0].stock)) return context.errorResponse(409, "INSUFFICIENT_STOCK", "The requested exit exceeds available stock.");
      return context.errorResponse(409, "NO_STOCK_CHANGE", "The movement would not change the current stock.");
    }
    const movementRows = await auth.sql.query(
      "SELECT m.id, m.product_id, p.name AS product_name, p.sku AS sku_snapshot, m.movement_type, m.quantity, " +
      "m.quantity_delta, m.previous_stock, m.new_stock, m.note, m.reference_type, m.created_at " +
      "FROM inventory_movements m JOIN products p ON p.id=m.product_id WHERE m.id=$1::uuid LIMIT 1",
      [rows[0].entity_id]
    );
    return context.json({ movement: movementRows[0] }, 201);
  } catch (error) {
    console.error("[inventory] Movement insert failed:", error?.message || "database error");
    return context.errorResponse(503, "MOVEMENT_SAVE_FAILED", "The inventory movement could not be saved.");
  }
}

export async function handleCatalogApi(request, env, context) {
  const path = new URL(request.url).pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/erp/bootstrap" && method === "GET") return getBootstrap(request, env, context);
  if (path === "/api/catalog/products" && method === "GET") return listProducts(request, env, context);
  if (path === "/api/catalog/products" && method === "POST") return createProduct(request, env, context);
  if (path.startsWith("/api/catalog/products/")) {
    const id = path.slice("/api/catalog/products/".length);
    if (method === "PATCH") return updateProduct(request, env, context, id);
    if (method === "DELETE") return deleteProduct(request, env, context, id);
  }
  if (path === "/api/catalog/suppliers" && method === "GET") return listSuppliers(request, env, context);
  if (path === "/api/catalog/suppliers" && method === "POST") return createSupplier(request, env, context);
  if (path === "/api/catalog/customers" && method === "GET") return listCustomers(request, env, context);
  if (path === "/api/catalog/customers" && method === "POST") return createCustomer(request, env, context);
  if (path === "/api/inventory/movements" && method === "POST") return createInventoryMovement(request, env, context);

  if (path.startsWith("/api/catalog/") || path.startsWith("/api/inventory/") || path === "/api/erp/bootstrap") {
    return context.errorResponse(405, "METHOD_NOT_ALLOWED", "This HTTP method is not supported for the requested endpoint.");
  }
  return null;
}
