import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const workerPattern = /\/api\/erp\/[^?]+/;
const apiBase = 'https://jb-parfums-erp-api.jaredblancoh19.workers.dev';
const fixture = {
  products: [
    {
      id: '00000000-0000-0000-0000-000000000101', sku: 'QA-001',
      name: 'QA Fixture Perfume', brand: 'QA Maison', category: 'Diseñador',
      purchase_cost_usd: 20, additional_cost_usd: 5, unit_cost_usd: 25,
      price_usd: 50, stock: 5, min_stock: 1, active: true, images: []
    },
    {
      id: '00000000-0000-0000-0000-000000000102', sku: 'QA-002',
      name: 'QA Low Stock Perfume', brand: 'QA Maison', category: 'Árabes',
      purchase_cost_usd: 12, additional_cost_usd: 2, unit_cost_usd: 14,
      price_usd: 30, stock: 1, min_stock: 3, active: true, images: []
    },
    {
      id: '00000000-0000-0000-0000-000000000103', sku: 'QA-003',
      name: 'QA Out of Stock Perfume', brand: 'QA Maison', category: 'Diseñador',
      purchase_cost_usd: 10, additional_cost_usd: 0, unit_cost_usd: 10,
      price_usd: 25, stock: 0, min_stock: 2, active: true, images: []
    },
    {
      id: '00000000-0000-0000-0000-000000000104', sku: 'QA-004',
      name: 'QA Archived Perfume', brand: 'QA Maison', category: 'Árabes',
      purchase_cost_usd: 8, additional_cost_usd: 0, unit_cost_usd: 8,
      price_usd: 20, stock: 4, min_stock: 2, active: false, images: []
    }
  ],
  inventory_movements: Array.from({ length: 27 }, (_, index) => {
    const entry = index % 2 === 0;
    const delta = entry ? 2 : -1;
    const day = 2 + Math.floor(index / 9);
    return {
      id: 'qa-movement-' + String(index + 1),
      product_id: '00000000-0000-0000-0000-000000000101',
      movement_type: entry ? 'Entrada' : 'Salida',
      quantity: Math.abs(delta), quantity_delta: delta,
      previous_stock: 10, new_stock: 10 + delta,
      note: 'Movimiento QA ' + String(index + 1),
      reference_type: 'manual', reference_id: null,
      created_at: new Date(Date.UTC(2026, 10, day, 12, index % 9, 0)).toISOString()
    };
  }), customers: [], suppliers: [], orders: [], order_items: [],
  purchases: [], purchase_items: [], invoices: [], invoice_items: [], invoice_payments: [],
  expenses: [], cash_accounts: [], cash_entries: [], employees: [], hr_attendance: [],
  hr_leave_requests: [], hr_payroll_periods: [], hr_payroll_items: [],
  settings: [{ setting_key: 'default_exchange_rate', setting_value: { value: 36.6 } }]
};

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/js/bootstrap.mjs', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: "document.body.classList.remove('auth-pending','auth-locked');" +
      "document.body.classList.add('erp-authorized');" +
      "window.JBAuth = {" +
      "mode:'authenticated', user:{id:'qa-owner',email:'qa-owner@example.test'}, profile:{id:'qa-owner',name:'QA Owner',role:'owner',permissions:['*']}," +
      "apiUrl:path=>new URL(path,'" + apiBase + "').toString()," +
      "getToken:async()=> 'qa-only-token' }; import('./app.js');"
  }));
  await page.route(workerPattern, async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/bootstrap') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: fixture }) });
    }
    if (pathname.endsWith('/products/import') && request.method() === 'POST') {
      const payload = request.postDataJSON();
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ imported: payload.records?.length || 0, records: [] })
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ records: [], data: fixture })
    });
  });
});

async function navigateToView(page, view) {
  const sidebar = page.locator('#sidebar');
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 720px)').matches);
  if (isMobile && !(await sidebar.evaluate(node => node.classList.contains('open')))) {
    await page.locator('#menu-toggle').click();
  }
  await sidebar.locator('button[data-view="' + view + '"]').click();
}

