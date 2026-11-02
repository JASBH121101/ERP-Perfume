import { test, expect } from '@playwright/test';

test('ERP renders the dashboard and all primary modules', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/JB PARFUMS/);
  await expect(page.getByRole('heading', { name: /Buenos días/ })).toBeVisible();

  await page.locator('#sidebar button[data-view="products"]').click();
  await expect(page.getByRole('heading', { name: 'Catálogo de productos' })).toBeVisible();

  await page.locator('#sidebar button[data-view="billing"]').click();
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible();
  await expect(page.getByText(/no emite comprobantes fiscales reales/i)).toBeVisible();

  await page.locator('#sidebar button[data-view="hr"]').click();
  await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible();
  await expect(page.getByText(/no contiene empleados reales/i)).toBeVisible();
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
  await page.locator('#sidebar button[data-view="products"]').click();

  await page.getByLabel('Buscar productos').fill('Khamrah');
  await expect(page.locator('#product-table-body')).toContainText('Khamrah Lattafa');
  await expect(page.locator('#product-table-body')).not.toContainText('Yara Lattafa');

  await page.locator('#stock-filter').selectOption('low');
  await expect(page.locator('#product-table-body')).toContainText('Khamrah Lattafa');
  await expect(page.locator('#product-table-body')).not.toContainText('Yara Lattafa');
});

test('a new product can be added to the demo session', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sidebar button[data-view="products"]').click();
  await page.getByRole('button', { name: /Nuevo producto/ }).click();

  const dialog = page.locator('#product-dialog');
  await expect(dialog).toBeVisible();
  await page.getByLabel('Nombre del perfume').fill('Fragancia QA Automatizada');
  await page.getByLabel('SKU / Código interno').fill('QA-ERP-001');
  await dialog.locator('select[name="category"]').selectOption('Árabes');
  await page.getByLabel('Precio de venta (C$)').fill('1250');
  await dialog.getByLabel('Existencias iniciales').fill('4');
  await page.getByRole('button', { name: /Agregar a demo/ }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#product-table-body')).toContainText('Fragancia QA Automatizada');
  await expect(page.locator('#product-count')).toHaveText('09');
  await expect(page.getByText(/no se ha guardado en Neon/i)).toBeVisible();
});


test('product master calculates unit cost, profit and gross margin', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sidebar button[data-view="products"]').click();
  await page.getByRole('button', { name: /Nuevo producto/ }).click();

  const dialog = page.locator('#product-dialog');
  await dialog.getByLabel('Nombre del perfume').fill('QA Oud Reserve');
  await dialog.getByLabel('Marca').fill('QA Maison');
  await dialog.getByLabel('SKU / Código interno').fill('QA-COST-001');
  await dialog.getByLabel('Concentración').selectOption('Eau de Parfum (EDP)');
  await dialog.getByLabel('Género').selectOption('Unisex');
  await dialog.getByLabel('Contenido (ml)').fill('100');
  await dialog.getByLabel('Proveedor').fill('Proveedor QA');
  await dialog.getByLabel('Costo de compra (C$)').fill('900');
  await dialog.getByLabel('Costos adicionales (C$)').fill('100');
  await dialog.getByLabel('Precio de venta (C$)').fill('1500');

  await expect(dialog.locator('#unit-cost-preview')).toHaveText('C$ 1,000');
  await expect(dialog.locator('#unit-profit-preview')).toHaveText('C$ 500');
  await expect(dialog.locator('#gross-margin-preview')).toHaveText('33.3%');

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
  await page.locator('#sidebar button[data-view="inventory"]').click();

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
  await page.locator('#sidebar button[data-view="products"]').click();

  await page.getByLabel('Filtrar por categoría').selectOption('Diseñador');
  await expect(page.locator('#product-table-body')).toContainText('Club de Nuit Intense Man');
  await expect(page.locator('#product-table-body')).not.toContainText('Yara Lattafa');
});

