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


test('exports the active catalog filters to CSV and offers Excel and printable PDF', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.locator('#stock-filter').selectOption('out');
  await expect(page.locator('#product-table-body')).toContainText('QA Out of Stock Perfume');
  await expect(page.locator('#product-table-body')).not.toContainText('QA Fixture Perfume');

  await page.locator('[data-action="toggle-export-menu"]').click();
  await expect(page.locator('#current-export-menu')).toBeVisible();
  await expect(page.locator('#current-export-menu')).toContainText('CSV');
  await expect(page.locator('#current-export-menu')).toContainText('Excel');
  await expect(page.locator('#current-export-menu')).toContainText('PDF / Imprimir');

  const csvDownloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="export-current-view"][data-format="csv"]').click();
  const csvDownload = await csvDownloadPromise;
  expect(csvDownload.suggestedFilename()).toMatch(/products.*\.csv$/);
  const csvPath = await csvDownload.path();
  const csv = await readFile(csvPath, 'utf8');
  expect(csv).toContain('QA Out of Stock Perfume');
  expect(csv).not.toContain('QA Fixture Perfume');
  expect(csv).not.toContain('QA Archived Perfume');

  await page.locator('[data-action="toggle-export-menu"]').click();
  const excelDownloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="export-current-view"][data-format="excel"]').click();
  const excelDownload = await excelDownloadPromise;
  expect(excelDownload.suggestedFilename()).toMatch(/products.*\.xls$/);

  await page.locator('[data-action="toggle-export-menu"]').click();
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-action="export-current-view"][data-format="pdf"]').click();
  const printPage = await popupPromise;
  await expect(printPage.locator('body')).toContainText('QA Out of Stock Perfume');
  await expect(printPage.locator('body')).not.toContainText('QA Fixture Perfume');
});

test('mobile export menu stays fully inside the viewport on Orders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateToView(page, 'orders');
  await expect(page.getByRole('heading', { name: 'Pedidos y ventas' })).toBeVisible();

  const trigger = page.locator('[data-action="toggle-export-menu"]');
  await trigger.click();
  const menu = page.locator('#current-export-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(3);
  await expect(menu.getByRole('menuitem', { name: /CSV/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Excel/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /PDF \/ Imprimir/ })).toBeVisible();

  const bounds = await page.evaluate(() => {
    const menu = document.getElementById('current-export-menu').getBoundingClientRect();
    return { left: menu.left, right: menu.right, width: menu.width, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.width).toBeGreaterThan(0);
});

test('inventory kardex searches, filters by type and date, and paginates all movements', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'inventory');
  const rows = page.locator('#inventory-movement-body tr');
  await expect(rows).toHaveCount(25);
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByText('Página 2 de 2')).toBeVisible();

  await page.getByLabel('Filtrar movimientos por tipo').selectOption('Entrada');
  await expect(rows).toHaveCount(14);
  await expect(page.getByText('Página 1 de 1')).toBeVisible();

  await page.getByLabel('Buscar en el kardex').fill('Movimiento QA 27');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Movimiento QA 27');

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await page.getByLabel('Desde fecha').fill('2026-11-04');
  await page.getByLabel('Hasta fecha').fill('2026-11-04');
  await expect(rows).toHaveCount(9);
  await expect(page.getByText('Página 1 de 1')).toBeVisible();
});

test('new order allows registering a customer inline without a prior customer record', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await page.locator('[data-action="new-order"]').click();
  const dialog=page.locator('#business-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="newCustomerName"]')).toBeVisible();
  await expect(dialog.locator('[data-target="customerIndex"]')).toBeVisible();
  const customerName=dialog.locator('[name="newCustomerName"]');
  await customerName.fill('Cliente nuevo QA');
  const productSearch=dialog.locator('[data-lookup="product"]');
  await productSearch.fill('QA Fixture Perfume');
  await expect(dialog.locator('[data-lookup-select]')).toBeVisible();
  await dialog.locator('[data-lookup-select]').first().click();
  const post=page.waitForRequest(request=>request.url().endsWith('/api/erp/orders')&&request.method()==='POST');
  await dialog.locator('#business-save').click();
  const request=await post;
  const payload=request.postDataJSON();
  expect(payload.customer_id).toBeNull();
  expect(payload.customer_name).toBe('Cliente nuevo QA');
  expect(payload.new_customer.name).toBe('Cliente nuevo QA');
  expect(payload.items).toHaveLength(1);
});

