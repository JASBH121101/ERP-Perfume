import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inventoryApiFixtureResponse } from './inventory-api-fixtures.mjs';

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
  employee_history: [], employee_documents: [],
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
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname;
    if (request.method() === 'GET') {
      const inventoryPayload = inventoryApiFixtureResponse(pathname, requestUrl.searchParams, fixture);
      if (inventoryPayload) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inventoryPayload) });
      }
    }
    if (pathname.endsWith('/bootstrap') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: fixture }) });
    }
    if (pathname.endsWith('/resource-usage') && request.method() === 'GET') {
      return route.fulfill({
        status:200, contentType:'application/json',
        body:JSON.stringify({
          updatedAt:'2026-11-07T00:00:00.000Z',
          database:{sizeBytes:134217728,activeConnections:2,transactionsCommitted:1200,transactionsRolledBack:3},
          storage:{sizeBytes:268435456,objectCount:42,complete:true,scannedPages:1},
          errors:{database:null,storage:null}
        })
      });
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

async function installHRFixtureApi(page) {
  await page.unroute(workerPattern);
  const data=structuredClone(fixture);
  const employeeId='00000000-0000-0000-0000-000000000201';
  data.employees=[{
    id:employeeId,employee_code:'JB-EMP-0002',name:'Colaborador QA',position:'Asistente',
    department:'Operaciones',salary_nio:10000,status:'Activo',hire_date:'2023-01-01',
    phone:null,email:null,commission_enabled:false,commission_rate:0,notes:null
  }];
  data.employee_history=[
    {id:'history-hire',employee_id:employeeId,event_type:'hire',effective_date:'2023-01-01',to_position:'Asistente',to_department:'Operaciones',reason:'Alta inicial'},
    {id:'history-comp',employee_id:employeeId,event_type:'compensation',effective_date:'2023-01-01',to_salary_nio:10000,to_commission_enabled:false,to_commission_rate:0,reason:'Condiciones iniciales'}
  ];
  data.employee_documents=[];
  const requests=[];
  await page.route(workerPattern,async route=>{
    const request=route.request(),url=new URL(request.url()),pathname=url.pathname,method=request.method();
    if(pathname.endsWith('/bootstrap')&&method==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})});
    if(pathname==='/api/erp/employees/'+employeeId&&method==='PATCH'){
      const payload=request.postDataJSON();requests.push({method,path:pathname,payload});
      const row=data.employees[0];
      const old={...row};
      Object.assign(row,{
        name:payload.name,phone:payload.phone,email:payload.email,position:payload.position,
        department:payload.department,salary_nio:payload.salary_nio,status:payload.status,
        commission_enabled:payload.commission_enabled,commission_rate:payload.commission_rate
      });
      if(old.position!==row.position||old.department!==row.department)data.employee_history.unshift({
        id:'history-position-new',employee_id:employeeId,event_type:'position',effective_date:payload.effective_date,
        from_position:old.position,to_position:row.position,from_department:old.department,to_department:row.department,
        reason:payload.change_reason
      });
      if(Number(old.salary_nio)!==Number(row.salary_nio))data.employee_history.unshift({
        id:'history-salary-new',employee_id:employeeId,event_type:'compensation',effective_date:payload.effective_date,
        from_salary_nio:old.salary_nio,to_salary_nio:row.salary_nio,from_commission_enabled:old.commission_enabled,
        to_commission_enabled:row.commission_enabled,from_commission_rate:old.commission_rate,to_commission_rate:row.commission_rate,
        reason:payload.change_reason
      });
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({record:row})});
    }
    if(pathname==='/api/erp/employee-documents'&&method==='POST'){
      const document={
        id:'00000000-0000-0000-0000-000000000301',employee_id:employeeId,document_type:'Contrato',
        file_name:'contrato-qa.pdf',file_type:'application/pdf',file_size:12,created_at:'2026-11-06T16:00:00.000Z'
      };
      data.employee_documents.unshift(document);
      requests.push({method,path:pathname,contentType:request.headers()['content-type']});
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({document})});
    }
    if(pathname==='/api/erp/employee-documents/00000000-0000-0000-0000-000000000301/file'&&method==='GET'){
      requests.push({method,path:pathname});
      return route.fulfill({status:200,contentType:'application/pdf',headers:{'content-disposition':'attachment; filename="contrato-qa.pdf"'},body:Buffer.from('%PDF-1.4 QA')});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({records:[],data})});
  });
  return {data,requests,employeeId};
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
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname;
    const method = request.method();
    requests.push({ method, pathname, body: request.postDataJSON?.() || null });

    if (method === 'GET') {
      const inventoryPayload = inventoryApiFixtureResponse(pathname, requestUrl.searchParams, data);
      if (inventoryPayload) return fulfill(route, inventoryPayload);
    }

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
        notes: payload.notes || null, authenticity_type: payload.authenticity_type || 'unspecified',
        inspired_by: payload.inspired_by || null, images: [], created_at: new Date().toISOString()
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

    const reversalMatch = pathname.match(/\/api\/erp\/inventory-movements\/([^/]+)\/reverse$/i);
    if (reversalMatch && method === 'POST') {
      const original = data.inventory_movements.find(item => String(item.id) === reversalMatch[1]);
      if (!original || original.reference_type !== 'manual') {
        return fulfill(route, { error: { message: 'Solo se pueden revertir movimientos manuales.' } }, 409);
      }
      if (data.inventory_movements.some(item =>
        item.reference_type === 'reversal' && String(item.reference_id) === String(original.id)
      )) {
        return fulfill(route, { error: { message: 'El movimiento ya fue revertido.' } }, 409);
      }
      const reason = String(request.postDataJSON()?.reason || '').trim();
      if (reason.length < 3 || reason.length > 240) {
        return fulfill(route, { error: { message: 'Indica un motivo válido.' } }, 400);
      }
      const product = data.products.find(item => String(item.id) === String(original.product_id));
      if (!product) return fulfill(route, { error: { message: 'Producto no encontrado.' } }, 404);
      const previousStock = Number(product.stock || 0);
      const nextStock = previousStock - Number(original.quantity_delta || 0);
      if (nextStock < 0) return fulfill(route, { error: { message: 'La reversión dejaría stock negativo.' } }, 409);
      product.stock = nextStock;
      const reversal = {
        id: 'qa-reversal-' + String(data.inventory_movements.length + 1),
        product_id: original.product_id, movement_type: 'Reversion',
        quantity: Math.abs(Number(original.quantity_delta || 0)),
        quantity_delta: -Number(original.quantity_delta || 0),
        previous_stock: previousStock, new_stock: nextStock,
        note: 'Reversión de movimiento ' + original.id + ': ' + reason,
        reference_type: 'reversal', reference_id: String(original.id),
        created_at: new Date().toISOString()
      };
      data.inventory_movements.unshift(reversal);
      mutationCommitted = true;
      return fulfill(route, { record: reversal }, 201);
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
  const inventoryDonut = page.locator('.inventory-donut');
  await expect(inventoryDonut).toBeVisible();
  await expect(inventoryDonut).toHaveAttribute('aria-label', /Distribución de productos/);
  await expect(page.locator('.donut-legend-item')).toHaveCount(3);
  await navigateToView(page, 'products');
  await expect(page.getByRole('heading', { name: 'Catálogo de productos' })).toBeVisible();
  await expect(page.locator('#product-table-body')).toContainText('QA Fixture Perfume');
  await navigateToView(page, 'billing');
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible();
  await navigateToView(page, 'hr');
  await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible();
  await expect(page.locator('.hr-summary-strip')).toBeVisible();
  await expect(page.locator('.hr-tabs')).toBeVisible();
  await navigateToView(page, 'analytics');
  await expect(page.getByRole('heading', { name: 'Informes y análisis' })).toBeVisible();
});

