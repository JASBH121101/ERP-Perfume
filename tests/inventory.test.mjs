import test from "node:test";
import assert from "node:assert/strict";
import { createProduct, createInventoryMovement, reverseInventoryMovement, getInventorySummary, listInventoryStock, listInventoryMovements, resolveRoutePermission, handleERPRequest } from "../worker/src/erp.js";

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
    purchase_cost_usd: 18, additional_cost_usd: 2, price_usd: 42.5,
    authenticity_type: "inspired", inspired_by: "Creed Aventus"
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.stock, 4);
  assert.match(captured.statement, /INSERT INTO products/);
  assert.match(captured.statement, /INSERT INTO inventory_movements/);
  assert.match(captured.statement, /Existencias iniciales/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
  assert.equal(captured.values[13], 4);
  assert.equal(captured.values[19], null); // No supplier selected in this fixture.
  assert.equal(captured.values[25], "inspired");
  assert.equal(captured.values[26], "Creed Aventus");
  assert.equal(captured.values[27], actor.id);
});


test("product creation requires a valid authenticity classification and inspiration reference", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return [{ id: productId }]; } };
  const base = { sku: "QA-AUTH-01", name: "Perfume QA", stock: 0, price_usd: 20 };
  const invalidCases = [
    {},
    { authenticity_type: "counterfeit" },
    { authenticity_type: "inspired" },
    { authenticity_type: "inspired", inspired_by: " " },
    { authenticity_type: "inspired", inspired_by: "x".repeat(121) },
    { authenticity_type: "original", inspired_by: "Creed Aventus" },
    { authenticity_type: "generic", inspired_by: "Dior Sauvage" }
  ];
  for (const extra of invalidCases) {
    const result = await readResponse(await createProduct(sql, actor, { ...base, ...extra }));
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_PRODUCT_AUTHENTICITY");
  }
  assert.equal(calls, 0);
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