test('HR permissions tab explains how to add the first collaborator', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'hr');
  await page.locator('[data-action="hr-tab"][data-tab="leaves"]').click();
  await expect(page.locator('[data-action="go-hr-employees"]')).toContainText('Agregar colaborador');
  await expect(page.getByText('Primero registra al colaborador')).toBeVisible();
});

test('employee commission rate is disabled and saved as zero when commission is No', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateToView(page, 'hr');
  await page.getByRole('button', { name: /Agregar colaborador/ }).click();

  const dialog = page.locator('#business-dialog');
  await expect(dialog).toBeVisible();
  const commissionSelect = dialog.locator('[name="commissionEnabled"]');
  const commissionWrap = dialog.locator('#employee-commission-rate-field');
  const commissionRate = dialog.locator('[name="commissionRate"]');
  await expect(commissionSelect).toHaveValue('false');
  await expect(commissionWrap).toBeHidden();
  await expect(commissionRate).toBeDisabled();

  await dialog.locator('[name="name"]').fill('Colaborador QA sin comisión');
  await dialog.locator('[name="position"]').fill('Asistente');
  await dialog.locator('[name="salaryNio"]').fill('10000');
  await dialog.locator('[name="phone"]').fill('8888-8888');

  const post = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/employees') && request.method() === 'POST'
  );
  await dialog.locator('#business-save').click();
  const request = await post;
  const payload = request.postDataJSON();

  expect(payload.phone).toBe('+50588888888');
  expect(payload.email).toBeNull();
  expect(payload.commission_enabled).toBe(false);
  expect(payload.commission_rate).toBe(0);
});

test('employee commission rate is required and enabled only when commission is Yes', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'hr');
  await page.getByRole('button', { name: /Agregar colaborador/ }).click();

  const dialog = page.locator('#business-dialog');
  const commissionSelect = dialog.locator('[name="commissionEnabled"]');
  const commissionWrap = dialog.locator('#employee-commission-rate-field');
  const commissionRate = dialog.locator('[name="commissionRate"]');
  await commissionSelect.selectOption('true');
  await expect(commissionWrap).toBeVisible();
  await expect(commissionRate).toBeEnabled();
  await expect(commissionRate).toHaveValue('3');
  await expect(commissionRate).toHaveAttribute('required', '');

  await dialog.locator('[name="name"]').fill('Vendedor QA con comisión');
  await dialog.locator('[name="email"]').fill('vendedor.qa@example.test');
  await dialog.locator('[name="position"]').fill('Vendedor');
  await dialog.locator('[name="salaryNio"]').fill('12000');
  await commissionRate.fill('5.5');

  const post = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/employees') && request.method() === 'POST'
  );
  await dialog.locator('#business-save').click();
  const request = await post;
  const payload = request.postDataJSON();

  expect(payload.email).toBe('vendedor.qa@example.test');
  expect(payload.phone).toBeNull();
  expect(payload.commission_enabled).toBe(true);
  expect(payload.commission_rate).toBe(5.5);
});

test('employee registration requires at least one recovery contact', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'hr');
  await page.getByRole('button', { name: /Agregar colaborador/ }).click();

  const dialog = page.locator('#business-dialog');
  await dialog.locator('[name="name"]').fill('Colaborador sin contacto');
  await dialog.locator('[name="position"]').fill('Asistente');
  await dialog.locator('[name="salaryNio"]').fill('8000');

  await dialog.locator('#business-save').click();
  await expect(page.locator('#toast-region')).toContainText('Registra un correo electrónico o un número de celular');
  await expect(dialog).toBeVisible();
});

