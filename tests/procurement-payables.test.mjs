import test from "node:test";
import assert from "node:assert/strict";
import {
  createPurchaseOrder,
  createPurchaseReceipt,
  createSupplierInvoice,
  addSupplierInvoicePayment,
  resolveRoutePermission
} from "../worker/src/erp.js";

const actor = { id: "00000000-0000-0000-0000-000000000099", role: "owner" };
const supplierId = "00000000-0000-0000-0000-000000000201";
const productA = "00000000-0000-0000-0000-000000000301";
const productB = "00000000-0000-0000-0000-000000000302";
const orderId = "00000000-0000-0000-0000-000000000401";
const orderItemId = "00000000-0000-0000-0000-000000000402";
const invoiceId = "00000000-0000-0000-0000-000000000501";
const accountId = "00000000-0000-0000-0000-000000000601";

async function responseOf(response) {
  return { status: response.status, body: await response.json() };
}

function validPurchaseOrder(overrides = {}) {
  return {
    order_number: "OC-QA-2026-001",
    supplier_id: supplierId,
    currency: "NIO",
    exchange_rate: 36.6,
    discount_usd: 1,
    estimated_freight_usd: 2,
    estimated_taxes_usd: 0.5,
    expected_delivery_date: "2026-11-15",
    payment_terms: "30 días",
    notes: "Orden controlada QA",
    items: [
      { product_id: productA, ordered_quantity: 2, unit_cost_input: 366 },
      { product_id: productB, ordered_quantity: 3, unit_cost_input: 183 }
    ],
    ...overrides
  };
}

function validSupplierInvoice(overrides = {}) {
  return {
    supplier_id: supplierId,
    purchase_order_id: orderId,
    invoice_number: "FAC-PROV-QA-001",
    invoice_date: "2026-11-05",
    due_date: "2026-12-05",
    currency: "NIO",
    exchange_rate: 36.6,
    original_amount: 366,
    notes: "Factura controlada QA",
    ...overrides
  };
}

function validSupplierPayment(overrides = {}) {
  return {
    supplier_invoice_id: invoiceId,
    account_id: accountId,
    currency: "NIO",
    original_amount: 366,
    exchange_rate: 36.6,
    amount_usd: 10,
    payment_reference: "REF-QA-001",
    ...overrides
  };
}

test("purchase order converts NIO line costs and stores order, lines and audit atomically", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{ id: orderId, order_number: "OC-QA-2026-001", item_count: 2, subtotal_usd: "35.00", total_usd: "36.50" }];
    }
  };

  const result = await responseOf(await createPurchaseOrder(sql, actor, validPurchaseOrder()));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.id, orderId);
  assert.equal(captured.values[2], "NIO");
  assert.equal(captured.values[3], 36.6);
  assert.equal(captured.values[4], 35);
  assert.equal(captured.values[5], 1);
  assert.equal(captured.values[6], 2);
  assert.equal(captured.values[7], 0.5);
  assert.equal(captured.values[8], 36.5);
  assert.equal(captured.values[13], actor.id);

  const lines = JSON.parse(captured.values[12]);
  assert.deepEqual(lines.map(line => line.unit_cost_usd), [10, 5]);
  assert.deepEqual(lines.map(line => line.ordered_quantity), [2, 3]);
  assert.match(captured.statement, /INSERT INTO purchase_orders/);
  assert.match(captured.statement, /INSERT INTO purchase_order_items/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
  assert.doesNotMatch(captured.statement, /UPDATE products/);
});

test("purchase order rejects duplicate products and discounts above subtotal before SQL", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };

  const duplicate = validPurchaseOrder({
    items: [
      { product_id: productA, ordered_quantity: 1, unit_cost_input: 100 },
      { product_id: productA, ordered_quantity: 2, unit_cost_input: 100 }
    ]
  });
  const duplicateResult = await responseOf(await createPurchaseOrder(sql, actor, duplicate));
  assert.equal(duplicateResult.status, 400);
  assert.equal(duplicateResult.body.error.code, "DUPLICATE_PURCHASE_ORDER_PRODUCT");

  const discountResult = await responseOf(await createPurchaseOrder(sql, actor, validPurchaseOrder({
    currency: "USD",
    exchange_rate: 1,
    discount_usd: 999,
    estimated_freight_usd: 0,
    estimated_taxes_usd: 0,
    items: [{ product_id: productA, ordered_quantity: 1, unit_cost_input: 10 }]
  })));
  assert.equal(discountResult.status, 400);
  assert.equal(discountResult.body.error.code, "INVALID_PURCHASE_ORDER_TOTAL");
  assert.equal(calls, 0);
});

test("purchase receipt validates duplicate and non-positive lines before SQL", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };

  const duplicate = await responseOf(await createPurchaseReceipt(sql, actor, orderId, {
    items: [
      { purchase_order_item_id: orderItemId, quantity_received: 1 },
      { purchase_order_item_id: orderItemId, quantity_received: 1 }
    ]
  }));
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.error.code, "DUPLICATE_RECEIPT_LINE");

  const zero = await responseOf(await createPurchaseReceipt(sql, actor, orderId, {
    items: [{ purchase_order_item_id: orderItemId, quantity_received: 0 }]
  }));
  assert.equal(zero.status, 400);
  assert.equal(zero.body.error.code, "INVALID_PURCHASE_RECEIPT_LINE");
  assert.equal(calls, 0);
});