test("bootstrap movement visibility follows movement type permissions, not only delta sign", async () => {
  const movements = [
    { id: "entry-1", movement_type: "Entrada", quantity_delta: 4 },
    { id: "return-1", movement_type: "Devolucion", quantity_delta: 1 },
    { id: "exit-1", movement_type: "Salida", quantity_delta: -2 },
    { id: "adjust-up", movement_type: "Ajuste", quantity_delta: 3 },
    { id: "adjust-down", movement_type: "Ajuste", quantity_delta: -1 },
    { id: "reverse-in", movement_type: "Reversion", quantity_delta: 2 },
    { id: "reverse-out", movement_type: "Reversion", quantity_delta: -2 }
  ];

  async function bootstrap(sectionPermissions) {
    const permissionRows = [
      { permission_key: "inventory.view", parent_key: null, allowed: true },
      { permission_key: "inventory.receipts.view", parent_key: "inventory.view", allowed: sectionPermissions.inbound === true },
      { permission_key: "inventory.manual_out.view", parent_key: "inventory.view", allowed: sectionPermissions.outbound === true },
      { permission_key: "inventory.adjustments.view", parent_key: "inventory.view", allowed: sectionPermissions.adjustments === true },
      { permission_key: "purchases.view", parent_key: null, allowed: false },
      { permission_key: "purchases.receipts.view", parent_key: "purchases.view", allowed: false }
    ];
    const sql = {
      async query() { return permissionRows; },
      async transaction(callback) {
        const tx = (strings) => {
          const statement = strings.join(" ");
          return Promise.resolve(statement.includes("FROM inventory_movements") ? movements : []);
        };
        return Promise.all(callback(tx));
      }
    };
    const request = new Request("https://erp.test/api/erp/bootstrap");
    const response = await handleERPRequest(request, {}, {
      id: actor.id, role: "viewer"
    }, sql);
    return { response, data: await response.json() };
  }

  const inbound = await bootstrap({ inbound: true });
  assert.equal(inbound.response.status, 200);
  assert.deepEqual(inbound.data.data.inventory_movements.map(row => row.id), [
    "entry-1", "return-1", "reverse-in"
  ]);

  const outbound = await bootstrap({ outbound: true });
  assert.equal(outbound.response.status, 200);
  assert.deepEqual(outbound.data.data.inventory_movements.map(row => row.id), [
    "exit-1", "reverse-out"
  ]);

  const adjustments = await bootstrap({ adjustments: true });
  assert.equal(adjustments.response.status, 200);
  assert.deepEqual(adjustments.data.data.inventory_movements.map(row => row.id), [
    "adjust-up", "adjust-down"
  ]);

  const viewOnly = await bootstrap({});
  assert.equal(viewOnly.response.status, 200);
  assert.equal(Object.hasOwn(viewOnly.data.data, "inventory_movements"), false);
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


test("manual movement reversals append an opposite ledger row and record the actor", async () => {
  let captured = null;
  const responseRow = {
    movement_exists: true, is_reversal: false, is_manual: true, already_reversed: false,
    current_stock: 8, original_delta: 3, reversal_id: "qa-reversal-1",
    product_id: productId, previous_stock: 8, new_stock: 5,
    reversed_at: "2026-11-06T12:00:00.000Z"
  };
  const sql = {
    async query(statement, values) { captured = { statement, values }; return [responseRow]; }
  };
  const result = await readResponse(await reverseInventoryMovement(sql, actor, "00000000-0000-0000-0000-000000000501", {
    reason: "Entrada duplicada"
  }));
  assert.equal(result.status, 201);
  assert.equal(result.body.record.reversal_id, "qa-reversal-1");
  assert.match(captured.statement, /FOR UPDATE OF m/);
  assert.match(captured.statement, /FOR UPDATE OF p/);
  assert.match(captured.statement, /stock=p.stock-o.quantity_delta/);
  assert.match(captured.statement, /'Reversion'/);
  assert.match(captured.statement, /'reversal'/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
  assert.deepEqual(captured.values, ["00000000-0000-0000-0000-000000000501", actor.id, "Entrada duplicada"]);
});

test("movement reversals reject missing, linked, already-reversed and invalid-stock cases", async () => {
  const cases = [
    { row: { movement_exists: false }, expected: [404, "MOVEMENT_NOT_FOUND"] },
    { row: { movement_exists: true, is_reversal: true }, expected: [409, "REVERSAL_NOT_ALLOWED"] },
    { row: { movement_exists: true, is_reversal: false, is_manual: false }, expected: [409, "SOURCE_REVERSAL_REQUIRED"] },
    { row: { movement_exists: true, is_reversal: false, is_manual: true, already_reversed: true }, expected: [409, "MOVEMENT_ALREADY_REVERSED"] },
    { row: { movement_exists: true, is_reversal: false, is_manual: true, already_reversed: false, current_stock: 1, original_delta: 3 }, expected: [409, "REVERSAL_STOCK_CONFLICT"] }
  ];
  for (const item of cases) {
    const sql = { async query() { return [item.row]; } };
    const result = await readResponse(await reverseInventoryMovement(sql, actor, "00000000-0000-0000-0000-000000000501", {
      reason: "Corrección QA"
    }));
    assert.equal(result.status, item.expected[0]);
    assert.equal(result.body.error.code, item.expected[1]);
  }
});

test("movement reversal validates a reason before querying Neon", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  for (const reason of ["", "x", "x".repeat(241)]) {
    const result = await readResponse(await reverseInventoryMovement(sql, actor, "00000000-0000-0000-0000-000000000501", { reason }));
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_MOVEMENT_REVERSAL");
  }
  assert.equal(calls, 0);
});

test("manual reversal route requires the dedicated permission", () => {
  assert.equal(
    resolveRoutePermission("inventory-movements", "POST", "00000000-0000-0000-0000-000000000501", ["api","erp","inventory-movements","00000000-0000-0000-0000-000000000501","reverse"], {}),
    "inventory.movements.reverse"
  );
});


test("inventory history combines period, employee, supplier and document filters and returns auditable names", async () => {
  let captured = null;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        total: 1,
        records: [{
          id: "qa-movement-audit", product_id: productId, product_name: "Perfume QA",
          sku: "QA-UNIT-01", movement_type: "Entrada", quantity: 2, quantity_delta: 2,
          previous_stock: 0, new_stock: 2, actor_user_id: actor.id,
          actor_name: "Jared Blanco", supplier_name: "Proveedor QA",
          purchase_order_number: "1", created_at: "2026-11-08T12:00:00.000Z"
        }]
      }];
    }
  };
  const params = new URLSearchParams(
    "type=Entrada&from=2026-11-01&to=2026-11-30&actor=Jared&supplier=Proveedor&search=1"
  );
  const result = await readResponse(await listInventoryMovements(sql, params));
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.records[0].actor_name, "Jared Blanco");
  assert.equal(result.body.records[0].supplier_name, "Proveedor QA");
  assert.equal(result.body.records[0].purchase_order_number, "1");
  assert.deepEqual(captured.values, [
    "Entrada", "%Jared%", "%Proveedor%", "2026-11-01", "2026-11-30", "%1%", 25, 0
  ]);
  assert.match(captured.statement, /LEFT JOIN app_users u ON u\.id=im\.created_by/);
  assert.match(captured.statement, /LEFT JOIN purchase_receipts pr/);
  assert.match(captured.statement, /LEFT JOIN purchase_orders po/);
  assert.match(captured.statement, /u\.display_name/);
  assert.match(captured.statement, /po\.supplier_name/);
});

test("inventory history rejects oversized employee and supplier filters before database access", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  for (const query of [
    "actor=" + "x".repeat(121),
    "supplier=" + "x".repeat(121)
  ]) {
    const result = await readResponse(await listInventoryMovements(sql, new URLSearchParams(query)));
    assert.equal(result.status, 400, query.slice(0, 20));
    assert.equal(result.body.error.code, "INVALID_INVENTORY_FILTER");
  }
  assert.equal(calls, 0);
});
