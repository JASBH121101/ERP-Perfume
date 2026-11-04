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
      executedSql = query;
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
