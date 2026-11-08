import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { inventoryApiFixtureResponse } from './inventory-api-fixtures.mjs';

const workerPattern = /\/api\/erp\/[^?]+/;
const apiBase = 'https://jb-parfums-erp-api.jaredblancoh19.workers.dev';
const ids = {
  supplier: '00000000-0000-0000-0000-000000000201',
  productA: '00000000-0000-0000-0000-000000000301',
  productB: '00000000-0000-0000-0000-000000000302',
  accountNio: '00000000-0000-0000-0000-000000000601',
  accountUsd: '00000000-0000-0000-0000-000000000602',
  order: '00000000-0000-0000-0000-000000000701',
  lineA: '00000000-0000-0000-0000-000000000711',
  lineB: '00000000-0000-0000-0000-000000000712',
  receipt: '00000000-0000-0000-0000-000000000721',
  invoice: '00000000-0000-0000-0000-000000000731',
  payment: '00000000-0000-0000-0000-000000000741'
};

function createProcurementFixture() {
  return {
    products: [
      {
        id: ids.productA, sku: 'QA-PO-001', name: 'QA Purchase Perfume A', brand: 'QA Maison',
        category: 'Diseñador', purchase_cost_usd: 20, additional_cost_usd: 5,
        unit_cost_usd: 25, price_usd: 50, stock: 5, min_stock: 1, active: true, images: []
      },
      {
        id: ids.productB, sku: 'QA-PO-002', name: 'QA Purchase Perfume B', brand: 'QA Maison',
        category: 'Árabes', purchase_cost_usd: 12, additional_cost_usd: 2,
        unit_cost_usd: 14, price_usd: 30, stock: 1, min_stock: 1, active: true, images: []
      }
    ],
    suppliers: [{
      id: ids.supplier, name: 'Proveedor QA', contact: 'QA Contact', phone: '0000',
      email: 'qa-supplier@example.test', currency: 'NIO', active: true
    }],
    purchase_orders: [],
    purchase_order_items: [],
    purchase_receipts: [],
    purchase_receipt_items: [],
    supplier_invoices: [],
    supplier_invoice_payments: [],
    purchases: [],
    purchase_items: [],
    inventory_movements: [],
    cash_accounts: [
      { id: ids.accountNio, name: 'Caja NIO', currency: 'NIO', account_type: 'Caja', active: true },
      { id: ids.accountUsd, name: 'Caja USD', currency: 'USD', account_type: 'Caja', active: true }
    ],
    cash_entries: [],
    customers: [],
    orders: [],
    order_items: [],
    invoices: [],
    invoice_items: [],
    invoice_payments: [],
    expenses: [],
    employees: [],
    hr_attendance: [],
    hr_leave_requests: [],
    hr_payroll_periods: [],
    hr_payroll_items: [],
    settings: [{ setting_key: 'default_exchange_rate', setting_value: { value: 36.6 } }]
  };
}