test("purchase receipt writes receipt, weighted cost, inventory movement and audit in one SQL statement", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        id: "00000000-0000-0000-0000-000000000403",
        receipt_number: "REC-20261105-QA001",
        item_count: 1,
        purchase_order_status: "Recepción parcial"
      }];
    }
  };

  const result = await responseOf(await createPurchaseReceipt(sql, actor, orderId, {
    actual_freight_usd: 1.5,
    notes: "Recepción parcial controlada QA",
    receipt_number: "REC-20261105-QA001",
    items: [{ purchase_order_item_id: orderItemId, quantity_received: 2 }]
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.purchase_order_status, "Recepción parcial");
  assert.equal(captured.values[0], orderId);
  assert.equal(captured.values[1], "REC-20261105-QA001");
  assert.equal(captured.values[2], 1.5);
  assert.deepEqual(JSON.parse(captured.values[4]), [
    { purchase_order_item_id: orderItemId, quantity_received: 2 }
  ]);
  assert.equal(captured.values[5], actor.id);
  assert.match(captured.statement, /FOR UPDATE OF po/);
  assert.match(captured.statement, /FOR UPDATE OF oi,p/);
  assert.match(captured.statement, /INSERT INTO purchase_receipt_items/);
  assert.match(captured.statement, /UPDATE products/);
  assert.match(captured.statement, /INSERT INTO inventory_movements/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
});

test("supplier invoice converts NIO to USD and persists invoice plus audit atomically", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{ id: invoiceId, invoice_number: "FAC-PROV-QA-001", amount_usd: "10.00", status: "Pendiente" }];
    }
  };

  const result = await responseOf(await createSupplierInvoice(sql, actor, validSupplierInvoice()));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.amount_usd, "10.00");
  assert.equal(captured.values[0], supplierId);
  assert.equal(captured.values[1], orderId);
  assert.equal(captured.values[5], "NIO");
  assert.equal(captured.values[6], 36.6);
  assert.equal(captured.values[7], 366);
  assert.equal(captured.values[8], 10);
  assert.equal(captured.values[10], actor.id);
  assert.match(captured.statement, /INSERT INTO supplier_invoices/);
  assert.match(captured.statement, /purchase_orders po WHERE po\.id=i\.order_id AND po\.supplier_id=s\.id/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
});

test("supplier invoice rejects due dates before invoice dates without querying Neon", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const result = await responseOf(await createSupplierInvoice(sql, actor, validSupplierInvoice({
    invoice_date: "2026-11-20",
    due_date: "2026-11-19"
  })));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_SUPPLIER_INVOICE");
  assert.equal(calls, 0);
});

test("supplier invoice payment records the payable, cash outflow and audit atomically", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{ id: invoiceId, payment_id: "00000000-0000-0000-0000-000000000701", paid_amount_usd: "10.00", status: "Pagada" }];
    }
  };

  const result = await responseOf(await addSupplierInvoicePayment(sql, actor, validSupplierPayment()));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.status, "Pagada");
  assert.deepEqual(captured.values, [
    invoiceId, accountId, "NIO", 10, 366, 36.6, "REF-QA-001", actor.id
  ]);
  assert.match(captured.statement, /FOR UPDATE/);
  assert.match(captured.statement, /INSERT INTO supplier_invoice_payments/);
  assert.match(captured.statement, /INSERT INTO cash_entries/);
  assert.match(captured.statement, /UPDATE supplier_invoices/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
});

test("supplier invoice payment rejects currency conversion mismatches before SQL", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const result = await responseOf(await addSupplierInvoicePayment(sql, actor, validSupplierPayment({
    amount_usd: 9.5
  })));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "SUPPLIER_PAYMENT_CONVERSION_MISMATCH");
  assert.equal(calls, 0);
});

test("supplier invoice payment returns conflict when the amount exceeds the current balance", async () => {
  let calls = 0;
  const sql = {
    async query() {
      calls += 1;
      if (calls === 1) return [];
      return [{ amount_usd: "10.00", paid_amount_usd: "5.00", account_currency: "NIO" }];
    }
  };

  const result = await responseOf(await addSupplierInvoicePayment(sql, actor, validSupplierPayment({
    original_amount: 219,
    amount_usd: 6
  })));
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, "SUPPLIER_PAYMENT_EXCEEDS_BALANCE");
  assert.equal(calls, 2);
});

test("procurement and supplier-payables endpoints require their own permission keys", () => {
  assert.equal(
    resolveRoutePermission("purchase-orders", "POST", "", ["api", "erp", "purchase-orders"], {}),
    "purchases.purchase_orders.create"
  );
  assert.equal(
    resolveRoutePermission("purchase-orders", "POST", orderId, ["api", "erp", "purchase-orders", orderId, "receipts"], {}),
    "purchases.receipts.receive"
  );
  assert.equal(
    resolveRoutePermission("supplier-invoices", "GET", "", ["api", "erp", "supplier-invoices"], {}),
    "purchases.supplier_invoices.view"
  );
  assert.equal(
    resolveRoutePermission("supplier-invoices", "POST", "", ["api", "erp", "supplier-invoices"], {}),
    "purchases.supplier_invoices.create"
  );
  assert.equal(
    resolveRoutePermission("supplier-invoice-payments", "POST", "", ["api", "erp", "supplier-invoice-payments"], {}),
    "payables.payments.create"
  );
});
