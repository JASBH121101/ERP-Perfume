import test from "node:test";
import assert from "node:assert/strict";
import { createProduct, createInventoryMovement, getInventorySummary, listInventoryStock, listInventoryMovements, resolveRoutePermission } from "../worker/src/erp.js";

const actor = { id: "00000000-0000-0000-0000-000000000099", role: "owner" };
const productId = "00000000-0000-0000-0000-000000000101";

async function readResponse(response) {
  return { status: response.status, body: await response.json() };
}

test("product creation stores opening stock and its initial movement in one SQL statement", async () => {
  let captured = null;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{ id: productId, sku: "QA-UNIT-01", name: "Perfume QA", stock: 4 }];
    }
  };

  const result = await readResponse(await createProduct(sql, actor, {
    sku: "QA-UNIT-01", name: "Perfume QA", stock: 4, min_stock: 2,
    purchase_cost_usd: 18, additional_cost_usd: 2, price_usd: 42.5
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.stock, 4);
  assert.match(captured.statement, /INSERT INTO products/);
  assert.match(captured.statement, /INSERT INTO inventory_movements/);
  assert.match(captured.statement, /Existencias iniciales/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
  assert.equal(captured.values[13], 4);
  assert.equal(captured.values[24], actor.id);
});

test("product creation rejects invalid opening stock before reaching Neon", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  for (const stock of [-1, 1.5, "not-a-number"]) {
    const result = await readResponse(await createProduct(sql, actor, {
      sku: "QA-INVALID", name: "Producto inválido", stock, price_usd: 10
    }));
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_PRODUCT");
  }
  assert.equal(calls, 0);
});

test("manual stock movements lock the product row and write an auditable ledger entry", async () => {
  let captured = null;
  const movement = {
    id: "qa-movement-1", product_id: productId, movement_type: "Entrada",
    quantity: 3, quantity_delta: 3, previous_stock: 5, new_stock: 8,
    note: "Recepción QA", created_at: "2026-11-05T12:00:00.000Z"
  };
  const sql = {
    async query(statement, values) { captured = { statement, values }; return [movement]; }
  };

  const result = await readResponse(await createInventoryMovement(sql, actor, {
    product_id: productId, movement_type: "Entrada", quantity: 3, note: "Recepción QA"
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.new_stock, 8);
  assert.match(captured.statement, /FOR UPDATE/);
  assert.match(captured.statement, /c\.previous_stock\+c\.delta>=0/);
  assert.match(captured.statement, /INSERT INTO inventory_movements/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
  assert.deepEqual(captured.values, [productId, "Entrada", 3, "Recepción QA", actor.id]);
});

test("manual stock movements reject invalid, fractional and unbounded quantities before querying Neon", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const cases = [
    { product_id: productId, movement_type: "Salida", quantity: 0 },
    { product_id: productId, movement_type: "Entrada", quantity: 1.25 },
    { product_id: productId, movement_type: "Reversion", quantity: 1 },
    { product_id: productId, movement_type: "Ajuste", quantity: 1, note: "x".repeat(121) },
    { product_id: productId, movement_type: "Entrada", quantity: 2147483648 }
  ];
  for (const payload of cases) {
    const result = await readResponse(await createInventoryMovement(sql, actor, payload));
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_MOVEMENT");
  }
  assert.equal(calls, 0);
});

test("an issue or unchanged adjustment that cannot change stock returns a conflict", async () => {
  const sql = { async query() { return []; } };
  const issue = await readResponse(await createInventoryMovement(sql, actor, {
    product_id: productId, movement_type: "Salida", quantity: 6, note: "No hay stock suficiente"
  }));
  const adjustment = await readResponse(await createInventoryMovement(sql, actor, {
    product_id: productId, movement_type: "Ajuste", quantity: 5, note: "Conteo sin variación"
  }));
  assert.equal(issue.status, 409);
  assert.equal(issue.body.error.code, "STOCK_CONFLICT");
  assert.equal(adjustment.status, 409);
  assert.equal(adjustment.body.error.code, "STOCK_CONFLICT");
});

test("database identifier errors are converted into a client error", async () => {
  const sql = {
    async query() { throw Object.assign(new Error("invalid uuid"), { code: "22P02" }); }
  };
  const result = await readResponse(await createInventoryMovement(sql, actor, {
    product_id: "not-a-uuid", movement_type: "Entrada", quantity: 1
  }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_PRODUCT_ID");
});


test("inventory summary is calculated by PostgreSQL across the full active catalog", async () => {
  let captured = null;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        active_products: "125",
        total_units: "748",
        out_of_stock: "4",
        low_stock: "11",
        healthy_stock: "110",
        categories: ["Diseñador", "Nicho"]
      }];
    }
  };
  const result = await readResponse(await getInventorySummary(sql));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.summary, {
    activeProducts: 125, totalUnits: 748, outOfStock: 4, lowStock: 11, healthyStock: 110
  });
  assert.deepEqual(result.body.categories, ["Diseñador", "Nicho"]);
  assert.match(captured.statement, /COUNT\(\*\) FILTER \(WHERE active=TRUE/);
  assert.match(captured.statement, /SUM\(stock\) FILTER \(WHERE active=TRUE/);
  assert.equal(captured.values, undefined);
});

test("inventory stock list uses safe parameterized filters and database pagination", async () => {
  let captured = null;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        total: 21,
        records: [{
          id: productId, name: "Perfume QA", sku: "QA-UNIT-01", stock: 2,
          min_stock: 3, category: "Diseñador", active: true
        }]
      }];
    }
  };
  const params = new URLSearchParams("page=2&page_size=10&search=Chanel&category=Dise%C3%B1ador&status=low");
  const result = await readResponse(await listInventoryStock(sql, params));
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 21);
  assert.equal(result.body.page, 2);
  assert.equal(result.body.pageSize, 10);
  assert.equal(result.body.totalPages, 3);
  assert.equal(result.body.records[0].sku, "QA-UNIT-01");
  assert.deepEqual(captured.values, ["%Chanel%", "Diseñador", 10, 10]);
  assert.match(captured.statement, /ILIKE \$1/);
  assert.match(captured.statement, /category = \$2/);
  assert.match(captured.statement, /stock > 0 AND stock <= min_stock/);
  assert.match(captured.statement, /LIMIT \$3 OFFSET \$4/);
  assert.doesNotMatch(captured.statement, /Chanel|Diseñador/);
});