test('custom role can open DGI but cannot export reports without the explicit export permission', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Buenos días|Buenas tardes|Buenas noches/ })).toBeVisible();
  await page.evaluate(() => {
    window.JBAuth.profile = {
      id: 'qa-custom-dgi', name: 'QA DGI', role: 'custom-dgi',
      permissions: ['dashboard.view', 'dgi.documents.view']
    };
  });
  await page.locator('#sidebar button[data-view="dashboard"]').click();
  await page.locator('#sidebar button[data-view="dgi"]').click();
  await expect(page.getByRole('heading', { name: 'Control tributario DGI' })).toBeVisible();
  await expect(page.locator('[data-action="toggle-export-menu"]')).toBeHidden();
  await expect(page.locator('[data-action="export-dgi-book"]')).toBeHidden();
});

test('custom role without DGI permission is returned to an allowed module', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Buenos días|Buenas tardes|Buenas noches/ })).toBeVisible();
  await page.evaluate(() => {
    window.JBAuth.profile = {
      id: 'qa-custom-no-dgi', name: 'QA Limited', role: 'custom-limited',
      permissions: ['dashboard.view']
    };
  });
  await page.locator('#sidebar button[data-view="dgi"]').click();
  await expect(page.getByRole('heading', { name: /Buenos días|Buenas tardes|Buenas noches/ })).toBeVisible();
  await page.locator('#sidebar button[data-view="dashboard"]').click();
  await expect(page.locator('#sidebar button[data-view="dgi"]')).toBeHidden();
});

test('DGI workspace displays thresholds as alerts and starts with regime unconfirmed', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'dgi');
  await expect(page.getByRole('heading', { name: 'Control tributario DGI' })).toBeVisible();
  await expect(page.locator('#dgi-settings-form [name="regimeStatus"]')).toHaveValue('not_confirmed');
  await expect(page.getByRole('button', { name: 'Exportar libro auxiliar CSV' })).toBeVisible();
  await expect(page.getByText('El ERP no supone que JB PARFUMS está inscrito en Cuota Fija.')).toBeVisible();
});

test('catalog import explicitly accepts CSV, PDF, PNG, JPG and JPEG', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Importar catálogo/ }).click();
  const dialog = page.locator('#catalog-import-dialog');
  await expect(dialog).toBeVisible();
  const accept = await dialog.locator('#catalog-import-file').getAttribute('accept');
  for (const extension of ['.csv', '.pdf', '.png', '.jpg', '.jpeg']) expect(accept).toContain(extension);
  await expect(dialog).toContainText('Admite CSV, PDF, PNG, JPG y JPEG');
});

test('CSV import parses the selected file and exposes an editable preview', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Importar catálogo/ }).click();
  const dialog = page.locator('#catalog-import-dialog');
  await dialog.locator('#catalog-import-file').setInputFiles({
    name: 'catalogo.csv', mimeType: 'text/csv',
    buffer: Buffer.from(
      'SKU;Producto;Marca;Costo de compra;Precio de venta;Stock\n' +
      'DIO-100;Sauvage Elixir;Dior;75,50;109,99;4\n' +
      'ARM-200;Stronger With You;Armani;50;89;2', 'utf8')
  });
  await expect(dialog.locator('#catalog-import-status')).toContainText('Se detectaron 2 filas');
  const preview = dialog.locator('#catalog-import-preview');
  await expect(preview.locator('[data-import-field="name"]').nth(0)).toHaveValue('Sauvage Elixir');
  await expect(preview.locator('[data-import-field="name"]').nth(1)).toHaveValue('Stronger With You');
  await expect(preview.locator('[data-import-field="brand"]').nth(0)).toHaveValue('Dior');
  await expect(dialog.getByRole('button', { name: 'Importar 2 productos a Neon' })).toBeEnabled();
  await expect(dialog.locator('[data-import-field="price_usd"]').first()).toHaveValue('109.99');
  await dialog.locator('[data-import-field="name"]').first().fill('Sauvage Elixir QA editado');
  await expect(dialog.locator('[data-import-field="name"]').first()).toHaveValue('Sauvage Elixir QA editado');
});