async function installStatefulInventoryApi(page, options = {}) {
  await page.unroute(workerPattern);
  const data = structuredClone(fixture);
  const requests = [];
  let nextProduct = 201;
  let mutationCommitted = false;

  const fulfill = (route, payload, status = 200) => route.fulfill({
    status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload)
  });

  await page.route(workerPattern, async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    requests.push({ method, pathname, body: request.postDataJSON?.() || null });

    if (pathname.endsWith('/bootstrap') && method === 'GET') {
      if (options.failBootstrapAfterMutation && mutationCommitted) {
        return fulfill(route, { error: { code: 'BOOTSTRAP_FAILED', message: 'No se pudo recargar el inventario.' } }, 503);
      }
      return fulfill(route, { data });
    }

    if (pathname === '/api/erp/products' && method === 'POST') {
      const payload = request.postDataJSON();
      if (data.products.some(item => String(item.sku).toLowerCase() === String(payload.sku).toLowerCase())) {
        return fulfill(route, { error: { message: 'El SKU ya existe.' } }, 409);
      }
      const id = '00000000-0000-0000-0000-' + String(nextProduct++).padStart(12, '0');
      const record = {
        id, sku: payload.sku, name: payload.name, brand: payload.brand || null,
        category: payload.category || 'Perfumería', concentration: payload.concentration || null,
        gender: payload.gender || null, family: payload.family || null, size_ml: payload.size_ml || null,
        presentation: payload.presentation || null, purchase_cost_usd: Number(payload.purchase_cost_usd || 0),
        additional_cost_usd: Number(payload.additional_cost_usd || 0), unit_cost_usd: Number(payload.unit_cost_usd || 0),
        price_usd: Number(payload.price_usd || 0), stock: Number(payload.stock || 0),
        min_stock: Number(payload.min_stock || 0), location: payload.location || null, active: true,
        barcode: payload.barcode || null, description: null, supplier_name: payload.supplier_name || null,
        wholesale_price_usd: payload.wholesale_price_usd || null, tone: payload.tone || 'art-violet',
        notes: payload.notes || null, images: [], created_at: new Date().toISOString()
      };
      data.products.push(record);
      if (record.stock > 0) {
        data.inventory_movements.unshift({
          id: 'qa-initial-' + id, product_id: id, movement_type: 'Entrada',
          quantity: record.stock, quantity_delta: record.stock, previous_stock: 0,
          new_stock: record.stock, note: 'Existencias iniciales', reference_type: 'product',
          reference_id: null, created_at: new Date().toISOString()
        });
      }
      mutationCommitted = true;
      return fulfill(route, { record }, 201);
    }

    const productMatch = pathname.match(/\/api\/erp\/products\/([0-9a-f-]+)$/i);
    if (productMatch && method === 'PATCH') {
      const record = data.products.find(item => item.id === productMatch[1]);
      if (!record) return fulfill(route, { error: { message: 'Producto no encontrado.' } }, 404);
      Object.assign(record, request.postDataJSON());
      return fulfill(route, { record });
    }

    if (pathname === '/api/erp/inventory-movements' && method === 'POST') {
      const payload = request.postDataJSON();
      const product = data.products.find(item => item.id === payload.product_id && item.active !== false);
      if (!product) return fulfill(route, { error: { message: 'Producto no disponible.' } }, 409);
      const quantity = Number(payload.quantity);
      const previousStock = Number(product.stock || 0);
      const delta = payload.movement_type === 'Salida' ? -quantity
        : payload.movement_type === 'Ajuste' ? quantity - previousStock : quantity;
      const nextStock = previousStock + delta;
      if (!Number.isInteger(quantity) || quantity < 0 ||
          (payload.movement_type !== 'Ajuste' && quantity < 1) ||
          !['Entrada', 'Salida', 'Ajuste'].includes(payload.movement_type) ||
          nextStock < 0 || delta === 0) {
        return fulfill(route, { error: { message: 'Movimiento inválido o existencias insuficientes.' } }, 409);
      }
      product.stock = nextStock;
      const record = {
        id: 'qa-stock-' + String(data.inventory_movements.length + 1),
        product_id: product.id, movement_type: payload.movement_type, quantity: Math.abs(delta),
        quantity_delta: delta, previous_stock: previousStock, new_stock: nextStock,
        note: payload.note || null, reference_type: 'manual', reference_id: null,
        created_at: new Date().toISOString()
      };
      data.inventory_movements.unshift(record);
      mutationCommitted = true;
      return fulfill(route, { record }, 201);
    }

    return fulfill(route, { records: [], data });
  });

  return { data, requests };
}

