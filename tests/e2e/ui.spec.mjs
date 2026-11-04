import { test, expect } from '@playwright/test';

async function navigateToView(page, view) {
  const sidebar = page.locator('#sidebar');
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 720px)').matches);
  if (isMobile && !(await sidebar.evaluate(node => node.classList.contains('open')))) {
    await page.locator('#menu-toggle').click();
  }
  await sidebar.locator('button[data-view="' + view + '"]').click();
}

test('ERP renders the dashboard and all primary modules', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/JB PARFUMS/);
  await expect(page.getByRole('heading', { name: /Buenos días|Buenas tardes|Buenas noches/ })).toBeVisible();

  await navigateToView(page, 'products');
  await expect(page.getByRole('heading', { name: 'Catálogo de productos' })).toBeVisible();

  await navigateToView(page, 'billing');
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible();
  await expect(page.getByText(/no tiene autorización tributaria/i)).toBeVisible();

  await navigateToView(page, 'hr');
  await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible();
  await expect(page.getByText(/no hay colaboradores demo/i)).toBeVisible();
});

test('desktop sidebar collapses and remembers its state', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/');

  const collapseButton = page.locator('#sidebar-collapse');
  await expect(collapseButton).toBeVisible();
  await collapseButton.click();

  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await expect(collapseButton).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('jbparfums-sidebar-collapsed'))).toBe('1');

  await page.reload();
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await page.locator('#sidebar-collapse').click();
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
});

test('font size controls default to 110 percent and persist the selected level', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-font-scale', 'large');
  await expect(page.locator('#font-scale-label')).toHaveText('110%');

  await page.locator('#font-increase').click();
  await expect(page.locator('body')).toHaveAttribute('data-font-scale', 'larger');
  await expect(page.locator('#font-scale-label')).toHaveText('120%');

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-font-scale', 'larger');
  await page.locator('#font-decrease').click();
  await expect(page.locator('#font-scale-label')).toHaveText('110%');
});

test('product search and stock filter return matching records', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');

  await page.getByLabel('Buscar productos').fill('Khamrah');
  await expect(page.locator('#product-table-body')).toContainText('Khamrah Lattafa');
  await expect(page.locator('#product-table-body')).not.toContainText('Yara Lattafa');

  await page.locator('#stock-filter').selectOption('low');
  await expect(page.locator('#product-table-body')).toContainText('Khamrah Lattafa');
  await expect(page.locator('#product-table-body')).not.toContainText('Yara Lattafa');
});

test('a new product can be added to the demo session', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Nuevo producto/ }).click();

  const dialog = page.locator('#product-dialog');
  await expect(dialog).toBeVisible();
  await page.getByLabel('Nombre del perfume').fill('Fragancia QA Automatizada');
  await page.getByLabel('SKU / Código interno').fill('QA-ERP-001');
  await dialog.locator('select[name="category"]').selectOption('Árabes');
  await page.getByLabel('Precio de venta (USD)').fill('1250');
  await dialog.getByLabel('Existencias iniciales').fill('4');
  await page.getByRole('button', { name: /Agregar a demo/ }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#product-table-body')).toContainText('Fragancia QA Automatizada');
  await expect(page.locator('#product-count')).toHaveText('09');
  await expect(page.getByText(/no se ha guardado en Neon/i)).toBeVisible();
});


test('product master calculates unit cost, profit and gross margin', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Nuevo producto/ }).click();

  const dialog = page.locator('#product-dialog');
  await dialog.getByLabel('Nombre del perfume').fill('QA Oud Reserve');
  await dialog.getByLabel('Marca').fill('QA Maison');
  await dialog.getByLabel('SKU / Código interno').fill('QA-COST-001');
  await dialog.getByLabel('Concentración').selectOption('Eau de Parfum (EDP)');
  await dialog.getByLabel('Género').selectOption('Unisex');
  await dialog.getByLabel('Contenido (ml)').fill('100');
  await dialog.getByLabel('Proveedor').fill('Proveedor QA');
  await dialog.getByLabel('Costo de compra (USD)').fill('20');
  await dialog.getByLabel('Costos adicionales (USD)').fill('5');
  await dialog.getByLabel('Precio de venta (USD)').fill('50');

  await expect(dialog.locator('#unit-cost-preview')).toHaveText('$25.00');
  await expect(dialog.locator('#unit-profit-preview')).toHaveText('$25.00');
  await expect(dialog.locator('#gross-margin-preview')).toHaveText('50.0%');

  await dialog.getByLabel('Existencias iniciales').fill('7');
  await dialog.getByLabel('Stock mínimo').fill('2');
  await dialog.getByLabel('Ubicación en bodega').fill('Estante QA A-01');
  await dialog.getByRole('button', { name: /Agregar a demo/ }).click();

  await expect(page.locator('#product-table-body')).toContainText('QA Oud Reserve');
  await expect(page.locator('#product-table-body')).toContainText('QA Maison');
  await expect(page.locator('#product-table-body')).toContainText('100 ml');
  await expect(page.locator('#product-table-body')).toContainText('Margen 33.3%');
});


test('inventory alerts use each product minimum stock', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'inventory');

  const inventory = page.locator('#view-root');
  await expect(inventory).toContainText('Stock mínimo configurable por producto');
  await expect(inventory.getByText('Khamrah Lattafa')).toBeVisible();
  const khamrahRow = inventory.locator('tr').filter({ hasText: 'Khamrah Lattafa' });
  await expect(khamrahRow).toContainText('Stock bajo');
  const yaraRow = inventory.locator('tr').filter({ hasText: 'Yara Lattafa' });
  await expect(yaraRow).toContainText('Disponible');
});

test('product catalog filters by fragrance category', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');

  await page.getByLabel('Filtrar por categoría').selectOption('Diseñador');
  await expect(page.locator('#product-table-body')).toContainText('Club de Nuit Intense Man');
  await expect(page.locator('#product-table-body')).not.toContainText('Yara Lattafa');
});

test('product names are rendered as text, not executable markup', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Nuevo producto/ }).click();
  const dialog = page.locator('#product-dialog');

  let scriptDialogs = 0;
  page.on('dialog', async browserDialog => {
    scriptDialogs += 1;
    await browserDialog.dismiss();
  });

  const payload = '<img src=x onerror=alert(1)>';
  await page.getByLabel('Nombre del perfume').fill(payload);
  await page.getByLabel('Precio de venta (USD)').fill('100');
  await dialog.getByLabel('Existencias iniciales').fill('1');
  await page.getByRole('button', { name: /Agregar a demo/ }).click();

  await expect(page.locator('#product-table-body')).toContainText(payload);
  await expect(page.locator('#product-table-body img')).toHaveCount(0);
  expect(scriptDialogs).toBe(0);
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