test('inventory products search by SKU and filter category and stock status', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'inventory');
  await expect(page.locator('.inventory-stock-panel')).toBeVisible();
  await expect(page.locator('.inventory-products-meta')).toBeVisible();
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
  const toast = page.locator('#toast-region .toast').last();
  await expect(toast).toBeVisible();
  const toastFontSize = await toast.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(toastFontSize).toBeGreaterThanOrEqual(12);
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

test('Kardex allows an authorized user to reverse a manual movement with an audit reason', async ({ page }) => {
  const api = await installStatefulInventoryApi(page);
  await page.goto('/');
  await navigateToView(page, 'inventory');

  const originalId = 'qa-movement-27';
  const originalRow = page.locator('#inventory-movement-body tr[data-movement-id="' + originalId + '"]');
  const reverseButton = originalRow.locator('[data-action="reverse-inventory-movement"]');
  await expect(reverseButton).toBeVisible();
  await reverseButton.click();

  const dialog = page.locator('#inventory-reversal-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#inventory-reversal-summary')).toContainText('QA Fixture Perfume');
  await dialog.locator('[name="reason"]').fill('Entrada duplicada en conteo QA');

  const reversalRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/inventory-movements/' + originalId + '/reverse') &&
    request.method() === 'POST'
  );
  await dialog.locator('[type="submit"]').click();
  await reversalRequest;

  await expect(dialog).toBeHidden();
  expect(api.data.products.find(product => product.id === fixture.products[0].id).stock).toBe(3);
  const reversal = api.data.inventory_movements.find(item =>
    item.reference_type === 'reversal' && String(item.reference_id) === originalId
  );
  expect(reversal).toBeTruthy();
  expect(reversal.movement_type).toBe('Reversion');
  expect(reversal.quantity_delta).toBe(-2);
  expect(reversal.note).toContain('Entrada duplicada en conteo QA');
  expect(api.data.inventory_movements.find(item => item.id === originalId).movement_type).toBe('Entrada');
});