async function installProcurementApi(page) {
  const data = createProcurementFixture();
  const requests = [];
  const fulfill = (route, payload, status = 200) => route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload)
  });

  await page.route('**/assets/js/bootstrap.mjs', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: "document.body.classList.remove('auth-pending','auth-locked');" +
      "document.body.classList.add('erp-authorized');" +
      "window.JBAuth = {" +
      "mode:'authenticated', user:{id:'qa-owner',email:'qa-owner@example.test'}," +
      "profile:{id:'qa-owner',name:'QA Owner',role:'owner',permissions:['*']}," +
      "apiUrl:path=>new URL(path,'" + apiBase + "').toString()," +
      "getToken:async()=> 'qa-only-token' }; import('./app.js');"
  }));

  await page.route(workerPattern, async route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const pathname = requestUrl.pathname;
    const method = request.method();
    const body = method === 'GET' ? null : (request.postDataJSON?.() || null);
    requests.push({ method, pathname, body });

    if (method === 'GET') {
      const inventoryPayload = inventoryApiFixtureResponse(pathname, requestUrl.searchParams, data);
      if (inventoryPayload) return fulfill(route, inventoryPayload);
    }

    if (pathname.endsWith('/bootstrap') && method === 'GET') {
      return fulfill(route, { data });
    }

    if (pathname === '/api/erp/purchase-orders' && method === 'POST') {
      const supplier = data.suppliers.find(item => item.id === body.supplier_id);
      if (!supplier) return fulfill(route, { error: { message: 'Proveedor no encontrado.' } }, 404);
      const orderRate = Number(body.exchange_rate || 1);
      const subtotal = body.items.reduce((sum, item) => {
        const unitUsd = body.currency === 'NIO' ? Number(item.unit_cost_input) / orderRate : Number(item.unit_cost_input);
        return sum + unitUsd * Number(item.ordered_quantity);
      }, 0);
      const order = {
        id: ids.order,
        order_number: '1',
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        currency: body.currency,
        exchange_rate: orderRate,
        subtotal_usd: Number(subtotal.toFixed(2)),
        discount_usd: Number(body.discount_usd || 0),
        estimated_freight_usd: Number(body.estimated_freight_usd || 0),
        estimated_taxes_usd: Number(body.estimated_taxes_usd || 0),
        total_usd: Number((subtotal - Number(body.discount_usd || 0) +
          Number(body.estimated_freight_usd || 0) + Number(body.estimated_taxes_usd || 0)).toFixed(2)),
        status: 'Borrador',
        expected_delivery_date: body.expected_delivery_date,
        payment_terms: body.payment_terms,
        notes: body.notes,
        created_at: '2026-11-05T10:00:00.000Z'
      };
      data.purchase_orders.push(order);
      body.items.forEach((item, index) => {
        const product = data.products.find(p => p.id === item.product_id);
        const unitUsd = body.currency === 'NIO' ? Number(item.unit_cost_input) / orderRate : Number(item.unit_cost_input);
        data.purchase_order_items.push({
          id: index === 0 ? ids.lineA : ids.lineB,
          purchase_order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          sku_snapshot: product.sku,
          ordered_quantity: Number(item.ordered_quantity),
          received_quantity: 0,
          unit_cost_input: Number(item.unit_cost_input),
          unit_cost_usd: Number(unitUsd.toFixed(4)),
          line_total_usd: Number((unitUsd * Number(item.ordered_quantity)).toFixed(2))
        });
      });
      return fulfill(route, { record: order }, 201);
    }

    const orderStatusMatch = pathname.match(/^\/api\/erp\/purchase-orders\/([^/]+)$/);
    if (orderStatusMatch && method === 'PATCH') {
      const order = data.purchase_orders.find(item => item.id === orderStatusMatch[1]);
      if (!order) return fulfill(route, { error: { message: 'Orden no encontrada.' } }, 404);
      order.status = body.status;
      return fulfill(route, { record: order });
    }

    const receiptMatch = pathname.match(/^\/api\/erp\/purchase-orders\/([^/]+)\/receipts$/);
    if (receiptMatch && method === 'POST') {
      const order = data.purchase_orders.find(item => item.id === receiptMatch[1]);
      if (!order) return fulfill(route, { error: { message: 'Orden no encontrada.' } }, 404);
      const receipt = {
        id: ids.receipt, receipt_number: '1', purchase_order_id: order.id,
        supplier_invoice_number: body.supplier_invoice_number,
        supplier_invoice_date: body.supplier_invoice_date,
        invoice_currency: body.invoice_currency,
        invoice_exchange_rate: Number(body.invoice_exchange_rate),
        invoice_original_total: Number(body.invoice_original_total),
        invoice_total_usd: Number((body.invoice_currency === 'NIO'
          ? Number(body.invoice_original_total) / Number(body.invoice_exchange_rate)
          : Number(body.invoice_original_total)).toFixed(2)),
        actual_freight_usd: Number(body.actual_freight_usd || 0),
        actual_taxes_usd: Number(body.actual_taxes_usd || 0),
        payment_terms_snapshot: body.payment_terms,
        notes: body.notes || null, document_status: 'Emitida',
        emitted_by_name: 'QA Owner', emitted_at: '2026-11-05T10:15:00.000Z',
        purchase_code: null
      };
      data.purchase_receipts.push(receipt);
      for (const item of body.items) {
        const line = data.purchase_order_items.find(x => x.id === item.purchase_order_item_id);
        data.purchase_receipt_items.push({
          id: 'qa-receipt-item-' + item.purchase_order_item_id,
          receipt_id: receipt.id, purchase_order_item_id: line.id,
          product_id: line.product_id, product_name: line.product_name,
          quantity_received: Number(item.quantity_received),
          invoice_unit_cost_input: Number(item.invoice_unit_cost_input),
          landed_unit_cost_usd: Number(line.unit_cost_usd)
        });
      }
      return fulfill(route, { record: receipt }, 201);
    }

    const postReceiptMatch = pathname.match(/^\/api\/erp\/purchase-receipts\/([^/]+)\/post$/);
    if (postReceiptMatch && method === 'POST') {
      const receipt = data.purchase_receipts.find(item => item.id === postReceiptMatch[1]);
      if (!receipt || receipt.document_status !== 'Emitida') {
        return fulfill(route, { error: { message: 'Recepción no pendiente.' } }, 409);
      }
      const order = data.purchase_orders.find(item => item.id === receipt.purchase_order_id);
      const receiptItems = data.purchase_receipt_items.filter(item => item.receipt_id === receipt.id);
      const totalValue = receiptItems.reduce((sum,item) => sum +
        Number(data.purchase_order_items.find(line => line.id === item.purchase_order_item_id).unit_cost_usd) *
        Number(item.quantity_received), 0);
      for (const item of receiptItems) {
        const line = data.purchase_order_items.find(x => x.id === item.purchase_order_item_id);
        const product = data.products.find(x => x.id === line.product_id);
        const quantity = Number(item.quantity_received);
        const oldStock = Number(product.stock || 0);
        const oldCost = Number(product.purchase_cost_usd || 0);
        const lineValue = Number(line.unit_cost_usd) * quantity;
        const freight = totalValue > 0 ? Number(receipt.actual_freight_usd || 0) * lineValue / totalValue : 0;
        const landedUnit = Number(line.unit_cost_usd) + freight / quantity;
        const nextStock = oldStock + quantity;
        product.stock = nextStock;
        product.purchase_cost_usd = Number(((oldStock * oldCost + quantity * landedUnit) / nextStock).toFixed(2));
        product.unit_cost_usd = Number((product.purchase_cost_usd + Number(product.additional_cost_usd || 0)).toFixed(2));
        line.received_quantity += quantity;
        item.landed_unit_cost_usd = Number(landedUnit.toFixed(4));
        data.inventory_movements.unshift({
          id: 'qa-po-movement-' + item.purchase_order_item_id,
          product_id: product.id, movement_type: 'Entrada', quantity,
          quantity_delta: quantity, previous_stock: oldStock, new_stock: nextStock,
          note: 'Recepción ' + receipt.receipt_number, reference_type: 'purchase_receipt',
          reference_id: receipt.id, actor_name: 'QA Owner', supplier_name: order.supplier_name,
          purchase_order_number: order.order_number, created_at: '2026-11-05T10:20:00.000Z'
        });
      }
      const allReceived = data.purchase_order_items.filter(x => x.purchase_order_id === order.id)
        .every(x => x.received_quantity >= x.ordered_quantity);
      order.status = allReceived ? 'Recibida' : 'Recepción parcial';
      receipt.document_status = 'Contabilizada';
      receipt.purchase_code = 1;
      receipt.posted_by_name = 'QA Owner';
      receipt.journal_number = 1;
      const invoice = {
        id: ids.invoice, supplier_id: order.supplier_id, supplier_name: order.supplier_name,
        purchase_order_id: order.id, invoice_number: receipt.supplier_invoice_number,
        invoice_date: receipt.supplier_invoice_date, due_date: receipt.supplier_invoice_date,
        currency: receipt.invoice_currency, exchange_rate: receipt.invoice_exchange_rate,
        original_amount: receipt.invoice_original_total, amount_usd: receipt.invoice_total_usd,
        paid_amount_usd: 0, status: 'Pendiente', notes: 'Factura registrada al contabilizar recepción'
      };
      data.supplier_invoices.push(invoice);
      receipt.supplier_invoice_id = invoice.id;
      data.purchase_journal_entries = [{
        id: 'qa-journal-entry', journal_number: 1, purchase_receipt_id: receipt.id,
        purchase_code: 1, entry_date: receipt.supplier_invoice_date,
        description: 'Compra 1 · Factura ' + receipt.supplier_invoice_number,
        currency: receipt.invoice_currency, exchange_rate: receipt.invoice_exchange_rate,
        total_debit_usd: receipt.invoice_total_usd, total_credit_usd: receipt.invoice_total_usd,
        status: 'Contabilizado', lines: [
          { line_number: 1, account_name: 'Inventario', debit_usd: receipt.invoice_total_usd, credit_usd: 0 },
          { line_number: 2, account_name: 'Cuentas por pagar a proveedores', debit_usd: 0, credit_usd: receipt.invoice_total_usd }
        ]
      }];
      return fulfill(route, { record: { ...receipt, journal_number: 1, purchase_order_status: order.status } });
    }

    const journalMatch = pathname.match(/^\/api\/erp\/purchase-receipts\/([^/]+)\/journal$/);
    if (journalMatch && method === 'GET') {
      const receipt = data.purchase_receipts.find(item => item.id === journalMatch[1]);
      const journal = data.purchase_journal_entries?.find(item => item.purchase_receipt_id === receipt?.id);
      if (!journal) return fulfill(route, { error: { message: 'Comprobante no encontrado.' } }, 404);
      return fulfill(route, { record: { ...journal, receipt_number: receipt.receipt_number } });
    }

    if (pathname === '/api/erp/supplier-invoices' && method === 'POST') {
      const supplier = data.suppliers.find(item => item.id === body.supplier_id);
      if (!supplier) return fulfill(route, { error: { message: 'Proveedor no encontrado.' } }, 404);
      const amountUsd = body.currency === 'NIO'
        ? Number(body.original_amount) / Number(body.exchange_rate)
        : Number(body.original_amount);
      const invoice = {
        id: ids.invoice,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        purchase_order_id: body.purchase_order_id || null,
        invoice_number: body.invoice_number,
        invoice_date: body.invoice_date,
        due_date: body.due_date || null,
        currency: body.currency,
        exchange_rate: Number(body.exchange_rate),
        original_amount: Number(body.original_amount),
        amount_usd: Number(amountUsd.toFixed(2)),
        paid_amount_usd: 0,
        status: 'Pendiente',
        notes: body.notes || null,
        created_at: '2026-11-05T10:30:00.000Z'
      };
      data.supplier_invoices.push(invoice);
      return fulfill(route, { record: invoice }, 201);
    }

    if (pathname === '/api/erp/supplier-invoice-payments' && method === 'POST') {
      const invoice = data.supplier_invoices.find(item => item.id === body.supplier_invoice_id);
      if (!invoice) return fulfill(route, { error: { message: 'Factura no encontrada.' } }, 404);
      const balance = Number(invoice.amount_usd) - Number(invoice.paid_amount_usd);
      if (Number(body.amount_usd) > balance + 0.001) {
        return fulfill(route, { error: { message: 'El pago supera el saldo.' } }, 409);
      }
      const payment = {
        id: ids.payment,
        supplier_invoice_id: invoice.id,
        account_id: body.account_id,
        currency: body.currency,
        original_amount: Number(body.original_amount),
        exchange_rate: Number(body.exchange_rate),
        amount_usd: Number(body.amount_usd),
        payment_reference: body.payment_reference || null,
        paid_at: '2026-11-05T10:45:00.000Z'
      };
      invoice.paid_amount_usd = Number((Number(invoice.paid_amount_usd) + Number(body.amount_usd)).toFixed(2));
      invoice.status = invoice.paid_amount_usd >= Number(invoice.amount_usd) - 0.001 ? 'Pagada' : 'Abono parcial';
      data.supplier_invoice_payments.push(payment);
      data.cash_entries.push({
        id: 'qa-cash-entry-' + payment.id,
        direction: 'expense',
        concept: 'Pago factura proveedor ' + invoice.invoice_number,
        account_id: body.account_id,
        currency: body.currency,
        original_amount: Number(body.original_amount),
        exchange_rate: Number(body.exchange_rate),
        amount_usd: Number(body.amount_usd),
        source_type: 'supplier_invoice_payment',
        source_id: payment.id,
        created_at: payment.paid_at
      });
      return fulfill(route, { record: { ...payment, paid_amount_usd: invoice.paid_amount_usd, status: invoice.status } }, 201);
    }

    return fulfill(route, { records: [], data });
  });

  return { data, requests };
}