test('product creation and edits persist locally after reload without changing stock', async ({ page }) => {
  await page.goto('/'); await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Nuevo producto/ }).click();
  const dialog=page.locator('#product-dialog');
  await dialog.getByLabel('Nombre del perfume').fill('QA Persistente');
  await dialog.getByLabel('SKU / Código interno').fill('QA-PERSIST-01');
  await dialog.getByLabel('Precio de venta (USD)').fill('1500');
  await dialog.getByLabel('Existencias iniciales').fill('6');
  await dialog.getByRole('button', { name: /Agregar a demo/ }).click();
  await page.reload(); await navigateToView(page, 'products');
  await expect(page.locator('#product-table-body')).toContainText('QA Persistente');
  await page.getByRole('button', { name: 'Editar QA Persistente' }).click();
  await dialog.getByLabel('Nombre del perfume').fill('QA Persistente Editado');
  await dialog.getByLabel('Precio de venta (USD)').fill('1750');
  await expect(dialog.getByLabel('Existencias iniciales')).toHaveValue('6');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#product-table-body')).toContainText('QA Persistente Editado');
  await expect(page.locator('#product-table-body')).toContainText('6 uds.');
  await page.reload(); await navigateToView(page, 'products');
  await expect(page.locator('#product-table-body')).toContainText('QA Persistente Editado');
});

test('products can be deactivated and reactivated from the catalogue', async ({ page }) => {
  await page.goto('/'); await navigateToView(page, 'products');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Desactivar Yara Lattafa' }).click();
  await expect(page.locator('#product-count')).toHaveText('07');
  await page.locator('#product-status-filter').selectOption('inactive');
  await expect(page.locator('#product-table-body')).toContainText('Yara Lattafa');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Activar Yara Lattafa' }).click();
  await page.locator('#product-status-filter').selectOption('active');
  await expect(page.locator('#product-table-body')).toContainText('Yara Lattafa');
});

test('inventory movements update stock, block negative balances, and persist', async ({ page }) => {
  await page.goto('/'); await navigateToView(page, 'inventory');
  const inventory=page.locator('#view-root');
  await inventory.locator('tr').filter({ hasText: 'Yara Lattafa' }).getByRole('button', { name: 'Movimiento' }).click();
  const stockDialog=page.locator('#stock-dialog');
  await stockDialog.locator('select[name="type"]').selectOption('entry');
  await stockDialog.locator('input[name="quantity"]').fill('4');
  await stockDialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(inventory).toContainText('12 unidades');
  await inventory.locator('tr').filter({ hasText: 'Yara Lattafa' }).getByRole('button', { name: 'Movimiento' }).click();
  await stockDialog.locator('select[name="type"]').selectOption('exit');
  await stockDialog.locator('input[name="quantity"]').fill('99');
  await stockDialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(stockDialog).toBeVisible();
  await expect(page.locator('#toast-region')).toContainText(/no puede dejar existencias negativas/i);
  await stockDialog.locator('input[name="quantity"]').fill('2');
  await stockDialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(inventory).toContainText('10 unidades');
  await inventory.locator('button[data-action="stock-new"]').click();
  await stockDialog.locator('[data-lookup="product"]').fill('Yara');
  await stockDialog.getByRole('option', { name: /Yara Lattafa/ }).click();
  await stockDialog.locator('select[name="type"]').selectOption('adjustment');
  await stockDialog.locator('input[name="quantity"]').fill('7');
  await stockDialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(inventory).toContainText('7 unidades');
  await expect(inventory.locator('.ledger-panel')).toContainText('Entrada');
  await expect(inventory.locator('.ledger-panel')).toContainText('Salida');
  await expect(inventory.locator('.ledger-panel')).toContainText('Ajuste');
  await page.reload(); await navigateToView(page, 'inventory');
  await expect(page.locator('#view-root')).toContainText('7 unidades');
  await expect(page.locator('.ledger-panel')).toContainText('Ajuste');
});

test('inventory CSV export is available', async ({ page }) => {
  await page.goto('/'); await navigateToView(page, 'inventory');
  const download=page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar CSV/ }).click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('jb-parfums-inventario-demo.csv');
});

test('mobile drawer scroll is isolated from page background', async ({ page }) => { await page.setViewportSize({width:390,height:844}); await page.goto('/'); await page.evaluate(()=>window.scrollTo(0,0)); await page.getByRole('button',{name:'Abrir menú'}).click(); const drawer=page.locator('#sidebar'); await expect(drawer).toHaveClass(/open/); await expect(page.locator('body')).toHaveClass(/mobile-menu-open/); const d=await drawer.evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY})); expect(d.scroll).toBeGreaterThan(d.client); expect(d.overflow).toBe('auto'); await drawer.evaluate(el=>{el.scrollTop=el.scrollHeight}); await expect.poll(()=>drawer.evaluate(el=>el.scrollTop)).toBeGreaterThan(0); expect(await page.evaluate(()=>window.scrollY)).toBe(0); await page.locator('#mobile-scrim').click({position:{x:370,y:400}}); await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/); });


test('mobile drawer scroll responds to wheel input without moving the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 240));
  await page.waitForFunction(() => window.scrollY > 0);
  const pageScrollBefore = await page.evaluate(() => window.scrollY);

  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const drawer = page.locator('#sidebar');
  await expect(drawer).toHaveClass(/open/);
  await expect(page.locator('body')).toHaveClass(/mobile-menu-open/);
  await expect(drawer).toHaveCSS('overflow-y', 'auto');

  await page.mouse.move(130, 560);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => drawer.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);

  await page.locator('#mobile-scrim').click({ position: { x: 380, y: 560 } });
  await expect(drawer).not.toHaveClass(/open/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
});

test('the DEMO catalogue still contains the eight original sample perfumes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#product-count')).toHaveText('08');
  await navigateToView(page, 'products');
  await expect(page.locator('#product-table-body tr')).toHaveCount(8);
  await expect(page.locator('#product-table-body')).toContainText('Club de Nuit Intense Man');
  await expect(page.locator('#product-table-body')).toContainText('Yara Lattafa');
  await expect(page.locator('#product-table-body')).toContainText('Khamrah Lattafa');
  await expect(page.locator('#product-table-body')).toContainText('Eclaire Lattafa');
});


