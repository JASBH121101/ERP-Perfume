import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");
const parserStart = appSource.indexOf("  function catalogNumber(value)");
const parserEnd = appSource.indexOf("  function loadCatalogScript", parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart, "catalog import parser must remain present");
const parsers = new Function(
  "roundMoney",
  "Date",
  appSource.slice(parserStart, parserEnd) + "\nreturn { parseCatalogCSV, parseCatalogTextRows };"
)((value) => Math.round(value * 100) / 100, Date);

test("CSV imports Spanish headers, semicolon delimiter and decimal comma", () => {
  const rows = parsers.parseCatalogCSV(
    '\uFEFFSKU;Producto;Marca;Costo de compra;Precio de venta;Stock\n' +
    'DIO-001;"Sauvage Elixir";Dior;75,50;109,99;4\n' +
    'ARM-002;Stronger With You;Armani;50,00;89,00;2'
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(({ sku, name, brand, purchase_cost_usd, price_usd, stock }) =>
      ({ sku, name, brand, purchase_cost_usd, price_usd, stock })),
    [
      { sku: "DIO-001", name: "Sauvage Elixir", brand: "Dior", purchase_cost_usd: 75.5, price_usd: 109.99, stock: 4 },
      { sku: "ARM-002", name: "Stronger With You", brand: "Armani", purchase_cost_usd: 50, price_usd: 89, stock: 2 }
    ]
  );
});

test("CSV blank purchase-cost breakdown preserves an explicit unit-cost column", () => {
  const rows = parsers.parseCatalogCSV(
    "SKU,Producto,Costo de compra,Costos adicionales,Costo unitario,Precio,Stock\n" +
    "UNIT-02,Perfume unitario,, ,15,30,1"
  );
  assert.equal(rows[0].purchase_cost_usd, null);
  assert.equal(rows[0].additional_cost_usd, null);
  assert.equal(rows[0].unit_cost_usd, 15);
});

test("CSV unit-cost-only catalogs retain unit cost when purchase-cost breakdown is absent", () => {
  const rows = parsers.parseCatalogCSV(
    "SKU,Producto,Costo unitario,Precio,Stock\n" +
    "UNIT-01,Perfume unitario,15,30,1"
  );
  assert.equal(rows[0].purchase_cost_usd, null);
  assert.equal(rows[0].additional_cost_usd, null);
  assert.equal(rows[0].unit_cost_usd, 15);
});

test("CSV keeps commas and escaped quotation marks inside quoted product names", () => {
  const rows = parsers.parseCatalogCSV(
    'SKU,Product,Brand,Price,Stock\n' +
    'SKU-01,"Rose, ""Noir""",Maison,45.5,3'
  );
  assert.equal(rows[0].name, 'Rose, "Noir"');
  assert.equal(rows[0].price_usd, 45.5);
  assert.equal(rows[0].stock, 3);
});