test('inventory kardex searches, filters by type and date, and paginates all movements', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'inventory');
  const rows = page.locator('#inventory-movement-body tr');
  await expect(rows).toHaveCount(25);
  await expect(page.locator('.inventory-ledger-panel .inventory-ledger-footer .ledger-count')).toHaveText('Página 1 de 2');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.locator('.inventory-ledger-panel .inventory-ledger-footer .ledger-count')).toHaveText('Página 2 de 2');

  await page.getByLabel('Filtrar movimientos por tipo').selectOption('Entrada');
  await expect(rows).toHaveCount(14);
  await expect(page.locator('.inventory-ledger-panel .inventory-ledger-footer .ledger-count')).toHaveText('Página 1 de 1');

  await page.getByLabel('Buscar en el kardex').fill('Movimiento QA 27');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Movimiento QA 27');

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await page.getByLabel('Desde fecha').fill('2026-11-04');
  await page.getByLabel('Hasta fecha').fill('2026-11-04');
  await expect(rows).toHaveCount(9);
  await expect(page.locator('.inventory-ledger-panel .inventory-ledger-footer .ledger-count')).toHaveText('Página 1 de 1');
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

test('employee edit preserves hire date and records a promotion reason', async ({ page }) => {
  const hr=await installHRFixtureApi(page);
  await page.goto('/');
  await navigateToView(page,'hr');
  await page.locator('[data-action="edit-employee"]').click();
  const dialog=page.locator('#business-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="name"]')).toHaveValue('Colaborador QA');
  await expect(dialog.locator('[name="hireDate"]')).toHaveCount(0);
  await expect(dialog.getByText('Fecha original de ingreso',{exact:true})).toBeVisible();
  await dialog.locator('[name="position"]').fill('Supervisor de operaciones');
  await dialog.locator('[name="salaryNio"]').fill('12500');
  await dialog.locator('[name="changeReason"]').fill('Ascenso por desempeño');
  const patch=page.waitForRequest(request=>request.url().endsWith('/api/erp/employees/'+hr.employeeId)&&request.method()==='PATCH');
  await dialog.locator('#business-save').click();
  const request=await patch,payload=request.postDataJSON();
  expect(payload.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(payload.change_reason).toBe('Ascenso por desempeño');
  expect(payload.hire_date).toBeUndefined();
  await expect(dialog).toBeHidden();
});