test('form fields have no placeholder or optional copy; required fields use a red asterisk only', async ({ page }) => {
  await page.goto('/');
  const productDialog = page.locator('#product-dialog');
  await page.getByRole('button', { name: /Nuevo producto/ }).click();

  await expect(productDialog.locator('input[placeholder], textarea[placeholder]')).toHaveCount(0);
  await expect(productDialog.locator('label').filter({ hasText: /opcional/i })).toHaveCount(0);
  await expect(productDialog.locator('.required-mark')).toHaveCount(3);
  for (const marker of await productDialog.locator('.required-mark').all()) {
    await expect(marker).toHaveCSS('color', 'rgb(220, 38, 38)');
  }

  await productDialog.getByRole('button', { name: 'Cancelar' }).click();
  await navigateToView(page, 'inventory');
  await page.locator('#view-root button[data-action="stock-new"]').click();
  const stockDialog = page.locator('#stock-dialog');
  await expect(stockDialog.locator('input[placeholder], textarea[placeholder]')).toHaveCount(0);
  await expect(stockDialog.locator('label').filter({ hasText: /opcional/i })).toHaveCount(0);
  await expect(stockDialog.locator('.required-mark')).toHaveCount(3);
  for (const marker of await stockDialog.locator('.required-mark').all()) {
    await expect(marker).toHaveCSS('color', 'rgb(220, 38, 38)');
  }
});


test('business amounts display in USD and configuration shows the configurable reference rate', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#view-root')).toContainText('$359.30');
  await expect(page.locator('#view-root')).not.toContainText('C' + '$');
  await navigateToView(page, 'products');
  await expect(page.locator('#product-table-body')).toContainText('$66.94');
  await expect(page.locator('#view-root')).not.toContainText('C' + '$');
  await navigateToView(page, 'settings');
  await expect(page.locator('#view-root')).toContainText('Moneda base: USD');
  await expect(page.locator('#view-root')).toContainText('C' + '$' + ' 36.60 por US$ 1');
});

test('legacy DEMO data is converted once from córdobas to USD at 36.60', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('jbparfums-demo-data-v1', JSON.stringify({
      version: 1,
      products: [{ id: 91, name: 'Legacy Migration Perfume', brand: 'Legacy', sku: 'MIG-001', purchaseCost: 183, additionalCost: 36.6, unitCost: 219.6, price: 366, profit: 146.4, margin: 40, stock: 2, minStock: 1, active: true }],
      inventoryMovements: [],
      orders: [{ id: 'JP-9999', customer: 'Cliente migración', phone: 'No registrado', date: '02 nov 2026', amount: 402.6, discount: 0, deliveryFee: 36.6, status: 'Pendiente', paymentMethod: 'Efectivo', paymentStatus: 'Pendiente', deliveryMode: 'Retiro en tienda', items: [{ name: 'Legacy Migration Perfume', sku: 'MIG-001', quantity: 1, unitPrice: 366 }] }]
    }));
  });
  await page.goto('/');
  await navigateToView(page, 'products');
  await expect(page.locator('#product-table-body')).toContainText('$10.00');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  expect(saved.version).toBe(3);
  expect(saved.products[0].price).toBe(10);
  expect(saved.products[0].unitCost).toBe(6);
  expect(saved.orders[0].amount).toBe(11);
  expect(saved.orders[0].deliveryFee).toBe(1);
  expect(saved.orders[0].items[0].unitPrice).toBe(10);
  expect(await page.evaluate(() => localStorage.getItem('jbparfums-demo-data-v1'))).toBeNull();
});

test('order eye opens detailed demo record and displays matching item and total amounts', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await expect(page.getByRole('heading', { name: 'Pedidos y ventas' })).toBeVisible();

  await page.getByRole('button', { name: 'Ver pedido JP-1048' }).click();
  const detail = page.locator('#order-detail-dialog');
  await expect(detail).toBeVisible();
  await expect(detail.locator('#order-detail-title')).toHaveText('JP-1048');
  await expect(detail).toContainText('María Gutiérrez');
  await expect(detail).toContainText('Yara Lattafa');
  await expect(detail).toContainText('Eclaire Lattafa');
  await expect(detail).toContainText('$110.66');
  await expect(detail).toContainText('Transferencia');
  await expect(detail).toContainText(/registro ficticio/i);
  await expect(detail.locator('.order-items-table tbody tr')).toHaveCount(2);
});

test('order status changes are validated and persist locally after reload', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: 'Ver pedido JP-1047' }).click();

  const detail = page.locator('#order-detail-dialog');
  await expect(detail).toBeVisible();
  await expect(detail.locator('#order-status-select')).toHaveValue('Pendiente');
  await detail.locator('#order-status-select').selectOption('En preparación');
  await detail.getByRole('button', { name: 'Guardar estado' }).click();

  await expect(detail).not.toBeVisible();
  await expect(page.locator('#view-root')).toContainText('En preparación');
  await expect(page.locator('#toast-region')).toContainText(/actualizado en DEMO local/i);

  await page.reload();
  await navigateToView(page, 'orders');
  const orderRow = page.locator('#view-root tr').filter({ hasText: 'JP-1047' });
  await expect(orderRow).toContainText('En preparación');
  await page.getByRole('button', { name: 'Ver pedido JP-1047' }).click();
  await expect(page.locator('#order-status-select')).toHaveValue('En preparación');
});

test('each sample order opens its own detail record', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');

  for (const orderId of ['JP-1048', 'JP-1047', 'JP-1046', 'JP-1045', 'JP-1044']) {
    await page.getByRole('button', { name: 'Ver pedido ' + orderId }).click();
    await expect(page.locator('#order-detail-dialog #order-detail-title')).toHaveText(orderId);
    await page.locator('#order-detail-cancel').click();
  }
});