test('catalog import submits the reviewed rows to the backend endpoint', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Importar catálogo/ }).click();
  const dialog = page.locator('#catalog-import-dialog');
  await dialog.locator('#catalog-import-file').setInputFiles({
    name: 'catalogo.csv', mimeType: 'text/csv',
    buffer: Buffer.from('SKU,Producto,Marca,Precio,Stock\nQA-200,Perfume de prueba,QA Maison,35.00,3', 'utf8')
  });
  await expect(dialog.locator('#catalog-import-status')).toContainText('Se detectaron 1 filas');
  const importResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/erp/products/import') && response.request().method() === 'POST'
  );
  await dialog.getByRole('button', { name: 'Importar 1 productos a Neon' }).click();
  const response = await importResponse;
  expect(response.status()).toBe(201);
  await expect(page.locator('#toast-region')).toContainText('1 productos importados');
  await expect(dialog).not.toBeVisible();
});

test('sidebar and font preferences persist without storing operational records locally', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/');
  await page.locator('#sidebar-collapse').click();
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  expect(await page.evaluate(() => localStorage.getItem('jbparfums-sidebar-collapsed'))).toBe('1');
  await page.locator('#font-increase').click();
  await expect(page.locator('#font-scale-label')).toHaveText('120%');
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#font-scale-label')).toHaveText('120%');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('demo-data')))).toEqual([]);
});

test('mobile navigation opens and closes after selecting a module', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await navigateToView(page, 'billing');
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible();
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
});

test('local browser storage contains preferences only, not demo business data', async ({ page }) => {
  await page.goto('/');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some(key => key.includes('demo-data'))).toBe(false);
  await expect(page.locator('#db-connection-status')).toHaveText('Conectado');
});


test('product creation saves its opening balance and writes the first kardex entry', async ({ page }) => {
  const api = await installStatefulInventoryApi(page);
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.locator('[data-action="new-product"]').click();

  const dialog = page.locator('#product-dialog');
  const form = page.locator('#product-form');
  await expect(dialog).toBeVisible();
  await form.locator('[name="name"]').fill('QA Inventory Created Perfume');
  await form.locator('[name="sku"]').fill('QA-NEW-201');
  await form.locator('[name="brand"]').fill('QA Atelier');
  await form.locator('[name="price"]').fill('42.50');
  await form.locator('[name="purchaseCost"]').fill('18');
  await form.locator('[name="additionalCost"]').fill('2');
  await form.locator('[name="stock"]').fill('4');
  await form.locator('[name="minStock"]').fill('2');

  const createRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/products') && request.method() === 'POST'
  );
  await form.locator('#save-product').click();
  const request = await createRequest;
  const payload = request.postDataJSON();
  expect(payload.sku).toBe('QA-NEW-201');
  expect(payload.stock).toBe(4);
  expect(payload.unit_cost_usd).toBe(20);
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#product-table-body')).toContainText('QA Inventory Created Perfume');

  await navigateToView(page, 'inventory');
  await expect(page.locator('#inventory-product-body')).toContainText('QA Inventory Created Perfume');
  await expect(page.locator('#inventory-product-body')).toContainText('4 unidades');
  await expect(page.locator('#inventory-movement-body')).toContainText('Existencias iniciales');
  expect(api.data.inventory_movements.some(movement =>
    movement.product_id.endsWith('000000000201') && movement.quantity_delta === 4
  )).toBe(true);
});

