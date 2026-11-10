import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const compactCss = readFileSync(new URL("../../assets/css/ultra-compact.css", import.meta.url), "utf8");
const deviceCss = readFileSync(new URL("../../assets/css/device-responsive.css", import.meta.url), "utf8");

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


test("mobile account security controls stay aligned and compact across phone widths", async ({ page }) => {
  const markup = `
    <section class="access-manager-section">
      <div class="table-wrap">
        <table class="data-table mobile-record-table">
          <thead><tr><th>Cuenta</th><th>Seguridad</th></tr></thead>
          <tbody><tr>
            <td data-label="Cuenta"><strong>Trabajador de prueba</strong></td>
            <td class="user-access-controls" data-label="Seguridad y permisos">
              <label><input type="checkbox" checked> Cambio inicial</label>
              <button type="button" class="button button-primary button-small">Activar acceso</button>
              <details class="user-overrides"><summary>Excepciones (0)</summary><div class="permission-override-add"><select class="filter-select"><option>Exportar información</option></select><select class="filter-select"><option>Permitir</option></select><button class="button button-quiet button-small">Añadir</button></div></details>
              <button type="button" class="button button-quiet button-small">Guardar cuenta</button>
            </td>
          </tr></tbody>
        </table>
      </div>
    </section>
    <button class="button button-primary">Guardar cambios</button>
    <button class="button button-quiet button-small">Cancelar</button>
  `;
  await page.setContent(`<style>${compactCss}\n${deviceCss}</style>${markup}`);

  for (const width of [320, 360, 390, 428]) {
    await page.setViewportSize({ width, height: 844 });
    const checkbox = await page.locator(".user-access-controls input[type=checkbox]").boundingBox();
    const label = await page.locator(".user-access-controls > label").boundingBox();
    const activate = await page.getByRole("button", { name: "Activar acceso" }).boundingBox();
    const save = await page.getByRole("button", { name: "Guardar cuenta" }).boundingBox();
    const cell = await page.locator(".user-access-controls").boundingBox();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    expect(checkbox.width).toBeLessThanOrEqual(19);
    expect(checkbox.height).toBeLessThanOrEqual(19);
    expect(checkbox.x).toBeGreaterThanOrEqual(label.x);
    expect(Math.abs((checkbox.y + checkbox.height / 2) - (label.y + label.height / 2))).toBeLessThan(4);
    expect(label.width).toBeLessThan(220);
    expect(activate.width).toBeLessThan(cell.width * 0.85);
    expect(save.width).toBeLessThan(cell.width * 0.85);
    expect(activate.height).toBeGreaterThanOrEqual(38);
    expect(activate.height).toBeLessThanOrEqual(44);
    expect(overflow).toBe(false);
  }
});

test("mobile button scale preserves touch targets without stretching compact actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <style>${compactCss}\n${deviceCss}</style>
    <main style="width:100%;max-width:360px">
      <button class="button button-primary">Guardar cambios</button>
      <button class="button button-quiet button-small">Actualizar</button>
      <button class="icon-button" aria-label="Cerrar">×</button>
    </main>
  `);
  const primary = await page.locator(".button-primary").boundingBox();
  const compact = await page.locator(".button-small").boundingBox();
  const icon = await page.locator(".icon-button").boundingBox();
  expect(primary.height).toBeGreaterThanOrEqual(40);
  expect(compact.height).toBeGreaterThanOrEqual(36);
  expect(compact.height).toBeLessThanOrEqual(40);
  expect(icon.width).toBe(40);
  expect(icon.height).toBe(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