test('exchange rate is configurable and persists to DEMO settings',async({page})=>{
 await page.goto('/');await navigateToView(page, 'settings');
 const rate=page.locator('#exchange-rate-form input[name="exchangeRate"]');await expect(rate).toHaveValue('36.6000');
 await rate.fill('37.25');await page.getByRole('button',{name:'Guardar tipo de cambio'}).click();
 await expect(page.locator('#view-root')).toContainText('C$ 37.25 por US$ 1');await page.reload();await navigateToView(page, 'settings');
 await expect(page.locator('#exchange-rate-form input[name="exchangeRate"]')).toHaveValue('37.2500');
});
test('supplier invoice in córdobas retains rate without changing inventory',async({page})=>{
 await page.goto('/');await navigateToView(page, 'suppliers');await page.getByRole('button',{name:/Nuevo proveedor/}).click();
 const dialog=page.locator('#business-dialog');await dialog.locator('input[name="name"]').fill('Proveedor QA');await dialog.locator('select[name="currency"]').selectOption('NIO');
 await dialog.getByRole('button',{name:'Guardar en demo'}).click();await navigateToView(page, 'purchases');await page.getByRole('button',{name:/Registrar factura de proveedor/}).click();
 await dialog.locator('[data-lookup="supplier"]').fill('Proveedor QA');await dialog.getByRole('option',{name:/Proveedor QA/}).click();
 await dialog.locator('[data-lookup="product"]').fill('JBP-002');await dialog.getByRole('option',{name:/Yara Lattafa/}).click();
 await dialog.locator('input[name="quantity"]').fill('2');await dialog.locator('input[name="unitCost"]').fill('366');await dialog.locator('select[name="currency"]').selectOption('NIO');
 await dialog.getByRole('button',{name:'Guardar en demo'}).click();await expect(page.locator('#view-root')).toContainText('$20.00');
 await navigateToView(page, 'inventory');await expect(page.locator('.inventory-stock-table tbody tr').filter({hasText:'Yara Lattafa'})).toContainText('8 unidades');
});
test('payroll is NIO-only',async({page})=>{
 await page.goto('/');await navigateToView(page, 'hr');await page.getByRole('button',{name:/Agregar colaborador/}).click();
 const dialog=page.locator('#business-dialog');await expect(dialog.locator('select[name="currency"]')).toHaveCount(0);
 await dialog.locator('input[name="name"]').fill('Colaborador QA');await dialog.locator('input[name="position"]').fill('Asistente');await dialog.locator('input[name="salaryNio"]').fill('15000');
 await dialog.getByRole('button',{name:'Guardar en demo'}).click();await expect(page.locator('#view-root')).toContainText('Colaborador QA');await expect(page.locator('#view-root')).toContainText('15,000.00');
});
test('expenses support two currencies and cash account enforces currency match',async({page})=>{
 await page.goto('/');await navigateToView(page, 'expenses');await page.getByRole('button',{name:/Nuevo gasto/}).click();
 const dialog=page.locator('#business-dialog');await dialog.locator('select[name="category"]').selectOption({label:'Transporte'});
 await dialog.locator('input[name="description"]').fill('Transporte QA');await dialog.locator('input[name="amount"]').fill('366');await dialog.locator('select[name="currency"]').selectOption('NIO');
 await dialog.getByRole('button',{name:'Guardar en demo'}).click();await expect(page.locator('#view-root')).toContainText('$10.00');
 await navigateToView(page, 'cash');await page.getByRole('button',{name:/Registrar movimiento/}).click();
 await dialog.locator('input[name="concept"]').fill('Cobro QA');await dialog.locator('input[name="amount"]').fill('366');await dialog.locator('select[name="currency"]').selectOption('NIO');
 await dialog.locator('select[name="account"]').selectOption({label:'Caja USD'});await dialog.getByRole('button',{name:'Guardar en demo'}).click();
 await expect(dialog).toBeVisible();await expect(page.locator('#toast-region')).toContainText(/debe coincidir/i);
});


test('customer, order and internal voucher with NIO abono flow',async({page})=>{
 await page.goto('/');
 await navigateToView(page, 'customers');
 await page.getByRole('button',{name:/Nuevo cliente/}).click();
 const dialog=page.locator('#business-dialog');
 await dialog.locator('input[name="name"]').fill('Cliente Flujo QA');
 await dialog.locator('input[name="contact"]').fill('88880000');
 await dialog.getByRole('button',{name:'Guardar en demo'}).click();
 await navigateToView(page, 'orders');
 await page.getByRole('button',{name:/Nuevo pedido/}).click();
 await dialog.locator('[data-lookup="customer"]').fill('Cliente Flujo');
 await dialog.getByRole('option',{name:/Cliente Flujo QA/}).click();
 await dialog.locator('[data-lookup="product"]').fill('JBP-001');
 await dialog.getByRole('option',{name:/Club de Nuit Intense Man/}).click();
 await dialog.locator('input[name="quantity"]').fill('2');
 await dialog.locator('select[name="currency"]').selectOption('NIO');
 await dialog.getByRole('button',{name:'Guardar en demo'}).click();
 await expect(page.locator('#view-root')).toContainText('JP-1049');
 await expect(page.locator('#view-root')).toContainText('C$');
 await navigateToView(page, 'billing');
 await page.getByRole('button',{name:/Nueva factura/}).click();
 await dialog.locator('[name="saleSource"]').selectOption('web');
 await dialog.locator('[name="saleSource"]').selectOption('web');await dialog.locator('[data-lookup="order"]').fill('JP-1049');
 await dialog.getByRole('option',{name:/JP-1049/}).click();
 await expect(dialog.locator('#invoice-preview')).toContainText('Club de Nuit Intense Man');
 await expect(dialog.locator('#invoice-preview')).toContainText('133.88');
 await dialog.locator('select[name="currency"]').selectOption('NIO');
 await expect(dialog.locator('#invoice-preview')).toContainText('C$');
 await expect(dialog.locator('#invoice-preview')).toContainText('36.60');
 await expect(dialog.locator('[name="paymentMethod"]')).toHaveValue('Pendiente / crédito');
 await dialog.getByRole('button',{name:'Generar factura'}).click();
 await page.locator('#invoice-preview-dialog').getByRole('button',{name:'Cerrar'}).click();
 await navigateToView(page, 'billing');
 const voucher=page.locator('#view-root tbody tr').filter({hasText:'Cliente Flujo QA'});
 await expect(voucher).toContainText('Pendiente');
 await expect(voucher).toContainText('JP-1049');
 await voucher.getByRole('button',{name:'Abonar'}).click();
 await dialog.locator('input[name="amount"]').fill('4900');
 await dialog.locator('select[name="currency"]').selectOption('NIO');
 await dialog.locator('select[name="account"]').selectOption({label:'Caja NIO'});
 await dialog.getByRole('button',{name:'Registrar abono'}).click();
 await expect(page.locator('#view-root').locator('tr').filter({hasText:'JP-1049'})).toContainText('Pagado');
});


