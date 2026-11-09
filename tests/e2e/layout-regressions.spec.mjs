import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const compactCss = readFileSync(new URL("../../assets/css/ultra-compact.css", import.meta.url), "utf8");

test("opening a permission group does not stretch cards in the other column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setContent(`
    <style>${compactCss}</style>
    <section class="access-manager-section">
      <form id="role-permissions-form">
        <div class="permission-editor-grid">
          <div class="permission-editor-column">
            <details id="reports" class="permission-editor-module">
              <summary><span>Informes</span><small>3 / 3 permisos</small></summary>
              <div class="permission-editor-module-content">
                <label class="permission-editor-row"><input type="checkbox" checked><span>Exportar informes</span><small>Acción</small></label>
                <label class="permission-editor-row"><input type="checkbox" checked><span>Informes y análisis</span><small>Sección</small></label>
                <label class="permission-editor-row"><input type="checkbox" checked><span>Informes</span><small>Módulo</small></label>
              </div>
            </details>
            <details id="billing" class="permission-editor-module">
              <summary><span>Facturación</span><small>7 / 7 permisos</small></summary>
              <div class="permission-editor-module-content"><label class="permission-editor-row"><input type="checkbox"><span>Emitir factura</span><small>Acción</small></label></div>
            </details>
          </div>
          <div class="permission-editor-column">
            <details id="audit" class="permission-editor-module">
              <summary><span>Auditoría</span><small>0 / 3 permisos</small></summary>
              <div class="permission-editor-module-content"><label class="permission-editor-row"><input type="checkbox"><span>Consultar auditoría</span><small>Acción</small></label></div>
            </details>
            <details id="cash" class="permission-editor-module">
              <summary><span>Caja y bancos</span><small>3 / 3 permisos</small></summary>
              <div class="permission-editor-module-content"><label class="permission-editor-row"><input type="checkbox"><span>Ver caja</span><small>Acción</small></label></div>
            </details>
          </div>
        </div>
      </form>
    </section>
  `);

  const auditBefore = await page.locator("#audit").boundingBox();
  const cashBefore = await page.locator("#cash").boundingBox();
  await page.locator("#reports > summary").click();
  const reportsAfter = await page.locator("#reports").boundingBox();
  const auditAfter = await page.locator("#audit").boundingBox();
  const cashAfter = await page.locator("#cash").boundingBox();

  expect(reportsAfter.height).toBeGreaterThan(auditAfter.height);
  expect(auditAfter.height).toBeCloseTo(auditBefore.height, 0);
  expect(cashAfter.y).toBeCloseTo(cashBefore.y, 0);
  expect(await page.locator(".permission-editor-grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(2);
});

test("purchase history search and filters reflow cleanly at 150 percent effective width", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 850 });
  await page.setContent(`
    <style>${compactCss}</style>
    <article class="list-panel purchase-history-tools">
      <div class="toolbar">
        <div class="toolbar-left"><label class="inline-search"><input type="search" placeholder="Orden, proveedor, producto o factura"></label></div>
        <div class="toolbar-right">
          <select class="filter-select"><option>Todos los proveedores</option></select>
          <select class="filter-select"><option>Todas las órdenes</option></select>
          <select class="filter-select"><option>Todas las recepciones</option></select>
          <input class="filter-select" type="date">
          <input class="filter-select" type="date">
          <button class="button button-quiet button-small">Limpiar filtros</button>
        </div>
      </div>
    </article>
  `);

  const search = await page.locator(".toolbar-left").boundingBox();
  const filters = await page.locator(".toolbar-right").boundingBox();
  const searchColumns = await page.locator(".toolbar").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  const filterColumns = await page.locator(".toolbar-right").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(search.width).toBeGreaterThan(800);
  expect(filters.y).toBeGreaterThan(search.y + search.height - 1);
  expect(searchColumns).toBe(1);
  expect(filterColumns).toBe(3);

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopSearch = await page.locator(".toolbar-left").boundingBox();
  const desktopFilters = await page.locator(".toolbar-right").boundingBox();
  expect(desktopFilters.x).toBeGreaterThan(desktopSearch.x + desktopSearch.width);
});

test("procurement tabs and actions retain distinct button surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`
    <style>${compactCss}</style>
    <nav class="purchase-module-tabs">
      <button class="purchase-module-tab is-active"><span>Órdenes</span><span class="purchase-tab-count">0</span></button>
      <button class="purchase-module-tab"><span>Recepciones</span><span class="purchase-tab-count">0</span></button>
      <button class="purchase-module-tab"><span>Nueva orden</span></button>
    </nav>
    <button class="button button-primary">Guardar</button>
    <button class="button button-quiet">Cancelar</button>
  `);
  const nav = await page.locator(".purchase-module-tabs").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  const inactive = await page.locator(".purchase-module-tab").nth(1).evaluate(el => {
    const css = getComputedStyle(el);
    return { background: css.backgroundColor, border: css.borderTopWidth, height: el.getBoundingClientRect().height };
  });
  const primary = await page.locator(".button-primary").evaluate(el => getComputedStyle(el).backgroundImage);
  expect(nav).toBe(3);
  expect(inactive.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(inactive.border).not.toBe("0px");
  expect(inactive.height).toBeGreaterThanOrEqual(44);
  expect(primary).toContain("gradient");
});
