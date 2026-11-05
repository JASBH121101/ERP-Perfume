import test from "node:test";
import assert from "node:assert/strict";
import { createProduct, createInventoryMovement } from "../worker/src/erp.js";

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
  assert.equal(captured.values[25], actor.id);
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