test('new order starts empty and requires searchable customer and perfume selections', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: /Nuevo pedido/ }).click();
  const dialog = page.locator('#business-dialog');
  const customerSearch = dialog.locator('[data-lookup="customer"]');
  const productSearch = dialog.locator('[data-lookup="product"]');
  await expect(customerSearch).toHaveValue('');
  await expect(productSearch).toHaveValue('');
  await expect(dialog.locator('input[type="hidden"][name="customerIndex"]')).toHaveValue('');
  await expect(dialog.locator('input[type="hidden"][name="productId"]')).toHaveValue('');
  await customerSearch.fill('María');
  await expect(dialog.getByRole('option', { name: /María Gutiérrez/ })).toBeVisible();
  await dialog.getByRole('option', { name: /María Gutiérrez/ }).click();
  await expect(dialog.locator('input[type="hidden"][name="customerIndex"]')).toHaveValue('0');
  await productSearch.fill('JBP-003');
  await expect(dialog.getByRole('option', { name: /Khamrah Lattafa/ })).toBeVisible();
  await dialog.getByRole('option', { name: /Khamrah Lattafa/ }).click();
  await expect(dialog.locator('input[type="hidden"][name="productId"]')).toHaveValue('3');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});

test('new internal voucher starts without a preselected sample order', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('[name="saleSource"]').selectOption('web');
  await expect(dialog.locator('[data-lookup="order"]')).toHaveValue('');
  await expect(dialog.locator('input[type="hidden"][name="orderId"]')).toHaveValue('');
  await dialog.locator('[name="saleSource"]').selectOption('web');await dialog.locator('[data-lookup="order"]').fill('JP-1048');
  await expect(dialog.getByRole('option', { name: /JP-1048/ })).toBeVisible();
  await dialog.getByRole('option', { name: /JP-1048/ }).click();
  await expect(dialog.locator('input[type="hidden"][name="orderId"]')).toHaveValue('JP-1048');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});


test('sidebar clearly identifies demo storage and pending integrations without fake progress', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.storage-card');
  await expect(card).toContainText('MODO DEMO ACTIVO');
  await expect(card).toContainText('Almacenamiento local');
  await expect(card).toContainText('Activo');
  await expect(card).toContainText('Neon PostgreSQL');
  await expect(card).toContainText('Cloudflare R2');
  await expect(card).toContainText('Pendiente');
  await expect(card.locator('.storage-meter')).toHaveCount(0);
  await expect(card.locator('.storage-connection')).toHaveCount(3);
});

test('invoice preview recalculates from linked order and selected exchange currency', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('[name="saleSource"]').selectOption('web');
  await dialog.locator('[name="saleSource"]').selectOption('web');await dialog.locator('[data-lookup="order"]').fill('JP-1048');
  await dialog.getByRole('option', { name: /JP-1048/ }).click();
  const preview = dialog.locator('#invoice-preview');
  await expect(preview).toContainText('María Gutiérrez');
  await expect(preview).toContainText('Yara Lattafa');
  await expect(preview).toContainText('Eclaire Lattafa');
  await expect(preview).toContainText('Subtotal');
  await expect(preview).toContainText('Entrega');
  await expect(preview).toContainText('Total a cobrar');
  await expect(preview).toContainText('Tipo de cambio aplicado');
  await dialog.locator('select[name="currency"]').selectOption('NIO');
  await expect(preview).toContainText('C$');
  await expect(preview).toContainText('110.66');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});

test('saved internal invoice keeps line items, computed totals and the exchange rate used', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('[name="saleSource"]').selectOption('web');
  await dialog.locator('[name="saleSource"]').selectOption('web');await dialog.locator('[data-lookup="order"]').fill('JP-1048');
  await dialog.getByRole('option', { name: /JP-1048/ }).click();
  await dialog.locator('select[name="currency"]').selectOption('NIO');
  await expect(dialog.locator('#invoice-preview')).toContainText('C$');
  await dialog.getByRole('button', { name: 'Generar factura' }).click();
  const row = page.locator('#view-root tr').filter({ hasText: 'JP-1048' });
  await expect(row).toContainText('Pagado');
  await expect(row).toContainText('C$');
  await expect(page.locator('#view-root')).toContainText('110.66');
});

test('confirming a pending order deducts stock once and returning it to pending restores stock', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: /Nuevo pedido/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('[data-lookup="customer"]').fill('María');
  await dialog.getByRole('option', { name: /María Gutiérrez/ }).click();
  await dialog.locator('[data-lookup="product"]').fill('JBP-001');
  await dialog.getByRole('option', { name: /Club de Nuit Intense Man/ }).click();
  await dialog.locator('input[name="quantity"]').fill('2');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();
  await page.getByRole('button', { name: 'Ver pedido JP-1049' }).click();
  await page.locator('#order-status-select').selectOption('En preparación');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await navigateToView(page, 'inventory');
  await expect(page.locator('#view-root .inventory-stock-table tbody tr').filter({ hasText: 'Club de Nuit Intense Man' })).toContainText('12 unidades');
  await expect(page.locator('.ledger-panel')).toContainText('Salida por pedido');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: 'Ver pedido JP-1049' }).click();
  await page.locator('#order-status-select').selectOption('Listo para entrega');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await navigateToView(page, 'inventory');
  await expect(page.locator('#view-root .inventory-stock-table tbody tr').filter({ hasText: 'Club de Nuit Intense Man' })).toContainText('12 unidades');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: 'Ver pedido JP-1049' }).click();
  await page.locator('#order-status-select').selectOption('Pendiente');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await navigateToView(page, 'inventory');
  await expect(page.locator('#view-root .inventory-stock-table tbody tr').filter({ hasText: 'Club de Nuit Intense Man' })).toContainText('14 unidades');
  await expect(page.locator('.ledger-panel')).toContainText('Reingreso por pedido');
});

test('order confirmation blocks insufficient stock without changing order or inventory', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: /Nuevo pedido/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('[data-lookup="customer"]').fill('María');
  await dialog.getByRole('option', { name: /María Gutiérrez/ }).click();
  await dialog.locator('[data-lookup="product"]').fill('JBP-003');
  await dialog.getByRole('option', { name: /Khamrah Lattafa/ }).click();
  await dialog.locator('input[name="quantity"]').fill('4');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();
  await page.getByRole('button', { name: 'Ver pedido JP-1049' }).click();
  await page.locator('#order-status-select').selectOption('En preparación');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await expect(page.locator('#toast-region')).toContainText(/stock insuficiente/i);
  await expect(page.locator('#order-status-select')).toHaveValue('En preparación');
  await page.locator('#order-detail-cancel').click();
  await navigateToView(page, 'inventory');
  await expect(page.locator('#view-root tr').filter({ hasText: 'Khamrah Lattafa' })).toContainText('3 unidades');
  await expect(page.locator('.ledger-panel')).not.toContainText('Salida por pedido');
});

test('completed orders cannot be reopened through the status editor', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'orders');
  await page.getByRole('button', { name: 'Ver pedido JP-1048' }).click();
  await page.locator('#order-status-select').selectOption('Pendiente');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await expect(page.locator('#toast-region')).toContainText(/no se puede reabrir/i);
  await expect(page.locator('#order-detail-dialog')).toBeVisible();
  await expect(page.locator('#order-status-select')).toHaveValue('Pendiente');
});