async function navigateToView(page, view) {
  const sidebar = page.locator('#sidebar');
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 720px)').matches);
  if (isMobile && !(await sidebar.evaluate(node => node.classList.contains('open')))) {
    await page.locator('#menu-toggle').click();
  }
  await sidebar.locator('button[data-view="' + view + '"]').click();
}

test('procurement UI creates a mult-line order, receives partially, records supplier invoice and applies payment', async ({ page }) => {
  const api = await installProcurementApi(page);
  await page.goto('/');

  await navigateToView(page, 'purchaseOrders');
  const orderForm = page.locator('#purchase-order-form');
  await expect(orderForm).toBeVisible();
  await expect(orderForm.getByText('Código de orden')).toHaveCount(0);
  await expect(orderForm.locator('input[value="Se asigna al generar"]')).toHaveCount(0);
  await orderForm.locator('[name="supplier_id"]').selectOption(ids.supplier);
  await orderForm.locator('[name="currency"]').selectOption('NIO');
  await orderForm.locator('[name="exchange_rate"]').fill('36.6');

  const firstLine = orderForm.locator('.purchase-order-line').nth(0);
  await firstLine.locator('[name="product_id"]').selectOption(ids.productA);
  await firstLine.locator('[name="ordered_quantity"]').fill('2');
  await firstLine.locator('[name="unit_cost_input"]').fill('366');

  await page.locator('[data-action="add-purchase-order-line"]').click();
  const secondLine = orderForm.locator('.purchase-order-line').nth(1);
  await secondLine.locator('[name="product_id"]').selectOption(ids.productB);
  await secondLine.locator('[name="ordered_quantity"]').fill('3');
  await secondLine.locator('[name="unit_cost_input"]').fill('183');

  await orderForm.locator('[name="discount_usd"]').fill('1');
  await orderForm.locator('[name="estimated_freight_usd"]').fill('2');
  await orderForm.locator('[name="estimated_taxes_usd"]').fill('0.5');

  const createRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/purchase-orders') && request.method() === 'POST'
  );
  await orderForm.locator('[type="submit"]').click();
  const createPayload = (await createRequest).postDataJSON();
  expect(createPayload.items).toHaveLength(2);
  expect(createPayload).not.toHaveProperty('order_number');
  expect(createPayload.currency).toBe('NIO');
  expect(api.data.purchase_orders[0].total_usd).toBe(36.5);

  const orderRow = page.locator('tr').filter({ hasText: 'Proveedor QA' });
  await expect(orderRow).toContainText('Borrador');
  const submitRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/purchase-orders/' + ids.order) &&
    request.method() === 'PATCH'
  );
  await orderRow.locator('[data-action="submit-purchase-order"]').click();
  expect((await submitRequest).postDataJSON().status).toBe('Enviada');
  await expect(page.locator('tr').filter({ hasText: 'Proveedor QA' })).toContainText('Enviada');

  const approveRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/purchase-orders/' + ids.order) &&
    request.method() === 'PATCH'
  );
  await page.locator('tr').filter({ hasText: 'Proveedor QA' }).locator('[data-action="approve-purchase-order"]').click();
  expect((await approveRequest).postDataJSON().status).toBe('Confirmada');
  await expect(page.locator('tr').filter({ hasText: 'Proveedor QA' })).toContainText('Confirmada');

  await page.locator('tr').filter({ hasText: 'Proveedor QA' }).locator('[data-action="receive-purchase-order"]').click();
  const receiptDialog = page.locator('#purchase-receipt-dialog');
  await expect(receiptDialog).toBeVisible();
  const receiptLines = receiptDialog.locator('[data-receipt-line]');
  await expect(receiptLines).toHaveCount(2);
  await receiptLines.nth(0).locator('[data-receipt-quantity]').fill('1');
  await receiptLines.nth(1).locator('[data-receipt-quantity]').fill('2');
  await receiptDialog.locator('[name="actual_freight_usd"]').fill('1.5');
  await receiptDialog.locator('[name="supplier_invoice_number"]').fill('FAC-PROV-QA-001');
  await expect(receiptDialog.locator('[name="invoice_original_total"]')).toHaveValue('765.99');

  const receiptRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/purchase-orders/' + ids.order + '/receipts') &&
    request.method() === 'POST'
  );
  await receiptDialog.locator('[type="submit"]').click();
  const receiptPayload = (await receiptRequest).postDataJSON();
  expect(receiptPayload.items).toHaveLength(2);
  // Emitting a receipt is staged: quantities and order status change only on posting.
  await expect(page.locator('tr').filter({ hasText: 'Proveedor QA' })).toContainText('Confirmada');

  expect(api.data.purchase_receipts).toHaveLength(1);
  expect(api.data.purchase_receipts[0].document_status).toBe('Emitida');
  expect(api.data.purchase_order_items.map(item => item.received_quantity)).toEqual([0, 0]);
  expect(api.data.products.find(item => item.id === ids.productA).stock).toBe(5);
  expect(api.data.products.find(item => item.id === ids.productB).stock).toBe(1);
  expect(api.data.inventory_movements).toHaveLength(0);
  expect(api.data.supplier_invoices).toHaveLength(0);

  const receiptRow = page.locator('tr').filter({ hasText: 'FAC-PROV-QA-001' });
  await expect(receiptRow).toContainText('Emitida');
  const postRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/purchase-receipts/' + ids.receipt + '/post') &&
    request.method() === 'POST'
  );
  page.once('dialog', dialog => dialog.accept());
  await receiptRow.locator('[data-action="post-purchase-receipt"]').click();
  const postedRequest = await postRequest;
  expect(postedRequest.method()).toBe('POST');
  expect(api.data.purchase_receipts[0].document_status).toBe('Contabilizada');
  expect(api.data.purchase_receipts[0].purchase_code).toBe(1);
  expect(api.data.purchase_order_items.map(item => item.received_quantity)).toEqual([1, 2]);
  expect(api.data.products.find(item => item.id === ids.productA).stock).toBe(6);
  expect(api.data.products.find(item => item.id === ids.productB).stock).toBe(3);
  expect(api.data.inventory_movements).toHaveLength(2);
  expect(api.data.supplier_invoices).toHaveLength(1);
  expect(api.data.purchase_journal_entries[0].total_debit_usd).toBe(api.data.purchase_journal_entries[0].total_credit_usd);
  await expect(page.locator('tr').filter({ hasText: 'Proveedor QA' })).toContainText('Recepción parcial');

  await navigateToView(page, 'inventory');
  await expect(page.locator('#inventory-product-body')).toContainText('QA Purchase Perfume A');
  await expect(page.locator('#inventory-product-body')).toContainText('6');

  await navigateToView(page, 'payables');
  const businessDialog = page.locator('#business-dialog');
  const businessForm = page.locator('#business-form');
  expect(api.data.supplier_invoices).toHaveLength(1);
  expect(api.data.supplier_invoices[0].purchase_order_id).toBe(ids.order);
  expect(api.data.supplier_invoices[0].amount_usd).toBe(20.93);
  const invoiceRow = page.locator('tr').filter({ hasText: 'FAC-PROV-QA-001' });
  await expect(invoiceRow).toContainText('Pendiente');
  await invoiceRow.locator('[data-action="new-supplier-invoice-payment"]').click();
  await expect(businessDialog).toBeVisible();
  await businessForm.locator('[name="amount"]').fill('366');
  await businessForm.locator('[name="account"]').selectOption('Caja NIO');
  await businessForm.locator('[name="paymentReference"]').fill('REF-QA-2026-001');

  const paymentRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/erp/supplier-invoice-payments') && request.method() === 'POST'
  );
  await businessForm.locator('#business-save').click();
  const paymentPayload = (await paymentRequest).postDataJSON();
  expect(paymentPayload.original_amount).toBe(366);
  expect(paymentPayload.amount_usd).toBe(10);
  await expect(businessDialog).not.toBeVisible();
  await expect(page.locator('tr').filter({ hasText: 'FAC-PROV-QA-001' })).toContainText('Abono parcial');

  expect(api.data.supplier_invoice_payments).toHaveLength(1);
  expect(api.data.supplier_invoices[0].paid_amount_usd).toBe(10);
  expect(api.data.cash_entries).toHaveLength(1);
  expect(api.data.cash_entries[0].source_type).toBe('supplier_invoice_payment');
});