test('employee history attaches and downloads private personnel documents', async ({ page }) => {
  const hr=await installHRFixtureApi(page);
  await page.goto('/');
  await navigateToView(page,'hr');
  await page.locator('[data-action="view-employee"]').click();
  const dialog=page.locator('#business-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Historial laboral')).toBeVisible();
  await expect(dialog.locator('strong').filter({hasText:'Alta inicial'}).first()).toBeVisible();
  await dialog.locator('#employee-document-file').setInputFiles({
    name:'contrato-qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA')
  });
  const upload=page.waitForRequest(request=>request.url().endsWith('/api/erp/employee-documents')&&request.method()==='POST');
  await dialog.locator('[data-action="upload-employee-document"]').click();
  const uploadRequest=await upload;
  expect(uploadRequest.headers()['content-type']).toContain('multipart/form-data');
  await expect(dialog.getByText('contrato-qa.pdf')).toBeVisible();
  const download=page.waitForEvent('download');
  await dialog.locator('[data-action="download-employee-document"]').click();
  const file=await download;
  expect(file.suggestedFilename()).toBe('contrato-qa.pdf');
  expect(hr.data.employee_documents).toHaveLength(1);
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

test('employee registration allows completing recovery contacts later', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'hr');
  await page.getByRole('button', { name: /Agregar colaborador/ }).click();

  const dialog = page.locator('#business-dialog');
  await dialog.locator('[name="name"]').fill('Colaborador sin contacto');
  await dialog.locator('[name="position"]').fill('Asistente');
  await dialog.locator('[name="salaryNio"]').fill('8000');

  const post = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/employees') && request.method() === 'POST'
  );
  await dialog.locator('#business-save').click();
  const request = await post;
  const payload = request.postDataJSON();

  expect(payload.email).toBeNull();
  expect(payload.phone).toBeNull();
  expect(payload.commission_enabled).toBe(false);
  expect(payload.commission_rate).toBe(0);
  await expect(dialog).toBeHidden();
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
  await expect(dialog).not.toContainText(/Neon|Cloudflare|R2/i);
  const accept = await dialog.locator('#catalog-import-file').getAttribute('accept');
  for (const extension of ['.csv', '.pdf', '.png', '.jpg', '.jpeg']) expect(accept).toContain(extension);
  await expect(dialog).toContainText('Admite CSV, PDF, PNG, JPG y JPEG');
});