test('mobile product modal keeps the complete action footer visible while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Nuevo producto/ }).click();
  const dialog = page.locator('#product-dialog');
  await dialog.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const bounds = await dialog.evaluate(element => {
    const footer = element.querySelector('.modal-actions').getBoundingClientRect();
    const button = element.querySelector('#save-product').getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return { dialogBottom: box.bottom, dialogLeft: box.left, dialogRight: box.right, viewportWidth: window.innerWidth, footerBottom: footer.bottom, buttonHeight: button.height };
  });
  expect(bounds.dialogLeft).toBeGreaterThanOrEqual(0);
  expect(bounds.dialogRight).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.footerBottom).toBeLessThanOrEqual(bounds.dialogBottom + 1);
  expect(bounds.buttonHeight).toBeGreaterThanOrEqual(44);
});


test('mobile inventory tables fit the viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateToView(page, 'inventory');
  const dimensions = await page.evaluate(() => {
    const stock = document.querySelector('.inventory-stock-table');
    const ledger = document.querySelector('.inventory-ledger-table');
    return {
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      stockClient: stock.clientWidth,
      stockScroll: stock.scrollWidth,
      ledgerClient: ledger.clientWidth,
      ledgerScroll: ledger.scrollWidth,
      stockRowDisplay: getComputedStyle(stock.querySelector('tbody tr')).display,
      ledgerRowDisplay: getComputedStyle(ledger.querySelector('tbody tr')).display
    };
  });
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.stockScroll).toBeLessThanOrEqual(dimensions.stockClient + 1);
  expect(dimensions.ledgerScroll).toBeLessThanOrEqual(dimensions.ledgerClient + 1);
  expect(dimensions.stockRowDisplay).toBe('grid');
  expect(dimensions.ledgerRowDisplay).toBe('grid');
});

test('editing a product on mobile keeps dialog and inputs within screen width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: 'Editar Club de Nuit Intense Man' }).click();
  const dialog = page.locator('#product-dialog');
  const metrics = await dialog.evaluate(element => {
    const modal = element.getBoundingClientRect();
    const input = element.querySelector('input[name="name"]').getBoundingClientRect();
    const footer = element.querySelector('.modal-actions').getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      left: modal.left,
      right: modal.right,
      inputRight: input.right,
      footerRight: footer.right
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.inputRight).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.footerRight).toBeLessThanOrEqual(metrics.viewport);
});


test('all operational list tables reflow inside a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const views = ['products','orders','customers','billing','suppliers','purchaseOrders','purchases','expenses','profitability','capital','cash','hr'];
  for (const view of views) {
    await navigateToView(page, '' + view + '');
    const measurements = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      overflowElements: Array.from(document.querySelectorAll('body *')).map(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          className: typeof element.className === 'string' ? element.className.slice(0, 100) : null,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          position: style.position,
          whiteSpace: style.whiteSpace
        };
      }).filter(item => item.right > window.innerWidth + 1 && item.width > 0).slice(0, 20),
      tables: Array.from(document.querySelectorAll('.mobile-record-table')).map(table => ({
        client: table.clientWidth,
        scroll: table.scrollWidth
      }))
    }));
    expect(
      measurements.document,
      view + ' page document width; overflowing elements: ' + JSON.stringify(measurements.overflowElements)
    ).toBeLessThanOrEqual(measurements.viewport + 1);
    for (const table of measurements.tables) {
      expect(table.scroll, view + ' table width').toBeLessThanOrEqual(table.client + 1);
    }
  }
});


test('mobile topbar stays within a 320px viewport on long section names', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await navigateToView(page, 'billing');
  const bounds = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    actionsRight: document.querySelector('.topbar-actions').getBoundingClientRect().right,
    headingRight: document.querySelector('.breadcrumb').getBoundingClientRect().right
  }));
  expect(bounds.document).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.actionsRight).toBeLessThanOrEqual(bounds.viewport - 12);
  expect(bounds.headingRight).toBeLessThanOrEqual(bounds.viewport - 12);
});


test('in-store invoice creates the customer, updates stock once and opens a printable A4 preview', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();

  const modal = page.locator('#business-dialog');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Nombre del cliente').fill('Cliente QA Presencial');
  await modal.getByLabel('Perfume (nombre, SKU o código de barras)').fill('Yara Lattafa');
  await modal.locator('[data-lookup-select]').filter({ hasText: 'Yara Lattafa' }).click();
  await modal.getByRole('button', { name: 'Agregar producto' }).click();
  await modal.getByLabel('Cantidad de Yara Lattafa').fill('2');
  await modal.locator('select[name="currency"]').selectOption('NIO');
  await modal.getByLabel('Importe recibido (moneda de cobro)').fill('3700.26');
  await modal.getByRole('button', { name: 'Generar factura' }).click();

  const preview = page.locator('#invoice-preview-dialog');
  await expect(preview).toBeVisible();
  await expect(page.locator('#invoice-print-document')).toContainText('JB PARFUMS');
  await expect(page.locator('#invoice-print-document')).toContainText('Cliente QA Presencial');
  await expect(page.locator('#invoice-print-document')).toContainText('Yara Lattafa');
  await expect(preview.getByRole('button', { name: /Imprimir factura/ })).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  const yara = saved.products.find(product => product.name === 'Yara Lattafa');
  expect(yara.stock).toBe(6);
  expect(saved.invoices[0].source).toBe('store');
  expect(saved.invoices[0].status).toBe('Pagado');
  expect(saved.customers.some(customer => customer.name === 'Cliente QA Presencial')).toBe(true);
  expect(saved.inventoryMovements.filter(movement => movement.sourceType === 'invoice' && movement.sourceId === saved.invoices[0].id)).toHaveLength(1);
});