test('procurement history combines monthly, supplier and status filters and handles migrated receipts without journals', async ({ page }) => {
  const api = await installProcurementApi(page);
  const legacyOrderId = '00000000-0000-0000-0000-000000000801';
  const legacyLineId = '00000000-0000-0000-0000-000000000811';
  const legacyReceiptId = '00000000-0000-0000-0000-000000000821';

  api.data.purchase_orders.push({
    id: legacyOrderId, order_number: '17', supplier_id: ids.supplier, supplier_name: 'Proveedor QA',
    currency: 'USD', exchange_rate: 1, subtotal_usd: 30, discount_usd: 0,
    estimated_freight_usd: 0, estimated_taxes_usd: 0, total_usd: 30,
    status: 'Recibida', payment_terms: 'Contado', notes: 'Archivo histórico',
    created_by: 'qa-owner', created_by_name: 'QA Owner',
    approved_by: 'qa-approver', approved_by_name: 'QA Approver',
    created_at: '2026-10-12T10:00:00.000Z', approved_at: '2026-10-12T11:00:00.000Z'
  });
  api.data.purchase_order_items.push({
    id: legacyLineId, purchase_order_id: legacyOrderId, product_id: ids.productA,
    product_name: 'QA Purchase Perfume A', sku_snapshot: 'QA-PO-001',
    ordered_quantity: 1, received_quantity: 1, unit_cost_input: 30, unit_cost_usd: 30,
    line_total_usd: 30
  });
  api.data.purchase_receipts.push({
    id: legacyReceiptId, receipt_number: 'OLD-REC-17', purchase_order_id: legacyOrderId,
    document_status: 'Contabilizada', supplier_invoice_number: null, supplier_invoice_date: null,
    invoice_total_usd: null, purchase_code: null, journal_number: null,
    emitted_by_name: 'QA Owner', posted_by_name: 'QA Owner',
    emitted_at: '2026-11-05T10:00:00.000Z', received_at: '2026-11-05T10:00:00.000Z',
    posted_at: '2026-11-05T10:00:00.000Z'
  });

  await page.goto('/');
  await navigateToView(page, 'purchaseOrders');
  await expect(page.locator('#purchase-history-search')).toBeVisible();
  await expect(page.locator('#purchase-history-supplier')).toBeVisible();
  await expect(page.locator('#purchase-history-order-status')).toBeVisible();
  await expect(page.locator('#purchase-history-receipt-status')).toBeVisible();
  await expect(page.locator('.purchase-history-archive')).toBeVisible();
  const legacyReceiptRow = page.locator('tr').filter({ hasText: 'OLD-REC-17' });
  await expect(legacyReceiptRow).toContainText('Histórico · sin comprobante diario');
  await expect(legacyReceiptRow.locator('[data-action="view-purchase-journal"]')).toHaveCount(0);

  await page.locator('#purchase-history-order-status').selectOption('Borrador');
  await expect(page.locator('tr').filter({ hasText: 'OLD-REC-17' })).toHaveCount(1);
  await expect(page.locator('tr').filter({ hasText: '17' }).filter({ hasText: 'Proveedor QA' })).toHaveCount(0);
  await page.locator('#purchase-history-order-status').selectOption('all');

  await page.locator('#purchase-history-receipt-status').selectOption('Emitida');
  await expect(page.locator('tr').filter({ hasText: 'OLD-REC-17' })).toHaveCount(0);
  await page.locator('#purchase-history-receipt-status').selectOption('all');
  await expect(page.locator('tr').filter({ hasText: 'OLD-REC-17' })).toHaveCount(1);

  await page.locator('.purchase-history-archive > summary').click();
  await page.locator('.purchase-history-archive [data-action="purchase-month-filter"][data-start="2026-11-01"]').click();
  await expect(page.locator('#purchase-history-start')).toHaveValue('2026-11-01');
  await expect(page.locator('#purchase-history-end')).toHaveValue('2026-11-30');
  await expect(page.locator('tr').filter({ hasText: 'OLD-REC-17' })).toHaveCount(1);
  await expect(page.locator('tr').filter({ hasText: '17' }).filter({ hasText: 'Proveedor QA' })).toHaveCount(0);

  await page.locator('[data-action="toggle-export-menu"]').click();
  await expect(page.locator('#current-export-menu')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="export-current-view"][data-format="csv"]').click()
  ]);
  expect(download.suggestedFilename()).toContain('purchaseOrders');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('OLD-REC-17');
  expect(csv).not.toContain('"Orden de compra"');

  await page.locator('#purchase-history-search').fill('OLD-REC-17');
  await expect(page.locator('tr').filter({ hasText: 'OLD-REC-17' })).toHaveCount(1);
  await page.locator('#purchase-history-search').fill('no-coincide');
  await expect(page.locator('tr').filter({ hasText: 'OLD-REC-17' })).toHaveCount(0);

  await page.locator('[data-action="clear-purchase-filters"]').click();
  await expect(page.locator('#purchase-history-search')).toHaveValue('');
  await expect(page.locator('#purchase-history-start')).toHaveValue('');
  await expect(page.locator('#purchase-history-receipt-status')).toHaveValue('all');
});