test('catalog import dialog fits desktop and mobile viewports without clipping its form', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/');
  await navigateToView(page, 'products');
  await page.getByRole('button', { name: /Importar catálogo/ }).click();
  const dialog = page.locator('#catalog-import-dialog');
  await expect(dialog).toBeVisible();
  const desktop = await dialog.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    clientWidth: element.clientWidth,
    formClientWidth: element.querySelector('.modal-card').clientWidth,
    formScrollWidth: element.querySelector('.modal-card').scrollWidth
  }));
  expect(desktop.width).toBeGreaterThan(900);
  expect(desktop.formScrollWidth).toBeLessThanOrEqual(desktop.formClientWidth + 1);
  await dialog.locator('[data-import-close]').first().click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Importar catálogo/ }).click();
  const mobile = await dialog.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    viewportWidth: window.innerWidth,
    formClientWidth: element.querySelector('.modal-card').clientWidth,
    formScrollWidth: element.querySelector('.modal-card').scrollWidth
  }));
  expect(mobile.width).toBeLessThanOrEqual(mobile.viewportWidth - 18);
  expect(mobile.formScrollWidth).toBeLessThanOrEqual(mobile.formClientWidth + 1);
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
  await expect(dialog.getByRole('button', { name: 'Importar 2 productos' })).toBeEnabled();
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
  await dialog.getByRole('button', { name: 'Importar 1 productos' }).click();
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
  await expect(form.locator('#save-product')).toHaveText('Guardar');
  await expect(dialog).not.toContainText(/Neon|Cloudflare|R2/i);
  await form.locator('[name="name"]').fill('QA Inventory Created Perfume');
  await form.locator('[name="sku"]').fill('QA-NEW-201');
  await form.locator('[name="brand"]').fill('QA Atelier');
  await form.locator('[name="authenticityType"]').selectOption('inspired');
  await expect(form.locator('#product-inspired-by-field')).toBeVisible();
  await form.locator('[name="inspiredBy"]').fill('Creed Aventus');
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
  expect(payload.authenticity_type).toBe('inspired');
  expect(payload.inspired_by).toBe('Creed Aventus');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#product-table-body')).toContainText('QA Inventory Created Perfume');
  await expect(page.locator('#product-table-body')).toContainText('Inspirado en Creed Aventus');

  await navigateToView(page, 'inventory');
  await expect(page.locator('#inventory-product-body')).toContainText('QA Inventory Created Perfume');
  await expect(page.locator('#inventory-product-body')).toContainText('4 unidades');
  await expect(page.locator('#inventory-movement-body')).toContainText('Existencias iniciales');
  expect(api.data.inventory_movements.some(movement =>
    movement.product_id.endsWith('000000000201') && movement.quantity_delta === 4
  )).toBe(true);
});

test('purchase order form omits the generated code field and keeps payment terms aligned', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'purchaseOrders');
  await expect(page.locator('[data-action="purchase-section-tab"][data-tab="orders"]')).toBeVisible();
  await page.locator('[data-action="purchase-section-tab"][data-tab="new"]').click();

  const form = page.locator('#purchase-order-form');
  await expect(form).toBeVisible();
  await expect(form.getByText('Código de orden')).toHaveCount(0);
  await expect(form.locator('input[value="Se asigna al generar"]')).toHaveCount(0);
  await expect(form.locator('[name="supplier_id"]')).toBeVisible();
  await expect(form.locator('[name="payment_terms"]').locator('..')).toHaveClass(/purchase-order-full-field/);

  const paymentTermsField = form.locator('[name="payment_terms"]').locator('..');
  const gridColumn = await paymentTermsField.evaluate(node => getComputedStyle(node).gridColumn);
  expect(gridColumn).toContain('1 / -1');
});