test('web order invoice links the order and does not apply stock twice', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();

  const modal = page.locator('#business-dialog');
  await modal.locator('[name="saleSource"]').selectOption('web');
  const orderSearch = modal.getByLabel('Buscar pedido web (número o cliente)');
  await expect(orderSearch).toBeVisible();
  await orderSearch.fill('JP-1047');
  await modal.locator('[data-lookup-select]').filter({ hasText: 'JP-1047' }).click();
  await expect(modal.getByLabel('Nombre del cliente')).toHaveValue('Carlos Mendoza');
  await expect(modal.locator('[name="paymentMethod"]')).toHaveValue('Efectivo contra entrega');
  await expect(modal.locator('#invoice-cart')).toContainText('Khamrah Lattafa');
  await modal.getByRole('button', { name: 'Generar factura' }).click();

  await expect(page.locator('#invoice-preview-dialog')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  const order = saved.orders.find(item => item.id === 'JP-1047');
  expect(saved.invoices[0].source).toBe('web');
  expect(saved.invoices[0].orderId).toBe('JP-1047');
  expect(order.status).toBe('En preparación');
  expect(saved.inventoryMovements.filter(movement => movement.sourceType === 'order' && movement.sourceId === 'JP-1047' && movement.delta < 0)).toHaveLength(1);
  expect(saved.products.find(product => product.name === 'Khamrah Lattafa').stock).toBe(2);

  await page.reload();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  expect(reloaded.products.find(product => product.name === 'Khamrah Lattafa').stock).toBe(2);
  expect(reloaded.invoices).toHaveLength(1);
});

test('in-store invoice blocks sales that exceed available stock', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();

  const modal = page.locator('#business-dialog');
  await modal.getByLabel('Nombre del cliente').fill('Cliente sin stock');
  await modal.getByLabel('Perfume (nombre, SKU o código de barras)').fill('Khamrah Lattafa');
  await modal.locator('[data-lookup-select]').filter({ hasText: 'Khamrah Lattafa' }).click();
  await modal.getByRole('button', { name: 'Agregar producto' }).click();
  await modal.getByLabel('Cantidad de Khamrah Lattafa').fill('4');
  await modal.getByRole('button', { name: 'Generar factura' }).click();

  await expect(modal).toBeVisible();
  await expect(page.locator('#toast-region')).toContainText(/Stock insuficiente para Khamrah Lattafa/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  expect(saved.invoices).toHaveLength(0);
  expect(saved.products.find(product => product.name === 'Khamrah Lattafa').stock).toBe(3);
});


test('supplier purchases support initial payments, partial balances and final settlement without duplicate stock', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'suppliers');
  await page.getByRole('button', { name: /Nuevo proveedor/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('input[name="name"]').fill('Proveedor CXP QA');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();

  await navigateToView(page, 'purchases');
  await page.getByRole('button', { name: /Registrar factura de proveedor/ }).click();
  await dialog.locator('[data-lookup="supplier"]').fill('Proveedor CXP');
  await dialog.getByRole('option', { name: /Proveedor CXP QA/ }).click();
  await dialog.locator('[data-lookup="product"]').fill('JBP-002');
  await dialog.getByRole('option', { name: /Yara Lattafa/ }).click();
  await dialog.locator('input[name="quantity"]').fill('2');
  await dialog.locator('input[name="unitCost"]').fill('5');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.locator('input[name="initialPayment"]').fill('2');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();

  await navigateToView(page, 'payables');
  const payableRow = page.locator('#view-root tbody tr').filter({ hasText: 'Proveedor CXP QA' });
  await expect(payableRow).toContainText('Abono parcial');
  await expect(payableRow).toContainText('$8.00');

  await payableRow.getByRole('button', { name: 'Registrar abono' }).click();
  await dialog.locator('input[name="amount"]').fill('3');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.locator('select[name="account"]').selectOption({ label: 'Caja USD' });
  await dialog.getByRole('button', { name: 'Registrar abono' }).click();
  await expect(page.locator('#view-root')).toContainText('$5.00');

  const stockBeforeSettlement = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('jbparfums-demo-data-v2'));
    return saved.products.find(product => product.sku === 'JBP-002').stock;
  });

  const updatedRow = page.locator('#view-root tbody tr').filter({ hasText: 'Proveedor CXP QA' });
  await updatedRow.getByRole('button', { name: 'Registrar abono' }).click();
  await dialog.locator('input[name="amount"]').fill('5');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.locator('select[name="account"]').selectOption({ label: 'Caja USD' });
  await dialog.getByRole('button', { name: 'Registrar abono' }).click();

  await expect(page.locator('#view-root')).toContainText('No hay cuentas pendientes con proveedores.');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  const purchase = saved.purchases.find(item => item.supplier === 'Proveedor CXP QA');
  expect(purchase.paidUsd).toBe(10);
  expect(purchase.status).toBe('Pagado');
  expect(purchase.payments).toHaveLength(3);
  expect(saved.cashEntries.filter(item => item.sourceType === 'purchase' && item.sourceId === String(purchase.id))).toHaveLength(3);
  expect(saved.cashEntries.filter(item => item.sourceType === 'purchase' && item.sourceId === String(purchase.id)).reduce((sum,item)=>sum+item.amountUsd,0)).toBe(10);
  expect(saved.products.find(product => product.sku === 'JBP-002').stock).toBe(stockBeforeSettlement);
});


test('customer receivables track an initial payment, partial abono and final settlement', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('input[name="customerName"]').fill('Cliente CXC QA');
  await dialog.locator('[data-lookup="product"]').fill('JBP-002');
  await dialog.getByRole('option', { name: /Yara Lattafa/ }).click();
  await dialog.getByRole('button', { name: 'Agregar producto' }).click();
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.locator('input[name="amountReceived"]').fill('10');
  await dialog.getByRole('button', { name: 'Generar factura' }).click();

  await page.locator('#invoice-preview-dialog').getByRole('button', { name: 'Cerrar' }).click();
  await navigateToView(page, 'receivables');
  const row = page.locator('#view-root tbody tr').filter({ hasText: 'Cliente CXC QA' });
  await expect(row).toContainText('Abono parcial');
  await expect(row).toContainText('1 abono(s)');
  const stockAfterInvoice = await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')); return saved.products.find(p=>p.sku==='JBP-002').stock; });

  await row.getByRole('button', { name: 'Registrar abono' }).click();
  await dialog.locator('input[name="amount"]').fill('10');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.locator('select[name="account"]').selectOption({ label: 'Caja USD' });
  await dialog.getByRole('button', { name: 'Registrar abono' }).click();

  await expect(page.locator('#view-root tbody tr').filter({ hasText: 'Cliente CXC QA' })).toContainText('Abono parcial');
  await expect(page.locator('#view-root tbody tr').filter({ hasText: 'Cliente CXC QA' })).toContainText('2 abono(s)');
  const afterPartial = await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')); return saved.products.find(p=>p.sku==='JBP-002').stock; });
  expect(afterPartial).toBe(stockAfterInvoice);

  await page.locator('#view-root tbody tr').filter({ hasText: 'Cliente CXC QA' }).getByRole('button', { name: 'Registrar abono' }).click();
  await dialog.locator('input[name="amount"]').fill('30.55');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.locator('select[name="account"]').selectOption({ label: 'Caja USD' });
  await dialog.getByRole('button', { name: 'Registrar abono' }).click();

  await expect(page.locator('#view-root')).toContainText('No hay cuentas pendientes de cobro.');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  const invoice = saved.invoices.find(item => item.customer === 'Cliente CXC QA');
  expect(invoice.status).toBe('Pagado');
  expect(invoice.payments).toHaveLength(3);
  expect(saved.cashEntries.filter(item => item.sourceType === 'invoice' && item.sourceId === invoice.id)).toHaveLength(3);
  expect(saved.products.find(p=>p.sku==='JBP-002').stock).toBe(stockAfterInvoice);
});