test('authenticated ERP renders dashboard and primary modules from API data', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/JB PARFUMS/);
  await expect(page.getByRole('heading', { name: /Buenos días|Buenas tardes|Buenas noches/ })).toBeVisible();
  await navigateToView(page, 'products');
  await expect(page.getByRole('heading', { name: 'Catálogo de productos' })).toBeVisible();
  await expect(page.locator('#product-table-body')).toContainText('QA Fixture Perfume');
  await navigateToView(page, 'billing');
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible();
  await navigateToView(page, 'hr');
  await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible();
  await navigateToView(page, 'analytics');
  await expect(page.getByRole('heading', { name: 'Informes y análisis' })).toBeVisible();
});

test('inventory products search by SKU and filter category and stock status', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'inventory');
  const rows = page.locator('#inventory-product-body tr');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('#inventory-product-count')).toContainText('productos');

  await page.getByLabel('Estado de existencias').selectOption('low');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('QA Low Stock Perfume');

  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await page.getByLabel('Buscar productos en existencias').fill('QA-003');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('QA Out of Stock Perfume');

  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await page.getByLabel('Categoría de existencias').selectOption('Árabes');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('QA Low Stock Perfume');
});


test('inventory is a read-only workspace: product lookup, details and kardex do not expose manual stock shortcuts', async ({ page }) => {
  const api = await installStatefulInventoryApi(page);
  await page.goto('/');
  await navigateToView(page, 'inventory');

  await expect(page.locator('[data-action="stock-new"]')).toHaveCount(0);
  await expect(page.locator('[data-action="stock-product"]')).toHaveCount(0);
  await expect(page.locator('[data-action="inventory-view-product"]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Registrar movimiento/ })).toHaveCount(0);
  await expect(page.locator('.inventory-page-actions')).toHaveCount(1);
  await expect(page.locator('.inventory-page-actions [data-action="toggle-export-menu"]')).toBeVisible();
  await expect(page.locator('#inventory-movement-body tr').first()).toBeVisible();

  const fixtureId = '00000000-0000-0000-0000-000000000101';
  await page.locator('[data-action="inventory-view-product"][data-id="' + fixtureId + '"]').click();
  await expect(page.locator('#product-detail-dialog')).toBeVisible();
  await expect(page.locator('#product-detail-content')).toContainText('Existencia actual');
  await expect(page.locator('#product-detail-content')).toContainText('Stock mínimo');
  await expect(page.locator('#edit-detail-product')).toBeHidden();
  await expect(page.locator('#product-detail-content')).not.toContainText('Costo unitario');
  await page.locator('#detail-cancel').click();

  expect(api.requests.filter(item =>
    item.pathname.endsWith('/inventory-movements') && item.method === 'POST'
  )).toHaveLength(0);
});


test('purchase order number is generated on creation instead of occupying a form field', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'purchaseOrders');

  const form = page.locator('#purchase-order-form');
  await expect(form).toBeVisible();
  await expect(form.getByText('Código de orden')).toHaveCount(0);
  await expect(form.locator('input[value="Se asigna al generar"]')).toHaveCount(0);
  await expect(form.locator('[name="supplier_id"]')).toBeVisible();
  await expect(form.locator('[name="payment_terms"]').locator('..')).toHaveClass(/purchase-order-full-field/);

  const gridColumn = await form.locator('.purchase-order-full-field').evaluate(node => getComputedStyle(node).gridColumn);
  expect(gridColumn).toContain('1 / -1');
});