test('inventory records receipts, issues and physical-count adjustments in the kardex', async ({ page }) => {
  const api = await installStatefulInventoryApi(page);
  await page.goto('/');
  await navigateToView(page, 'inventory');

  const productId = '00000000-0000-0000-0000-000000000101';
  const register = async (type, quantity, note, expectedStock) => {
    await page.locator('[data-action="stock-product"][data-id="' + productId + '"]').click();
    const form = page.locator('#stock-form');
    await expect(page.locator('#stock-dialog')).toBeVisible();
    await form.locator('[name="type"]').selectOption(type);
    await form.locator('[name="quantity"]').fill(String(quantity));
    await form.locator('[name="note"]').fill(note);
    const response = page.waitForResponse(item =>
      item.url().endsWith('/api/erp/inventory-movements') && item.request().method() === 'POST'
    );
    await form.locator('button[type="submit"]').click();
    expect((await response).status()).toBe(201);
    await expect(page.locator('#stock-dialog')).not.toBeVisible();
    await expect(page.locator('#inventory-product-body')).toContainText(expectedStock + ' unidades');
    await expect(page.locator('#inventory-movement-body tr').first()).toContainText(note);
  };

  await register('entry', 3, 'Entrada QA proveedor', 8);
  await register('exit', 2, 'Salida QA venta', 6);
  await register('adjustment', 4, 'Conteo físico QA', 4);

  const product = api.data.products.find(item => item.id === productId);
  expect(product.stock).toBe(4);
  const qaNotes = new Set(['Entrada QA proveedor', 'Salida QA venta', 'Conteo físico QA']);
  const qaMovements = api.data.inventory_movements.filter(item => qaNotes.has(item.note));
  expect(qaMovements.map(item => item.quantity_delta)).toEqual([-2, -2, 3]);
  expect(qaMovements.map(item => item.new_stock)).toEqual([4, 6, 8]);
});

test('inventory prevents an issue larger than available stock before sending it to the API', async ({ page }) => {
  const api = await installStatefulInventoryApi(page);
  await page.goto('/');
  await navigateToView(page, 'inventory');

  const productId = '00000000-0000-0000-0000-000000000103';
  await page.locator('[data-action="stock-product"][data-id="' + productId + '"]').click();
  const form = page.locator('#stock-form');
  await form.locator('[name="type"]').selectOption('exit');
  await form.locator('[name="quantity"]').fill('1');
  await form.locator('[name="note"]').fill('Salida que no debe existir');
  await form.locator('button[type="submit"]').click();

  await expect(page.locator('#toast-region')).toContainText('Stock insuficiente');
  await expect(page.locator('#stock-dialog')).toBeVisible();
  expect(api.requests.filter(item =>
    item.pathname.endsWith('/inventory-movements') && item.method === 'POST'
  )).toHaveLength(0);
  expect(api.data.products.find(item => item.id === productId).stock).toBe(0);
});

test('a committed stock movement is not repeated when the following data refresh fails', async ({ page }) => {
  const api = await installStatefulInventoryApi(page, { failBootstrapAfterMutation: true });
  await page.goto('/');
  await navigateToView(page, 'inventory');

  const productId = '00000000-0000-0000-0000-000000000101';
  await page.locator('[data-action="stock-product"][data-id="' + productId + '"]').click();
  const form = page.locator('#stock-form');
  await form.locator('[name="type"]').selectOption('entry');
  await form.locator('[name="quantity"]').fill('2');
  await form.locator('[name="note"]').fill('Entrada comprometida QA');
  await form.locator('button[type="submit"]').click();

  await expect(page.locator('#stock-dialog')).not.toBeVisible();
  await expect(page.locator('#inventory-product-body')).toContainText('7 unidades');
  await expect(page.locator('#toast-region')).toContainText('Movimiento guardado en Neon');
  expect(api.requests.filter(item =>
    item.pathname.endsWith('/inventory-movements') && item.method === 'POST'
  )).toHaveLength(1);
  expect(api.data.products.find(item => item.id === productId).stock).toBe(7);
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