test("PDF text extraction parser retains aligned product columns", () => {
  const rows = parsers.parseCatalogTextRows(
    "SKU          PRODUCTO                  PRECIO          STOCK\n" +
    "DIO-001     Dior Sauvage Elixir        109.99          4\n" +
    "ARM-002     Armani Code Parfum         89.50           2"
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Dior Sauvage Elixir");
  assert.equal(rows[0]._detected_amount, 109.99);
  assert.equal(rows[0].stock, 4);
  assert.equal(rows[1].name, "Armani Code Parfum");
  assert.equal(rows[1].stock, 2);
});

test("OCR parser reads plain text rows from PNG/JPG screenshots", () => {
  const rows = parsers.parseCatalogTextRows(
    "DIO-001 Dior Sauvage Elixir $109.99 stock 4\n" +
    "ARM-002 Armani Code Parfum USD 89.50 existencias 2"
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Dior Sauvage Elixir");
  assert.equal(rows[0]._detected_amount, 109.99);
  assert.equal(rows[0].stock, 4);
  assert.equal(rows[1].name, "Armani Code Parfum");
  assert.equal(rows[1]._detected_amount, 89.5);
  assert.equal(rows[1].stock, 2);
});

test("PDF/image parser rejects text without identifiable product rows", () => {
  assert.throws(() => parsers.parseCatalogTextRows("Página 1\nSubtotal\nTotal"), /No pude extraer nombres/);
});

test("CSV rejects files over 200 products instead of silently truncating them", () => {
  const lines = ["SKU,Producto,Precio,Stock"];
  for (let index = 1; index <= 201; index += 1) {
    lines.push("SKU-" + index + ",Perfume QA " + index + ",10,1");
  }
  assert.throws(() => parsers.parseCatalogCSV(lines.join("\n")), /máximo de 200 productos/);
});

test("PDF/OCR parser rejects more than 200 detected unique products", () => {
  const lines = [];
  for (let index = 1; index <= 201; index += 1) {
    lines.push("QA-" + index + " Perfume QA " + index + " USD 10.00");
  }
  assert.throws(() => parsers.parseCatalogTextRows(lines.join("\n")), /más de 200 productos/);
});

const workerSource = await readFile(new URL("../worker/src/erp.js", import.meta.url), "utf8");
const importEnd = workerSource.indexOf("async function createInventoryMovement");
assert.ok(importEnd > 0, "bulk import handler must remain present");
const importProducts = new Function(workerSource.slice(0, importEnd) + "\nreturn importProducts;")();

function mockSql(existingSkus = []) {
  const statements = [];
  return {
    statements,
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.startsWith("SELECT sku FROM products")) return existingSkus.map((sku) => ({ sku }));
      return [{ id: "00000000-0000-0000-0000-000000000001", sku: "TEST-001", name: "Perfume Test", stock: 2 }];
    }
  };
}

const owner = { id: "00000000-0000-0000-0000-000000000001", role: "owner" };