test('inventory and catalog stay usable at mobile, tablet and desktop widths', async ({ page }, testInfo) => {
  await installStatefulInventoryApi(page);
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await navigateToView(page, 'inventory');
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await expect(page.locator('#inventory-product-search')).toBeVisible();
    await expect(page.locator('.inventory-page-actions [data-action="toggle-export-menu"]')).toBeVisible();
    await expect(page.locator('[data-action="stock-new"], [data-action="stock-product"]')).toHaveCount(0);
    const actionLayout = await page.evaluate(() => {
      const actions = document.querySelector('.inventory-page-actions').getBoundingClientRect();
      const exportButton = document.querySelector('.inventory-page-actions [data-action="toggle-export-menu"]').getBoundingClientRect();
      const summaryColumns = getComputedStyle(document.querySelector('.inventory-summary-strip')).gridTemplateColumns.split(' ').length;
      const filterColumns = getComputedStyle(document.querySelector('.inventory-products-toolbar .toolbar-right')).gridTemplateColumns.split(' ').length;
      return {
        actionsTop: actions.top,
        exportBottom: exportButton.bottom,
        exportRight: exportButton.right,
        summaryColumns,
        filterColumns,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });
    expect(actionLayout.exportBottom).toBeGreaterThan(0);
    expect(actionLayout.exportRight).toBeLessThanOrEqual(viewport.width);
    expect(actionLayout.summaryColumns).toBe(3);
    if (viewport.width <= 720) expect(actionLayout.filterColumns).toBe(2);
    const fixtureId = '00000000-0000-0000-0000-000000000101';
    const detailTrigger = page.locator('[data-action="inventory-view-product"][data-id="' + fixtureId + '"]');
    await expect(detailTrigger).toBeVisible();
    await detailTrigger.click();
    await expect(page.locator('#product-detail-dialog')).toBeVisible();
    await expect(page.locator('#product-detail-content')).toContainText('Existencia actual');
    await expect(page.locator('#product-detail-content')).toContainText('Stock mínimo');
    await expect(page.locator('#edit-detail-product')).toBeHidden();
    await expect(page.locator('#product-detail-content')).not.toContainText('Costo unitario');
    await page.locator('#detail-cancel').click();
    const layout = await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      const main = document.querySelector('.main-panel');
      const sidebarRect = sidebar.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        content: mainRect.width,
        sidebarLeft: sidebarRect.left,
        sidebarRight: sidebarRect.right,
        sidebarWidth: sidebarRect.width,
        panelLeft: mainRect.left,
        collapsed: document.body.classList.contains('sidebar-collapsed')
      };
    });
    expect(layout.document, 'document must not overflow the viewport at ' + viewport.name)
      .toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.content).toBeGreaterThan(0);
    expect(
      layout.panelLeft,
      'main panel overlaps the fixed sidebar at ' + viewport.name + ': ' + JSON.stringify(layout)
    ).toBeGreaterThanOrEqual(layout.sidebarRight - 1);
    const evidenceDir = path.join(process.cwd(), 'visual-evidence');
    mkdirSync(evidenceDir, { recursive: true });
    const screenshotPath = path.join(evidenceDir, 'inventory-' + viewport.name + '.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('inventory-' + viewport.name, { path: screenshotPath, contentType: 'image/png' });

    await navigateToView(page, 'products');
    await expect(page.getByRole('heading', { name: 'Catálogo de productos' })).toBeVisible();
    await expect(page.locator('#product-table-body')).toContainText('QA Fixture Perfume');
    const catalogLayout = await page.evaluate(() => ({
      viewport: window.innerWidth, document: document.documentElement.scrollWidth
    }));
    expect(catalogLayout.document).toBeLessThanOrEqual(catalogLayout.viewport + 1);
  }
});