test("inventory stock list rejects malformed paging and filters before database access", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const cases = [
    "page=0",
    "page=-1",
    "page=1.5",
    "page_size=101",
    "page_size=0",
    "status=negative",
    "search=" + "x".repeat(121),
    "category=" + "x".repeat(121)
  ];
  for (const query of cases) {
    const result = await readResponse(await listInventoryStock(sql, new URLSearchParams(query)));
    assert.equal(result.status, 400, query);
  }
  assert.equal(calls, 0);
});

test("inventory movement history applies role-specific visibility and complete date/search filters", async () => {
  let captured = null;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        total: 31,
        records: [{
          id: "qa-movement-1", product_id: productId, product_name: "Perfume QA",
          sku: "QA-UNIT-01", movement_type: "Salida", quantity: 2,
          quantity_delta: -2, previous_stock: 8, new_stock: 6,
          created_at: "2026-11-07T12:00:00.000Z"
        }]
      }];
    }
  };
  const context = {
    owner: false,
    permissions: [
      { key: "inventory.manual_out.view", parentKey: null, allowed: true }
    ]
  };
  const params = new URLSearchParams(
    "page=2&page_size=20&type=Salida&from=2026-11-01&to=2026-11-07&product_id=" +
    productId + "&search=Perfume"
  );
  const result = await readResponse(await listInventoryMovements(sql, params, context));
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 31);
  assert.equal(result.body.page, 2);
  assert.equal(result.body.pageSize, 20);
  assert.equal(result.body.totalPages, 2);
  assert.equal(result.body.records[0].movement_type, "Salida");
  assert.deepEqual(captured.values, [
    "Salida", productId, "2026-11-01", "2026-11-07", "%Perfume%", 20, 20
  ]);
  assert.match(captured.statement, /im\.movement_type='Salida'/);
  assert.match(captured.statement, /im\.movement_type = \$1/);
  assert.match(captured.statement, /im\.product_id = \$2::uuid/);
  assert.match(captured.statement, /im\.created_at >= \$3::date/);
  assert.match(captured.statement, /im\.created_at < \(\$4::date \+ INTERVAL '1 day'\)/);
  assert.match(captured.statement, /LIMIT \$6 OFFSET \$7/);
  assert.doesNotMatch(captured.statement, /Perfume|2026-11/);
});

test("inventory movement history rejects invalid dates, date ranges and unauthorized movement visibility", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const owner = { owner: true, permissions: [] };
  for (const query of [
    "from=2026-02-30",
    "from=2026-11-08&to=2026-11-07",
    "type=Unexpected",
    "page_size=101",
    "product_id=not-a-uuid"
  ]) {
    const result = await readResponse(await listInventoryMovements(sql, new URLSearchParams(query), owner));
    assert.equal(result.status, 400, query);
  }
  const denied = await readResponse(await listInventoryMovements(sql, new URLSearchParams(), {
    owner: false, permissions: []
  }));
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, "INVENTORY_MOVEMENT_VIEW_FORBIDDEN");
  assert.equal(calls, 0);
});

test("movement visibility never exposes inbound rows to a user with outbound-only permission", async () => {
  let captured = "";
  const sql = {
    async query(statement) {
      captured = statement;
      return [{ total: 0, records: [] }];
    }
  };
  const context = {
    owner: false,
    permissions: [{ key: "inventory.manual_out.view", parentKey: null, allowed: true }]
  };
  const result = await readResponse(await listInventoryMovements(sql, new URLSearchParams(), context));
  assert.equal(result.status, 200);
  assert.match(captured, /im\.movement_type='Salida'/);
  assert.doesNotMatch(captured, /im\.movement_type IN \('Entrada','Devolucion'\)/);
  assert.doesNotMatch(captured, /im\.movement_type='Ajuste'/);
});


test("inventory read routes use the module permission while movement writes retain granular permissions", () => {
  assert.equal(resolveRoutePermission("inventory-summary", "GET"), "inventory.view");
  assert.equal(resolveRoutePermission("inventory-stock", "GET"), "inventory.view");
  assert.equal(resolveRoutePermission("inventory-movements", "GET"), "inventory.view");
  assert.equal(resolveRoutePermission("inventory-movements", "POST", null, [], {
    movement_type: "Entrada"
  }), "inventory.receipts.receive");
  assert.equal(resolveRoutePermission("inventory-movements", "POST", null, [], {
    movement_type: "Salida"
  }), "inventory.manual_out.create");
  assert.equal(resolveRoutePermission("inventory-movements", "POST", null, [], {
    movement_type: "Ajuste"
  }), "inventory.adjustments.adjust");
});
