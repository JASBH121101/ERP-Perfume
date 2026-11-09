import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, "Expected source marker: " + startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, "Expected source marker after: " + startMarker);
  return source.slice(start, end);
}

test("inventory product HTML escapes dynamic text and attribute values at the insertion sink", () => {
  const renderer = sectionBetween(
    appSource,
    "function renderInventoryProductRows()",
    "function renderInventory()"
  );
  assert.match(renderer, /body\.innerHTML\s*=\s*filtered\.map/);
  for (const expression of [
    "esc(product.name)",
    "esc(product.sku)",
    "esc(product.category || '—')",
    "esc(product.id)"
  ]) {
    assert.ok(renderer.includes(expression), "Expected escaped inventory value: " + expression);
  }
});

test("inventory pagination builds controls with DOM APIs instead of interpolated HTML", () => {
  const renderer = sectionBetween(
    appSource,
    "function renderInventoryProductRows()",
    "function renderInventory()"
  );
  assert.match(renderer, /pagination\.replaceChildren\(footer\)/);
  assert.match(renderer, /rangeLabel\.textContent=/);
  assert.match(renderer, /count\.textContent=/);
  assert.match(renderer, /previous\.disabled=state\.inventoryStockPage<=1/);
  assert.match(renderer, /next\.disabled=state\.inventoryStockPage>=pages/);
  assert.doesNotMatch(renderer, /pagination\.innerHTML\s*=/);
});

test("catalog import preview escapes CSV-derived values at the insertion sink", () => {
  const preview = sectionBetween(
    appSource,
    "const renderPreview=()=>{",
    "fileInput.addEventListener('change'"
  );
  assert.match(preview, /previewNode\.innerHTML\s*=.*records\.map/s);
  for (const expression of [
    "esc(record.sku)",
    "esc(record.name)",
    "esc(record.brand || '')"
  ]) {
    assert.ok(preview.includes(expression), "Expected escaped import value: " + expression);
  }
});
