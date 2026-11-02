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
  await page.getByLabel('SKU / Código').fill('QA-ERP-001');
  await page.getByLabel('Categoría').selectOption('Árabes');
  await page.getByLabel('Precio de venta (C$)').fill('1250');
  await dialog.getByLabel('Existencias').fill('4');
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
  await dialog.getByLabel('Existencias').fill('1');
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