test('product names are rendered as text, not executable markup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sidebar button[data-view="products"]').click();
  await page.getByRole('button', { name: /Nuevo producto/ }).click();
  const dialog = page.locator('#product-dialog');

  let scriptDialogs = 0;
  page.on('dialog', async browserDialog => {
    scriptDialogs += 1;
    await browserDialog.dismiss();
  });

  const payload = '<img src=x onerror=alert(1)>';
  await page.getByLabel('Nombre del perfume').fill(payload);
  await page.getByLabel('Precio de venta (C$)').fill('100');
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
  await page.locator('#sidebar button[data-view="billing"]').click();

  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible();
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
});


test('product creation and edits persist locally after reload without changing stock', async ({ page }) => {
  await page.goto('/'); await page.locator('#sidebar button[data-view="products"]').click();
  await page.getByRole('button', { name: /Nuevo producto/ }).click();
  const dialog=page.locator('#product-dialog');
  await dialog.getByLabel('Nombre del perfume').fill('QA Persistente');
  await dialog.getByLabel('SKU / Código interno').fill('QA-PERSIST-01');
  await dialog.getByLabel('Precio de venta (C$)').fill('1500');
  await dialog.getByLabel('Existencias iniciales').fill('6');
  await dialog.getByRole('button', { name: /Agregar a demo/ }).click();
  await page.reload(); await page.locator('#sidebar button[data-view="products"]').click();
  await expect(page.locator('#product-table-body')).toContainText('QA Persistente');
  await page.getByRole('button', { name: 'Editar QA Persistente' }).click();
  await dialog.getByLabel('Nombre del perfume').fill('QA Persistente Editado');
  await dialog.getByLabel('Precio de venta (C$)').fill('1750');
  await expect(dialog.getByLabel('Existencias iniciales')).toHaveValue('6');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#product-table-body')).toContainText('QA Persistente Editado');
  await expect(page.locator('#product-table-body')).toContainText('6 uds.');
  await page.reload(); await page.locator('#sidebar button[data-view="products"]').click();
  await expect(page.locator('#product-table-body')).toContainText('QA Persistente Editado');
});

test('products can be deactivated and reactivated from the catalogue', async ({ page }) => {
  await page.goto('/'); await page.locator('#sidebar button[data-view="products"]').click();
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
  await page.goto('/'); await page.locator('#sidebar button[data-view="inventory"]').click();
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
  await inventory.getByRole('button', { name: 'Registrar movimiento' }).click();
  await stockDialog.locator('select[name="productId"]').selectOption('2');
  await stockDialog.locator('select[name="type"]').selectOption('adjustment');
  await stockDialog.locator('input[name="quantity"]').fill('7');
  await stockDialog.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(inventory).toContainText('7 unidades');
  await expect(inventory.locator('.ledger-panel')).toContainText('Entrada');
  await expect(inventory.locator('.ledger-panel')).toContainText('Salida');
  await expect(inventory.locator('.ledger-panel')).toContainText('Ajuste');
  await page.reload(); await page.locator('#sidebar button[data-view="inventory"]').click();
  await expect(page.locator('#view-root')).toContainText('7 unidades');
  await expect(page.locator('.ledger-panel')).toContainText('Ajuste');
});

test('inventory CSV export is available', async ({ page }) => {
  await page.goto('/'); await page.locator('#sidebar button[data-view="inventory"]').click();
  const download=page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar CSV/ }).click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('jb-parfums-inventario-demo.csv');
});

test('mobile drawer scroll is isolated from page background', async ({ page }) => { await page.setViewportSize({width:390,height:844}); await page.goto('/'); await page.evaluate(()=>window.scrollTo(0,0)); await page.getByRole('button',{name:'Abrir menú'}).click(); const drawer=page.locator('#sidebar'); await expect(drawer).toHaveClass(/open/); await expect(page.locator('body')).toHaveClass(/mobile-menu-open/); const d=await drawer.evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY})); expect(d.scroll).toBeGreaterThan(d.client); expect(d.overflow).toBe('auto'); await drawer.evaluate(el=>{el.scrollTop=el.scrollHeight}); await expect.poll(()=>drawer.evaluate(el=>el.scrollTop)).toBeGreaterThan(0); expect(await page.evaluate(()=>window.scrollY)).toBe(0); await page.locator('#mobile-scrim').click({position:{x:370,y:400}}); await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/); });