test('purchase workspace tabs separate orders, receipts and the staged creation form', async ({ page }) => {
  await page.goto('/');
  await navigateToView(page, 'purchaseOrders');

  await expect(page.locator('[data-action="purchase-section-tab"][data-tab="orders"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#purchase-history-search')).toBeVisible();
  await expect(page.locator('#purchase-order-form')).toHaveCount(0);

  await page.locator('[data-action="purchase-section-tab"][data-tab="receipts"]').click();
  await expect(page.locator('.purchase-receipts-panel')).toBeVisible();
  await expect(page.locator('#purchase-history-search')).toHaveCount(0);

  await page.locator('[data-action="purchase-section-tab"][data-tab="new"]').click();
  await expect(page.locator('#purchase-order-form')).toBeVisible();
  await expect(page.locator('#po-tab-general')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#po-panel-products')).toBeHidden();

  await page.locator('#po-tab-products').click();
  await expect(page.locator('#po-panel-products')).toBeVisible();
  await expect(page.locator('#po-panel-general')).toBeHidden();

  await page.locator('#po-tab-adjustments').click();
  await expect(page.locator('#po-panel-adjustments')).toBeVisible();
  await expect(page.locator('#po-panel-adjustments [name="notes"]')).toBeVisible();
  await expect(page.locator('#purchase-order-form [type="submit"]')).toBeVisible();
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
    expect(actionLayout.summaryColumns).toBe(viewport.width > 1180 ? 4 : 2);
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




test('owner resource monitor populates the sidebar after initial ERP load', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#resource-sidebar-db')).toHaveText('128 MB');
  await expect(page.locator('#resource-sidebar-r2')).toHaveText('256 MB');
  const bars = await page.evaluate(() => ({
    database: document.querySelector('#resource-sidebar-db-bar').style.width,
    storage: document.querySelector('#resource-sidebar-r2-bar').style.width
  }));
  expect(bars.database).toBe('25%');
  expect(bars.storage).toBe('13%');
  await navigateToView(page, 'resources');
  await expect(page.getByRole('heading', { name: 'Consumo y servicios' })).toBeVisible();
  await expect(page.locator('.resource-metric-grid')).toContainText('Base de datos');
  await expect(page.locator('.resource-secondary-grid')).toContainText('Automatización');
});

test('product action buttons keep New product above Import on mobile and ordered on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateToView(page, 'products');
  const newProduct = page.locator('.heading-actions-inline [data-action="new-product"]');
  const importProducts = page.locator('.heading-actions-inline [data-action="import-products"]');
  await expect(newProduct).toBeVisible();
  await expect(importProducts).toBeVisible();
  const mobileOrder = await page.evaluate(() => {
    const a = document.querySelector('.heading-actions-inline [data-action="new-product"]').getBoundingClientRect();
    const b = document.querySelector('.heading-actions-inline [data-action="import-products"]').getBoundingClientRect();
    return { newTop:a.top, importTop:b.top, width:document.documentElement.scrollWidth, viewport:window.innerWidth };
  });
  expect(mobileOrder.newTop).toBeLessThan(mobileOrder.importTop);
  expect(mobileOrder.width).toBeLessThanOrEqual(mobileOrder.viewport + 1);

  await page.setViewportSize({ width: 1280, height: 900 });
  const desktopOrder = await page.evaluate(() => {
    const a = document.querySelector('.heading-actions-inline [data-action="new-product"]').getBoundingClientRect();
    const b = document.querySelector('.heading-actions-inline [data-action="import-products"]').getBoundingClientRect();
    return { newLeft:a.left, importLeft:b.left };
  });
  expect(desktopOrder.newLeft).toBeLessThan(desktopOrder.importLeft);
});

test('notification center displays unread alerts and marks them as read', async ({ page }) => {
  let notifications = [{
    id: 'qa-notification-1',
    category: 'approval',
    severity: 'warning',
    title: 'Orden de compra por aprobar',
    message: 'OC JB-OC-2026-000001 · Proveedor QA',
    entity_type: 'purchase_order',
    entity_id: 'qa-purchase-order-1',
    target_view: 'purchaseOrders',
    created_at: '2026-11-06T20:00:00.000Z',
    read_at: null
  }];
  let unreadCount = 1;

  await page.route('**/api/erp/notifications**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/read-all') && request.method() === 'PATCH') {
      notifications = notifications.map(item => ({ ...item, read_at: '2026-11-06T20:05:00.000Z' }));
      unreadCount = 0;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ updated: true })
      });
    }
    if (pathname.endsWith('/notifications') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notifications, unread_count: unreadCount })
      });
    }
    return route.fallback();
  });

  await page.goto('/');
  const trigger = page.locator('.notification-button');
  const panel = page.locator('#notification-panel');
  const badge = page.locator('#notification-count');

  await expect(trigger).toHaveAttribute('aria-label', 'Notificaciones: 1 sin leer');
  await expect(badge).toHaveText('1');
  const toastCountBeforeBellClick = await page.locator('#toast-region .toast').count();
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(page.locator('#toast-region .toast')).toHaveCount(toastCountBeforeBellClick);
  await expect(panel).toContainText('Orden de compra por aprobar');
  await expect(panel).toContainText('OC JB-OC-2026-000001');

  await page.locator('#notification-mark-all').click();
  await expect(badge).toBeHidden();
  await expect(panel).toContainText('Leída');

  await trigger.click();
  await expect(panel).toBeHidden();
});

