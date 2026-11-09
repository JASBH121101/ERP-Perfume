import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../assets/js/app.js", import.meta.url), "utf8");

test("blank concentration is filtered from catalog output instead of printing a placeholder", () => {
  const start = app.indexOf("function catalogPrintDocument(items, includePrices)");
  const end = app.indexOf("async function generateCatalogPDF()", start);
  assert.ok(start >= 0 && end > start, "catalog print function should exist");
  const catalogMarkup = app.slice(start, end);
  assert.match(catalogMarkup, /product\.concentration/);
  assert.match(catalogMarkup, /\.filter\(value => String\(value \|\| ''\)\.trim\(\)\)/);
  assert.doesNotMatch(catalogMarkup, /concentraci[oó]n desconocida|sin concentraci[oó]n/i);
  const emptyConcentration = [ "Marca", "Caja original", "", "100 ml" ].filter(Boolean);
  assert.deepEqual(emptyConcentration, [ "Marca", "Caja original", "100 ml" ]);
});

test("internal invoice printout does not render concentration, whether populated or blank", () => {
  const start = app.indexOf("function invoiceDocumentMarkup(invoice)");
  const end = app.indexOf("function showInvoicePreview(invoiceId)", start);
  assert.ok(start >= 0 && end > start, "invoice print function should exist");
  const invoiceMarkup = app.slice(start, end);
  assert.match(invoiceMarkup, /item\.name/);
  assert.match(invoiceMarkup, /item\.sku/);
  assert.doesNotMatch(invoiceMarkup, /concentration/i);
});


test("blank concentration is omitted from the product detail field list", () => {
  const start = app.indexOf("function showProductDetails(productId)");
  const end = app.indexOf("function exportCsvFile", start);
  assert.ok(start >= 0 && end > start, "product detail function should exist");
  const detailMarkup = app.slice(start, end);
  assert.match(detailMarkup, /String\(product\.concentration \|\| ''\)\.trim\(\) \? \[\['Concentración'/);
});