test("backend bulk import uses a single write statement with initial kardex and audit trail", async () => {
  const sql = mockSql();
  const response = await importProducts(sql, owner, {
    records: [{ sku: "TEST-001", name: "Perfume Test", stock: 2, purchase_cost_usd: 7, price_usd: 12.5, images: [] }],
    source_file: "catalogo.csv"
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.imported, 1);
  assert.equal(sql.statements.length, 2);
  assert.match(sql.statements[1].sql, /movement AS/);
  assert.match(sql.statements[1].sql, /logged AS/);
});

test("backend rejects duplicate SKUs inside the file before database writes", async () => {
  const sql = mockSql();
  const response = await importProducts(sql, owner, {
    records: [{ sku: "DUP-01", name: "Producto A" }, { sku: "dup-01", name: "Producto B" }]
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "DUPLICATE_IMPORT_SKU");
  assert.equal(sql.statements.length, 0);
});

test("backend rejects an SKU already present in Neon before inserting", async () => {
  const sql = mockSql(["EXISTS-01"]);
  const response = await importProducts(sql, owner, {
    records: [{ sku: "EXISTS-01", name: "Producto existente" }]
  });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "SKU_ALREADY_EXISTS");
  assert.equal(sql.statements.length, 1);
});

test("backend rejects malformed stock and caps each import at 200 records", async () => {
  const sql = mockSql();
  const invalid = await importProducts(sql, owner, {
    records: [{ sku: "BAD-01", name: "Producto", stock: -1 }]
  });
  assert.equal(invalid.status, 400);
  const tooMany = await importProducts(sql, owner, {
    records: Array.from({ length: 201 }, (_, i) => ({ sku: "SKU-" + i, name: "Producto " + i }))
  });
  assert.equal(tooMany.status, 400);
  assert.equal(sql.statements.length, 0);
});


const operationalWorkerSource = workerSource.replace(/\bexport\s+(?=async function|function)/g, "");
const handleERPRequest = new Function(operationalWorkerSource + "\nreturn handleERPRequest;")();
const createInvoice = new Function(operationalWorkerSource + "\nreturn createInvoice;")();

test("HR leave approval route records reviewer and review timestamp", async () => {
  const statements = [];
  const sql = {
    query: async (query, params) => {
      statements.push({ query, params });
      return [{ id: "00000000-0000-0000-0000-000000000002", status: params[0] }];
    }
  };
  const request = {
    url: "https://erp.test/api/erp/hr_leave_requests/00000000-0000-0000-0000-000000000002",
    method: "PATCH",
    json: async () => ({ status: "Aprobado" })
  };
  const response = await handleERPRequest(request, {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.record.status, "Aprobado");
  assert.match(statements[0].query, /reviewed_by/);
  assert.match(statements[0].query, /reviewed_at=NOW\(\)/);
});

test("completed or cancelled orders cannot be reopened through status updates", async () => {
  let executedSql = "";
  const sql = {
    query: async (query) => {
      if (!executedSql) executedSql = query;
      return [];
    }
  };
  const request = {
    url: "https://erp.test/api/erp/orders/00000000-0000-0000-0000-000000000003",
    method: "PATCH",
    json: async () => ({ status: "Pendiente" })
  };
  const response = await handleERPRequest(request, {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.match(body.error.message, /finalizado\/cancelado/);
  assert.match(executedSql, /old_status NOT IN \('Completado','Cancelado'\)/);
});


function requestFor(path, method, body) {
  return {
    url: "https://erp.test/api/erp/" + path,
    method,
    json: async () => body
  };
}

test("invoice backend rejects totals that do not reconcile with item lines", async () => {
  let queryCount = 0;
  const sql = { query: async () => { queryCount += 1; return []; } };
  const response = await handleERPRequest(requestFor("invoices", "POST", {
    invoice_number: "JBI-QA-001",
    source: "manual",
    customer_name: "Cliente QA",
    currency: "USD",
    exchange_rate: 36.6,
    subtotal_usd: 18,
    discount_usd: 0,
    delivery_fee_usd: 0,
    total_usd: 18,
    paid_usd: 0,
    items: [{
      product_id: "00000000-0000-0000-0000-000000000101",
      product_name: "Perfume QA",
      quantity: 1,
      unit_price_usd: 20
    }]
  }), {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVOICE_TOTAL_MISMATCH");
  assert.equal(queryCount, 0);
});

test("web invoice rejects items or prices that differ from the original order", async () => {
  let writeAttempted = false;
  const sql = {
    query: async (query) => {
      if (query.startsWith("SELECT o.order_number")) {
        return [{
          order_number: "JP-1001",
          customer_name: "Cliente QA",
          discount_usd: "0.00",
          delivery_fee_usd: "0.00",
          total_usd: "50.00",
          product_id: "00000000-0000-0000-0000-000000000101",
          product_name: "Perfume QA",
          sku_snapshot: "QA-001",
          quantity: 2,
          unit_price_usd: "25.00"
        }];
      }
      writeAttempted = true;
      return [];
    }
  };
  const response = await handleERPRequest(requestFor("invoices", "POST", {
    invoice_number: "JBI-QA-002",
    source: "web",
    order_id: "00000000-0000-0000-0000-000000000201",
    order_number_snapshot: "JP-1001",
    customer_name: "Cliente QA",
    currency: "USD",
    exchange_rate: 36.6,
    subtotal_usd: 25,
    discount_usd: 0,
    delivery_fee_usd: 0,
    total_usd: 25,
    paid_usd: 0,
    items: [{
      product_id: "00000000-0000-0000-0000-000000000101",
      product_name: "Perfume QA",
      quantity: 1,
      unit_price_usd: 25
    }]
  }), {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "WEB_ORDER_ITEMS_MISMATCH");
  assert.equal(writeAttempted, false);
});

test("an invoiced web order cannot be cancelled and return stock automatically", async () => {
  const statements = [];
  const sql = {
    query: async (query) => {
      statements.push(query);
      if (query.startsWith("SELECT 1 FROM invoices")) return [{ "?column?": 1 }];
      return [];
    }
  };
  const response = await handleERPRequest(requestFor(
    "orders/00000000-0000-0000-0000-000000000201",
    "PATCH",
    { status: "Cancelado" }
  ), {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "ORDER_ALREADY_INVOICED");
  assert.match(statements[0], /linked_invoice/);
  assert.match(statements[0], /SUM\(quantity_delta\)/);
});

test("order status calculation uses net stock movements rather than historical negative rows", async () => {
  let executedSql = "";
  const sql = {
    query: async (query) => {
      executedSql = query;
      return [{ id: "00000000-0000-0000-0000-000000000201", status: "En preparación" }];
    }
  };
  const response = await handleERPRequest(requestFor(
    "orders/00000000-0000-0000-0000-000000000201",
    "PATCH",
    { status: "En preparación" }
  ), {}, owner, sql);
  assert.equal(response.status, 200);
  assert.match(executedSql, /BOOL_AND/);
  assert.match(executedSql, /SUM\(quantity_delta\)/);
  assert.match(executedSql, /linked_invoice\.is_invoiced/);
});


test("financial snapshot uses invoice totals including discount and delivery, not only line subtotals", () => {
  const start = appSource.indexOf("  function financialSnapshot(){");
  const end = appSource.indexOf("\n  function renderDashboard", start);
  assert.ok(start >= 0 && end > start, "financial snapshot function must remain available");
  const calculate = new Function(
    "invoices", "expenses", "roundMoney",
    appSource.slice(start, end) + "\nreturn financialSnapshot();"
  );
  const result = calculate(
    [{
      totalUsd: 100,
      subtotalUsd: 80,
      discountUsd: 0,
      deliveryFeeUsd: 20,
      items: [
        { quantity: 2, unitPriceUsd: 40, unitCostUsd: 20 }
      ]
    }],
    [{ amountUsd: 10 }],
    value => Math.round(value * 100) / 100
  );
  assert.deepEqual(result, {
    revenue: 100,
    productNetSales: 80,
    deliveryIncome: 20,
    costOfSales: 40,
    grossProfit: 40,
    operatingExpenses: 10,
    netProfit: 50
  });
});

test("order creation rejects a total that does not reconcile with lines and fees", async () => {
  let queryCount = 0;
  const sql = { query: async () => { queryCount += 1; return []; } };
  const response = await handleERPRequest(requestFor("orders", "POST", {
    order_number: "JP-QA-001",
    customer_name: "Cliente QA",
    currency: "USD",
    exchange_rate: 36.6,
    original_amount: 49,
    total_usd: 49,
    discount_usd: 0,
    delivery_fee_usd: 0,
    items: [{
      product_id: "00000000-0000-0000-0000-000000000101",
      product_name: "Perfume QA",
      quantity: 2,
      unit_price_usd: 25
    }]
  }), {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "ORDER_TOTAL_MISMATCH");
  assert.equal(queryCount, 0);
});

test("order creation ignores client-supplied terminal state and starts as pending", async () => {
  let call = 0;
  let insertParams = [];
  const sql = {
    query: async (query, params) => {
      call += 1;
      if (call === 1) return [{ id: "00000000-0000-0000-0000-000000000101" }];
      insertParams = params;
      return [{ id: "00000000-0000-0000-0000-000000000201", status: insertParams[4] }];
    }
  };
  const response = await handleERPRequest(requestFor("orders", "POST", {
    order_number: "JP-QA-002",
    customer_name: "Cliente QA",
    currency: "USD",
    exchange_rate: 36.6,
    original_amount: 50,
    total_usd: 50,
    discount_usd: 0,
    delivery_fee_usd: 0,
    status: "Completado",
    payment_status: "Pagado",
    items: [{
      product_id: "00000000-0000-0000-0000-000000000101",
      product_name: "Perfume QA",
      quantity: 2,
      unit_price_usd: 25
    }]
  }), {}, owner, sql);
  assert.equal(response.status, 201);
  assert.equal(insertParams[4], "Pendiente");
  assert.equal(insertParams[5], "Pendiente");
});


const validWebInvoiceBody = {
  invoice_number: "JBI-QA-WEB-001",
  source: "web",
  order_id: "00000000-0000-0000-0000-000000000201",
  order_number_snapshot: "JP-1001",
  customer_name: "Cliente QA",
  currency: "USD",
  exchange_rate: 36.6,
  subtotal_usd: 50,
  discount_usd: 0,
  delivery_fee_usd: 0,
  total_usd: 50,
  paid_usd: 0,
  items: [{
    product_id: "00000000-0000-0000-0000-000000000101",
    product_name: "Perfume QA",
    sku_snapshot: "QA-001",
    quantity: 2,
    unit_price_usd: 25,
    unit_cost_usd: 10
  }]
};

const webOrderSnapshot = [{
  order_number: "JP-1001",
  customer_name: "Cliente QA",
  discount_usd: "0.00",
  delivery_fee_usd: "0.00",
  total_usd: "50.00",
  product_id: "00000000-0000-0000-0000-000000000101",
  product_name: "Perfume QA",
  sku_snapshot: "QA-001",
  quantity: 2,
  unit_price_usd: "25.00"
}];

test("valid web invoice locks its order and product rows before posting stock", async () => {
  let writeSql = "";
  let call = 0;
  const sql = {
    query: async (query) => {
      call += 1;
      if (call === 1) return webOrderSnapshot;
      writeSql = query;
      return [{ id: "00000000-0000-0000-0000-000000000301", invoice_number: "JBI-QA-WEB-001" }];
    }
  };
  const response = await createInvoice(sql, owner, validWebInvoiceBody);
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.record.invoice_number, "JBI-QA-WEB-001");
  assert.match(writeSql, /web_order_lock/);
  assert.match(writeSql, /lock_gate/);
  assert.match(writeSql, /FOR UPDATE OF p/);
  assert.match(writeSql, /p\.unit_cost_usd/);
  assert.match(writeSql, /COALESCE\(t\.unit_cost_usd,0\)/);
  assert.match(writeSql, /SUM\(quantity_delta\)/);
});

test("unique database constraint returns an explicit duplicate web invoice conflict", async () => {
  let call = 0;
  const sql = {
    query: async () => {
      call += 1;
      if (call === 1) return webOrderSnapshot;
      const error = new Error("duplicate web invoice");
      error.code = "23505";
      error.constraint = "invoices_order_id_unique_idx";
      throw error;
    }
  };
  const response = await createInvoice(sql, owner, validWebInvoiceBody);
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "DUPLICATE_WEB_INVOICE");
});


test("new product unit cost is derived from purchase and additional costs", async () => {
  let insertParams = [];
  const sql = {
    query: async (query, params) => {
      insertParams = params;
      return [{ id: "00000000-0000-0000-0000-000000000401", name: "Producto QA" }];
    }
  };
  const response = await handleERPRequest(requestFor("products", "POST", {
    sku: "QA-COST-01",
    name: "Producto QA",
    purchase_cost_usd: 20,
    additional_cost_usd: 5,
    unit_cost_usd: 999,
    price_usd: 50,
    stock: 0
  }), {}, owner, sql);
  assert.equal(response.status, 201);
  assert.equal(insertParams[11], 25);
});

test("manual inventory movements cannot spoof order or invoice references", async () => {
  let insertParams = [];
  const sql = {
    query: async (query, params) => {
      insertParams = params;
      return [{
        id: "00000000-0000-0000-0000-000000000402",
        movement_type: "Entrada",
        quantity_delta: 1
      }];
    }
  };
  const response = await handleERPRequest(requestFor("inventory-movements", "POST", {
    product_id: "00000000-0000-0000-0000-000000000101",
    movement_type: "Entrada",
    quantity: 1,
    reference_type: "order",
    reference_id: "00000000-0000-0000-0000-000000000201"
  }), {}, owner, sql);
  assert.equal(response.status, 201);
  assert.equal(insertParams[4], "manual");
  assert.equal(insertParams[5], null);
});

test("manual cash entries cannot spoof automated payroll or invoice references", async () => {
  let insertParams = [];
  let queryCount = 0;
  const sql = {
    query: async (query, params) => {
      queryCount += 1;
      if (query.startsWith("SELECT id FROM cash_accounts")) return [{ id: "00000000-0000-0000-0000-000000000501" }];
      insertParams = params;
      return [{ id: "00000000-0000-0000-0000-000000000502" }];
    }
  };
  const response = await handleERPRequest(requestFor("cash_entries", "POST", {
    concept: "Movimiento manual QA",
    direction: "income",
    account_id: "00000000-0000-0000-0000-000000000501",
    currency: "USD",
    original_amount: 100,
    exchange_rate: 1,
    amount_usd: 100,
    source_type: "payroll",
    source_id: "00000000-0000-0000-0000-000000000601"
  }), {}, owner, sql);
  assert.equal(response.status, 201);
  assert.equal(queryCount, 2);
  assert.equal(insertParams[7], "manual");
  assert.equal(insertParams[8], null);
});


test("catalog batch import derives unit cost from purchase and additional cost", async () => {
  const sql = mockSql();
  await importProducts(sql, owner, {
    records: [{
      sku: "COST-IMP-01",
      name: "Perfume Cost QA",
      purchase_cost_usd: 20,
      additional_cost_usd: 5,
      unit_cost_usd: 999,
      stock: 0
    }]
  });
  const records = JSON.parse(sql.statements[1].params[0]);
  assert.equal(records[0].unit_cost_usd, 25);
});

test("editing a product cannot overwrite derived unit cost independently", async () => {
  let updateParams = [];
  const sql = {
    query: async (query, params) => {
      if (query.startsWith("SELECT purchase_cost_usd")) {
        return [{ purchase_cost_usd: "20.00", additional_cost_usd: "5.00" }];
      }
      updateParams = params;
      return [{ id: "00000000-0000-0000-0000-000000000101", unit_cost_usd: 25 }];
    }
  };
  const response = await handleERPRequest(requestFor(
    "products/00000000-0000-0000-0000-000000000101",
    "PATCH",
    { purchase_cost_usd: 20, additional_cost_usd: 5, unit_cost_usd: 999 }
  ), {}, owner, sql);
  assert.equal(response.status, 200);
  assert.equal(updateParams[2], 25);
});


test("generic PATCH cannot rewrite financial, cash, inventory or payroll ledgers", async () => {
  const immutable = [
    "inventory_movements",
    "cash_entries",
    "invoices",
    "purchases",
    "expenses",
    "cash_accounts",
    "hr_payroll_items",
    "hr_payroll_periods"
  ];
  for (const resource of immutable) {
    let queryCount = 0;
    const sql = { query: async () => { queryCount += 1; return []; } };
    const response = await handleERPRequest(requestFor(
      resource + "/00000000-0000-0000-0000-000000000701",
      "PATCH",
      { status: "Anulada", amount_usd: 0 }
    ), {}, owner, sql);
    const body = await response.json();
    assert.equal(response.status, 405, resource + " must not allow generic PATCH");
    assert.equal(body.error.code, "IMMUTABLE_TRANSACTION");
    assert.equal(queryCount, 0);
  }
});

test("generic PATCH cannot rewrite commercial order snapshots", async () => {
  let queryCount = 0;
  const sql = { query: async () => { queryCount += 1; return []; } };
  const response = await handleERPRequest(requestFor(
    "orders/00000000-0000-0000-0000-000000000702",
    "PATCH",
    { total_usd: 0, customer_name: "Otro cliente" }
  ), {}, owner, sql);
  const body = await response.json();
  assert.equal(response.status, 405);
  assert.equal(body.error.code, "ORDER_FIELDS_LOCKED");
  assert.equal(queryCount, 0);
});
