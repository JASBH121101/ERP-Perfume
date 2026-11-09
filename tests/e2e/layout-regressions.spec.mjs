import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const compactCss = readFileSync(new URL("../../assets/css/ultra-compact.css", import.meta.url), "utf8");

test("permission accordions rebalance masonry columns when sections expand and collapse", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const modules = Array.from({ length: 8 }, (_, index) => {
    const expanded = [0, 4].includes(index);
    const rows = Array.from({ length: expanded ? 6 : 1 }, (_, row) =>
      '<label class="permission-editor-row"><input type="checkbox"><span>Permiso ' + (index + 1) + '.' + (row + 1) + '</span><small>Acción</small></label>'
    ).join("");
    return '<details class="permission-editor-module"' + (expanded ? ' open' : '') + '><summary><span>Módulo ' + (index + 1) + '</span><small>1 / 3 permisos</small></summary><div class="permission-editor-module-content">' + rows + '</div></details>';
  }).join("");

  await page.setContent(`
    <style>${compactCss}</style>
    <section class="access-manager-section">
      <form id="role-permissions-form">
        <div class="permission-editor-grid">${modules}</div>
      </form>
    </section>
  `);

  const grid = page.locator(".permission-editor-grid");
  const cards = page.locator(".permission-editor-module");
  const measureColumns = async () => grid.evaluate(el => {
    const rects = [...el.querySelectorAll(".permission-editor-module")].map(node => {
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), top: rect.top, bottom: rect.bottom };
    });
    const groups = new Map();
    for (const rect of rects) {
      const bucket = groups.get(rect.left) || [];
      bucket.push(rect);
      groups.set(rect.left, bucket);
    }
    return [...groups.values()].map(items => ({
      count: items.length,
      height: Math.max(...items.map(item => item.bottom)) - Math.min(...items.map(item => item.top))
    }));
  });

  const initialColumns = await measureColumns();
  expect(await grid.evaluate(el => getComputedStyle(el).columnCount)).toBe("2");
  expect(initialColumns).toHaveLength(2);
  expect(initialColumns.every(column => column.count >= 2)).toBe(true);
  expect(Math.abs(initialColumns[0].height - initialColumns[1].height)).toBeLessThan(140);

  // Expanding a third module must rebalance the cards rather than preserve
  // a fixed even/odd assignment with one tall, visually empty neighboring area.
  await cards.nth(2).locator("> summary").click();
  const afterExpand = await measureColumns();
  expect(afterExpand).toHaveLength(2);
  expect(Math.abs(afterExpand[0].height - afterExpand[1].height)).toBeLessThan(180);

  await cards.nth(0).locator("> summary").click();
  const afterCollapse = await measureColumns();
  expect(afterCollapse).toHaveLength(2);
  expect(Math.abs(afterCollapse[0].height - afterCollapse[1].height)).toBeLessThan(140);
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
