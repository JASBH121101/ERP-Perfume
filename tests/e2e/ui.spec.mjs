import { test, expect } from '@playwright/test';

const workerPattern = /\/api\/erp\/[^?]+/;
const apiBase = 'https://jb-parfums-erp-api.jaredblancoh19.workers.dev';
const fixture = {
  products: [{
    id: '00000000-0000-0000-0000-000000000101', sku: 'QA-001',
    name: 'QA Fixture Perfume', brand: 'QA Maison', category: 'Diseñador',
    purchase_cost_usd: 20, additional_cost_usd: 5, unit_cost_usd: 25,
    price_usd: 50, stock: 5, min_stock: 1, active: true, images: []
  }],
  inventory_movements: [], customers: [], suppliers: [], orders: [], order_items: [],
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
      "mode:'authenticated', profile:{id:'qa-owner',name:'QA Owner',role:'owner'}," +
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