test('invoice keeps USD as the primary sale currency when collection is changed to NIO', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'billing');
  await page.getByRole('button', { name: /Nueva factura/ }).click();
  const dialog = page.locator('#business-dialog');
  const currency = dialog.locator('select[name="currency"]');
  const preview = dialog.locator('#invoice-preview');
  await expect(currency).toHaveValue('USD');
  await dialog.locator('[name="customerName"]').fill('Cliente QA USD');
  await dialog.locator('[data-lookup="product"]').fill('JBP-001');
  await dialog.getByRole('option', { name: /Club de Nuit Intense Man/ }).click();
  await dialog.getByRole('button', { name: 'Agregar producto' }).click();
  await dialog.locator('input[name="discountUsd"]').fill('10');
  await expect(preview.locator('.invoice-line-unit strong').first()).toContainText('66.94');
  await expect(preview.locator('.invoice-line-unit small').first()).toContainText('2,450.00');
  const discount = preview.locator('.invoice-preview-totals > div').filter({ hasText: 'Descuento (USD)' });
  await expect(discount.locator('strong')).toContainText('10.00');
  await expect(discount.locator('strong small')).toContainText('366.00');
  await expect(preview.locator('.invoice-grand-total strong')).toContainText('56.94');
  await currency.selectOption('NIO');
  await expect(preview.locator('.invoice-line-unit strong').first()).toContainText('66.94');
  await expect(discount.locator('strong')).toContainText('10.00');
  await expect(preview.locator('.invoice-grand-total strong')).toContainText('56.94');
  await dialog.getByRole('button', { name: 'Generar factura' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  expect(saved.invoices[0].currency).toBe('USD');
  expect(saved.invoices[0].paymentCurrency).toBe('NIO');
  expect(saved.invoices[0].status).toBe('Pagado');
  expect(saved.invoices[0].totalUsd).toBe(56.94);
});


test('purchase orders do not create stock or payables and support partial receipts', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'suppliers');
  await page.getByRole('button', { name: /Nuevo proveedor/ }).click();
  const dialog = page.locator('#business-dialog');
  await dialog.locator('input[name="name"]').fill('Proveedor OC QA');
  await dialog.locator('input[name="phone"]').fill('88880000');
  await dialog.locator('select[name="currency"]').selectOption('USD');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();

  await navigateToView(page, 'purchaseOrders');
  await page.getByRole('button', { name: /Nueva orden/ }).click();
  await dialog.locator('[data-lookup="supplier"]').fill('Proveedor OC QA');
  await dialog.getByRole('option', { name: /Proveedor OC QA/ }).click();
  const first = dialog.locator('.po-line-row').nth(0);
  await first.locator('[data-po-product]').selectOption('2');
  await first.locator('[data-po-quantity]').fill('3');
  await first.locator('[data-po-cost]').fill('8');
  await dialog.getByRole('button', { name: 'Agregar producto' }).click();
  const second = dialog.locator('.po-line-row').nth(1);
  await second.locator('[data-po-product]').selectOption('3');
  await second.locator('[data-po-quantity]').fill('2');
  await second.locator('[data-po-cost]').fill('10');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();

  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  const order = saved.purchaseOrders[0];
  expect(order.number).toMatch(/^OC-\d{4}-\d{4}$/);
  expect(order.status).toBe('Borrador');
  expect(order.items).toHaveLength(2);
  expect(saved.products.find(p => p.sku === 'JBP-002').stock).toBe(8);
  expect(saved.products.find(p => p.sku === 'JBP-003').stock).toBe(3);
  expect(saved.cashEntries).toHaveLength(0);
  expect(saved.purchases).toHaveLength(0);

  let row = page.locator('#view-root tbody tr').filter({ hasText: order.number });
  await row.getByRole('button', { name: 'Marcar enviada' }).click();
  row = page.locator('#view-root tbody tr').filter({ hasText: order.number });
  await row.getByRole('button', { name: 'Confirmar' }).click();
  row = page.locator('#view-root tbody tr').filter({ hasText: order.number });
  await row.getByRole('button', { name: 'Recibir' }).click();
  await dialog.locator('[data-receipt-quantity="0"]').fill('1');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();

  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  expect(saved.purchaseOrders[0].status).toBe('Recepción parcial');
  expect(saved.purchaseOrders[0].items[0].receivedQuantity).toBe(1);
  expect(saved.products.find(p => p.sku === 'JBP-002').stock).toBe(9);
  expect(saved.products.find(p => p.sku === 'JBP-003').stock).toBe(3);
  expect(saved.purchaseReceipts).toHaveLength(1);
  expect(saved.cashEntries).toHaveLength(0);
  expect(saved.purchases).toHaveLength(0);

  row = page.locator('#view-root tbody tr').filter({ hasText: order.number });
  await row.getByRole('button', { name: 'Recibir' }).click();
  await dialog.locator('[data-receipt-quantity="0"]').fill('2');
  await dialog.locator('[data-receipt-quantity="1"]').fill('2');
  await dialog.getByRole('button', { name: 'Guardar en demo' }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jbparfums-demo-data-v2')));
  expect(saved.purchaseOrders[0].status).toBe('Recibida');
  expect(saved.products.find(p => p.sku === 'JBP-002').stock).toBe(11);
  expect(saved.products.find(p => p.sku === 'JBP-003').stock).toBe(5);
  expect(saved.purchaseReceipts).toHaveLength(2);
});

test('profitability and capital dashboards are clearly separated', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'capital');
  await expect(page.getByRole('heading', { name: 'Capital y flujo de efectivo' })).toBeVisible();
  await expect(page.locator('#view-root')).toContainText('no incluye saldo inicial');
  await navigateToView(page, 'profitability');
  await expect(page.getByRole('heading', { name: 'Rentabilidad' })).toBeVisible();
  await expect(page.locator('#view-root')).toContainText('no es contabilidad oficial');
});
