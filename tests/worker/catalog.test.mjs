import test from "node:test";
import assert from "node:assert/strict";
import { handleCatalogApi } from "../../worker/src/catalog.js";

const USER_ID = "2e4d7bf8-9f73-4f4e-a07d-4d62bfe31435";
const PRODUCT_ID = "cbf4c122-c5da-4ad3-9a48-918aa45476f8";

function makeContext({ role = "owner", query = async () => [], denied = false } = {}) {
  const calls = [];
  const sql = {
    async query(statement, parameters) {
      calls.push({ statement, parameters });
      return query(statement, parameters);
    }
  };
  const errorResponse = (status, code, message) =>
    new Response(JSON.stringify({ error: { code, message } }), {
      status,
      headers: { "content-type": "application/json" }
    });
  return {
    calls,
    requireUser: async () => denied
      ? { response: errorResponse(403, "INSUFFICIENT_ROLE", "Not authorized.") }
      : { user: { id: USER_ID, role }, sql },
    json: (body, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" }
    }),
    errorResponse
  };
}

function request(path, method = "GET", body) {
  return new Request("https://erp.test" + path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
}

test("catalog bootstrap denies unauthorized roles before querying Neon", async () => {
  const ctx = makeContext({ denied: true });
  const response = await handleCatalogApi(request("/api/erp/bootstrap"), {}, ctx);
  assert.equal(response.status, 403);
  assert.equal(ctx.calls.length, 0);
});

test("product creation rejects missing SKU/name/price without a database write", async () => {
  const ctx = makeContext();
  const response = await handleCatalogApi(
    request("/api/catalog/products", "POST", { name: "Perfume without SKU" }),
    {},
    ctx
  );
  assert.equal(response.status, 400);
  assert.equal(ctx.calls.length, 0);
});

test("product creation uses a single atomic insert and audit query", async () => {
  const row = {
    id: PRODUCT_ID, sku: "JBP-QA-001", name: "QA Fragrance",
    purchase_cost_usd: "12.00", additional_cost_usd: "1.00",
    unit_cost_usd: "13.00", price_usd: "25.00", stock: 0,
    min_stock: 2, active: true, images: []
  };
  const ctx = makeContext({ query: async (statement) => {
    assert.match(statement, /WITH saved AS \(INSERT INTO products/);
    assert.match(statement, /INSERT INTO audit_log/);
    return [row];
  }});
  const response = await handleCatalogApi(
    request("/api/catalog/products", "POST", {
      sku: "JBP-QA-001", name: "QA Fragrance",
      purchaseCost: 12, additionalCost: 1, price: 25, minStock: 2
    }),
    {},
    ctx
  );
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.product.id, PRODUCT_ID);
  assert.equal(body.product.stock, 0);
  assert.equal(ctx.calls.length, 1);
});

test("product updates reject malformed UUIDs before database access", async () => {
  const ctx = makeContext();
  const response = await handleCatalogApi(
    request("/api/catalog/products/not-a-uuid", "PATCH", { active: false }),
    {},
    ctx
  );
  assert.equal(response.status, 400);
  assert.equal(ctx.calls.length, 0);
});

test("product deletion preserves records that have inventory or commercial history", async () => {
  const ctx = makeContext({ query: async () => [{ has_history: true }] });
  const response = await handleCatalogApi(
    request("/api/catalog/products/" + PRODUCT_ID, "DELETE"),
    {},
    ctx
  );
  assert.equal(response.status, 409);
  assert.equal(ctx.calls.length, 1);
});

test("inventory movements reject zero-quantity entries", async () => {
  const ctx = makeContext();
  const response = await handleCatalogApi(
    request("/api/inventory/movements", "POST", {
      productId: PRODUCT_ID, type: "entry", quantity: 0
    }),
    {},
    ctx
  );
  assert.equal(response.status, 400);
  assert.equal(ctx.calls.length, 0);
});

test("unknown API paths are left to the Worker router", async () => {
  const ctx = makeContext();
  const response = await handleCatalogApi(request("/api/not-a-route"), {}, ctx);
  assert.equal(response, null);
  assert.equal(ctx.calls.length, 0);
});