test('all six font scale levels apply and enforce their boundaries', async ({ page }) => {
  // Start from 120% regardless of any browser preference left by another test.
  await page.addInitScript(() => window.localStorage.setItem('jbparfums-font-level', '2'));
  await page.goto('/');
  const levels = [
    ['normal', '100%'],
    ['large', '110%'],
    ['larger', '120%'],
    ['largest', '130%'],
    ['huge', '140%'],
    ['extra', '150%']
  ];
  const decrease = page.locator('#font-decrease');
  const increase = page.locator('#font-increase');
  const navigationText = page.locator('.nav-item').first();

  await decrease.click();
  await decrease.click();
  let fontAt100 = 0;
  let fontAt150 = 0;

  for (let index = 0; index < levels.length; index++) {
    const [value, label] = levels[index];
    await expect(page.locator('#font-scale-label')).toHaveText(label);
    await expect(page.locator('body')).toHaveAttribute('data-font-scale', value);
    const computedFont = await navigationText.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    if (value === 'normal') fontAt100 = computedFont;
    if (value === 'extra') fontAt150 = computedFont;
    if (index < levels.length - 1) await increase.click();
  }

  expect(fontAt100).toBeGreaterThan(0);
  expect(fontAt150).toBeGreaterThan(fontAt100 * 1.4);

  await expect(increase).toBeDisabled();
  for (let index = levels.length - 1; index > 0; index--) await decrease.click();
  await expect(decrease).toBeDisabled();
  await expect(page.locator('#font-scale-label')).toHaveText('100%');
});




