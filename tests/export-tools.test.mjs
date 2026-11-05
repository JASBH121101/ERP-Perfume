import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  serializeCsv,
  serializeExcelXml,
  renderPrintableHtml,
  safeExportFilename
} from "../assets/js/export-tools.mjs";

const dataset = {
  title: "Catálogo de productos",
  fileBase: "jb-parfums-productos",
  headers: ["Producto", "Precio", "Nota"],
  rows: [["Ámbar", 25.5, 'Texto, con "comillas"'], ["=HYPERLINK(\"https://x\")", 0, "<script>"]]
};

describe("ERP export tools", () => {
  it("serializes UTF-8 CSV with quoted cells and escaped quotes", () => {
    const csv = serializeCsv(dataset);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes('"Texto, con ""comillas"""'));
    assert.ok(csv.includes("\"'=HYPERLINK"));
    assert.ok(csv.includes("\r\n"));
  });

  it("serializes Excel-compatible XML with typed numeric cells", () => {
    const xml = serializeExcelXml(dataset);
    assert.ok(xml.startsWith('<?xml version="1.0"'));
    assert.ok(xml.includes('ss:Type="Number">25.5'));
    assert.ok(xml.includes('ss:Type="String">&apos;=HYPERLINK'));
    assert.ok(xml.includes("&lt;script&gt;"));
    assert.ok(xml.includes('ss:StyleID="Header"'));
  });

  it("escapes user content in the printable PDF source", () => {
    const html = renderPrintableHtml(dataset, "05/11/2026");
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("&quot;"));
    assert.equal((html.match(/<script>/g)||[]).length, 1);
    assert.ok(html.includes("<td>&lt;script&gt;</td>"));
    assert.ok(html.includes("window.print()"));
    assert.ok(html.includes("05/11/2026"));
  });

  it("creates a safe filename without accents or path characters", () => {
    assert.equal(safeExportFilename("Cuentas por cobrar / Nómina", "csv"), "cuentas-por-cobrar-nomina.csv");
  });

  it("supports empty datasets without producing invalid table markup", () => {
    const html = renderPrintableHtml({ title: "Sin datos", headers: ["Código"], rows: [] });
    assert.ok(html.includes('colspan="1"'));
    assert.ok(html.includes("No hay registros para mostrar."));
    assert.ok(serializeCsv({ headers: ["Código"], rows: [] }).includes('"Código"'));
  });
});