test('inventory summary cards stay symmetrical at desktop, tablet and mobile widths', async ({ page }) => {
  await installStatefulInventoryApi(page);
  const viewports = [
    { width: 1440, height: 900, columns: 4 },
    { width: 1024, height: 900, columns: 2 },
    { width: 390, height: 844, columns: 2 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await navigateToView(page, 'inventory');
    const summary = page.locator('.inventory-summary-strip');
    await expect(summary.locator('.summary-mini')).toHaveCount(4);
    const layout = await summary.evaluate(element => {
      const cards = [...element.querySelectorAll('.summary-mini')];
      const widths = cards.map(card => card.getBoundingClientRect().width);
      return {
        columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
        widths,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      };
    });
    expect(layout.columns).toBe(viewport.columns);
    expect(Math.max(...layout.widths) - Math.min(...layout.widths)).toBeLessThan(2);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  }
});

test('interface action labels do not expose infrastructure provider names', async ({ page }) => {
  await page.goto('/');
  const views = ['products', 'inventory', 'purchaseOrders', 'dgi', 'settings', 'hr'];
  for (const view of views) {
    await navigateToView(page, view);
    const labels = await page.locator('button:visible').allTextContents();
    const exposedNames = labels.filter(label => /Neon|Cloudflare|R2/i.test(label));
    expect(exposedNames, 'provider names found in button labels on ' + view).toEqual([]);
  }
});

test('mobile sidebar visual coverage checks drawer, scrim, viewport bounds and dismissal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#db-connection-status')).toHaveText('Conectado');

  const sidebar = page.locator('#sidebar');
  const scrim = page.locator('#mobile-scrim');
  const menuToggle = page.locator('#menu-toggle');

  await menuToggle.click();
  await expect(sidebar).toHaveClass(/open/);
  await expect(scrim).toHaveClass(/visible/);
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(260);

  const visualState = await page.evaluate(() => {
    const sidebarElement = document.getElementById('sidebar');
    const scrimElement = document.getElementById('mobile-scrim');
    const topbarElement = document.querySelector('.topbar');
    const sidebarRect = sidebarElement.getBoundingClientRect();
    const scrimRect = scrimElement.getBoundingClientRect();
    const topbarRect = topbarElement.getBoundingClientRect();
    const hitTopbar = document.elementFromPoint(window.innerWidth - 8, Math.max(2, topbarRect.top + 8));
    const hitContent = document.elementFromPoint(window.innerWidth - 8, Math.min(window.innerHeight - 8, topbarRect.bottom + 32));
    const describe = (element) => element ? {
      tag: element.tagName,
      id: element.id || null,
      className: typeof element.className === 'string' ? element.className : '',
      insideScrim: element === scrimElement || scrimElement.contains(element),
      insideTopbar: topbarElement.contains(element)
    } : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      sidebar: {
        left: sidebarRect.left, top: sidebarRect.top, right: sidebarRect.right,
        bottom: sidebarRect.bottom, width: sidebarRect.width, height: sidebarRect.height,
        zIndex: getComputedStyle(sidebarElement).zIndex,
        transform: getComputedStyle(sidebarElement).transform,
        overflowY: getComputedStyle(sidebarElement).overflowY
      },
      scrim: {
        left: scrimRect.left, top: scrimRect.top, right: scrimRect.right,
        bottom: scrimRect.bottom, width: scrimRect.width, height: scrimRect.height,
        display: getComputedStyle(scrimElement).display,
        position: getComputedStyle(scrimElement).position,
        zIndex: getComputedStyle(scrimElement).zIndex
      },
      topbar: {
        top: topbarRect.top, bottom: topbarRect.bottom,
        zIndex: getComputedStyle(topbarElement).zIndex
      },
      hitTopbar: describe(hitTopbar),
      hitContent: describe(hitContent)
    };
  });

  console.log('MOBILE SIDEBAR VISUAL STATE:', JSON.stringify(visualState));
  const evidenceDir = path.join(process.cwd(), 'visual-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const screenshotPath = path.join(evidenceDir, 'mobile-sidebar-open.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('mobile-sidebar-open', { path: screenshotPath, contentType: 'image/png' });

  expect(visualState.documentWidth, 'mobile drawer must not create horizontal page overflow')
    .toBeLessThanOrEqual(visualState.viewport.width + 1);
  expect(visualState.sidebar.left, 'drawer must be flush with the left viewport edge').toBeCloseTo(0, 0);
  expect(visualState.sidebar.top, 'drawer must start at the top of the visual viewport').toBeCloseTo(0, 0);
  expect(visualState.sidebar.height, 'drawer must cover the viewport height')
    .toBeGreaterThanOrEqual(visualState.viewport.height - 1);
  expect(visualState.scrim.position).toBe('fixed');
  expect(visualState.scrim.left).toBeCloseTo(0, 0);
  expect(visualState.scrim.top).toBeCloseTo(0, 0);
  expect(visualState.scrim.width).toBeGreaterThanOrEqual(visualState.viewport.width - 1);
  expect(visualState.scrim.height).toBeGreaterThanOrEqual(visualState.viewport.height - 1);
  expect(
    visualState.hitTopbar.insideScrim,
    'the scrim must cover the sticky topbar while the drawer is open'
  ).toBe(true);
  expect(Number(visualState.topbar.zIndex)).toBeLessThan(Number(visualState.scrim.zIndex));
  expect(Number(visualState.scrim.zIndex)).toBeLessThan(Number(visualState.sidebar.zIndex));

  await page.locator('#mobile-scrim').click({ position: { x: 370, y: 400 } });
  await expect(sidebar).not.toHaveClass(/open/);
  await expect(scrim).not.toHaveClass(/visible/);
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
});
