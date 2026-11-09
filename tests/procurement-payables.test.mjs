import test from "node:test";
import assert from "node:assert/strict";
import {
  createPurchaseOrder,
  createPurchaseReceipt,
  postPurchaseReceipt,
  createSupplierInvoice,
  addSupplierInvoicePayment,
  resolveRoutePermission,
  canApprovePurchaseOrder,
  normalizeClientErrorInput
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
    supplier_id: supplierId,
    currency: "NIO",
    exchange_rate: 36.6,
    discount_usd: 1,
    estimated_freight_usd: 2,
    estimated_taxes_usd: 0.5,
    expected_delivery_date: "2026-11-15",
    payment_terms: "Crédito 30 días",
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
      return [{ id: orderId, order_number: "1", item_count: 2, subtotal_usd: "35.00", total_usd: "36.50" }];
    }
  };

  const result = await responseOf(await createPurchaseOrder(sql, actor, validPurchaseOrder()));

  assert.equal(result.status, 201);
  assert.equal(result.body.record.id, orderId);
  assert.match(result.body.record.order_number, /^\d+$/);
  assert.equal(captured.values[0], supplierId);
  assert.equal(captured.values[1], "NIO");
  assert.equal(captured.values[2], 36.6);
  assert.equal(captured.values[3], 35);
  assert.equal(captured.values[4], 1);
  assert.equal(captured.values[5], 2);
  assert.equal(captured.values[6], 0.5);
  assert.equal(captured.values[7], 36.5);
  assert.equal(captured.values[12], actor.id);
  assert.match(captured.statement, /nextval\('public\.purchase_order_number_seq'\)/);
  assert.doesNotMatch(captured.statement, /TO_CHAR\(CURRENT_DATE,'YYYY'\)/);

  const lines = JSON.parse(captured.values[11]);
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
      { purchase_order_item_id: orderItemId, quantity_received: 1, invoice_unit_cost_input: 10 },
      { purchase_order_item_id: orderItemId, quantity_received: 1, invoice_unit_cost_input: 10 }
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

test("purchase receipt emission stores supplier invoice and reserves quantities without posting stock", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        id: "00000000-0000-0000-0000-000000000403",
        receipt_number: "000001",
        document_status: "Emitida",
        invoice_total_usd: "20.00"
      }];
    }
  };
  const result = await responseOf(await createPurchaseReceipt(sql, actor, orderId, {
    supplier_invoice_number: "FAC-QA-001",
    supplier_invoice_date: "2026-11-08",
    invoice_currency: "USD",
    invoice_exchange_rate: 1,
    invoice_original_total: 20,
    payment_terms: "Contado",
    actual_freight_usd: 1.5,
    actual_taxes_usd: 0,
    notes: "Recepción pendiente QA",
    items: [{ purchase_order_item_id: orderItemId, quantity_received: 2, invoice_unit_cost_input: 10 }]
  }));
  assert.equal(result.status, 201);
  assert.equal(result.body.record.document_status, "Emitida");
  assert.equal(captured.values[0], orderId);
  assert.equal(captured.values[1], "FAC-QA-001");
  assert.equal(captured.values[2], "2026-11-08");
  assert.equal(captured.values[3], "USD");
  assert.equal(captured.values[4], 1);
  assert.equal(captured.values[5], 20);
  assert.equal(captured.values[6], 1.5);
  assert.deepEqual(JSON.parse(captured.values[10]), [
    { purchase_order_item_id: orderItemId, quantity_received: 2, invoice_unit_cost_input: 10 }
  ]);
  assert.equal(captured.values[11], actor.id);
  assert.match(captured.statement, /document_status='Emitida'/);
  assert.match(captured.statement, /reserved_quantity/);
  assert.match(captured.statement, /SUM\\(m\\.quantity_received\\*\\(CASE WHEN i\\.currency='NIO' THEN m\\.invoice_unit_cost_input\\/i\\.exchange_rate ELSE m\\.invoice_unit_cost_input END\\)\\)/);
  assert.match(captured.statement, /i\\.freight_usd\\*\\(CASE WHEN i\\.currency='NIO' THEN m\\.invoice_unit_cost_input\\/i\\.exchange_rate ELSE m\\.invoice_unit_cost_input END\\)\\*m\\.quantity_received\\/a\\.expected_merchandise_usd/);
  assert.match(captured.statement, /i\\.taxes_usd\\*\\(CASE WHEN i\\.currency='NIO' THEN m\\.invoice_unit_cost_input\\/i\\.exchange_rate ELSE m\\.invoice_unit_cost_input END\\)\\*m\\.quantity_received\\/a\\.expected_merchandise_usd/);
  assert.doesNotMatch(captured.statement, /i\\.freight_usd\\*m\\.unit_cost_usd/);
  assert.doesNotMatch(captured.statement, /i\\.taxes_usd\\*m\\.unit_cost_usd/);
  assert.match(captured.statement, /supplier_invoice_number/);
  assert.ok(captured.statement.includes("pg_advisory_xact_lock(hashtextextended(po.supplier_id::text||':'||i.invoice_number,0))"));
  assert.ok(captured.statement.includes("FROM purchase_receipts existing JOIN purchase_orders existing_order"));
  assert.ok(captured.statement.includes("existing.supplier_invoice_number=i.invoice_number"));
  assert.doesNotMatch(captured.statement, /UPDATE products/);
  assert.doesNotMatch(captured.statement, /INSERT INTO inventory_movements/);
  assert.doesNotMatch(captured.statement, /INSERT INTO supplier_invoices/);
});

test("purchase receipt emission rejects missing supplier invoice fields before SQL", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const result = await responseOf(await createPurchaseReceipt(sql, actor, orderId, {
    items: [{ purchase_order_item_id: orderItemId, quantity_received: 1, invoice_unit_cost_input: 10 }]
  }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_PURCHASE_RECEIPT");
  assert.equal(calls, 0);
});

test("purchase receipt posting atomically updates stock, payables, purchase code and balanced journal", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        id: "00000000-0000-0000-0000-000000000403",
        document_status: "Contabilizada",
        purchase_code: 41,
        journal_number: 9,
        purchase_order_status: "Recepción parcial"
      }];
    }
  };
  const receiptId = "00000000-0000-0000-0000-000000000403";
  const result = await responseOf(await postPurchaseReceipt(sql, actor, receiptId));
  assert.equal(result.status, 200);
  assert.equal(result.body.record.purchase_code, 41);
  assert.equal(captured.values[0], receiptId);
  assert.equal(captured.values[1], actor.id);
  assert.match(captured.statement, /FOR UPDATE OF pr,po/);
  assert.match(captured.statement, /UPDATE products/);
  assert.match(captured.statement, /INSERT INTO inventory_movements/);
  assert.match(captured.statement, /INSERT INTO supplier_invoices/);
  assert.match(captured.statement, /INSERT INTO purchase_journal_entries/);
  assert.match(captured.statement, /INSERT INTO purchase_journal_lines/);
  const creditPattern = "BTRIM(r.payment_terms_snapshot) ~* '^(Crédito[[:space:]]+)?[0-9]+[[:space:]]+días" + String.fromCharCode(36) + "'";
  assert.ok(captured.statement.includes(creditPattern), "Credit terms must add their stated number of days.");
  assert.ok(captured.statement.includes("ELSE NULL END"), "Por acordar must not create a same-day due date.");
  assert.match(captured.statement, /UPDATE purchase_receipts/);
  assert.match(captured.statement, /document_status='Emitida'/);
  assert.match(captured.statement, /SUM\(pri\.quantity_received\)::int/);
  assert.match(captured.statement, /pri\.receipt_id=\(SELECT id FROM locked_receipt\)/);
  assert.match(captured.statement, /oi\.received_quantity\+COALESCE/);
  assert.match(captured.statement, /FROM validation v LEFT JOIN posted_receipt p ON TRUE/);
});

test("reposting an already-accounted receipt returns a conflict, not a missing-record response", async () => {
  const sql = {
    async query(statement) {
      assert.match(statement, /FROM validation v LEFT JOIN posted_receipt p ON TRUE/);
      return [{
        receipt_exists: true,
        previous_status: "Contabilizada",
        invalid_quantity_count: 0,
        line_count: 1
      }];
    }
  };
  const result = await responseOf(await postPurchaseReceipt(sql, actor, orderId));
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, "PURCHASE_RECEIPT_NOT_PENDING");
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
  assert.ok(captured.statement.includes("pg_advisory_xact_lock(hashtextextended(i.supplier_id::text||':'||i.invoice_number,0))"));
  assert.match(captured.statement, /FROM purchase_receipts pr JOIN purchase_orders po ON po\.id=pr\.purchase_order_id/);
  assert.match(captured.statement, /pr\.supplier_invoice_number=i\.invoice_number/);
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

test("supplier invoice payment rejects voided invoices without creating a payment or cash outflow", async () => {
  let calls=0;
  let paymentStatement="";
  const sql={
    async query(statement) {
      calls+=1;
      if(calls===1){paymentStatement=statement;return [];}
      return [{amount_usd:"10.00",paid_amount_usd:"0.00",status:"Anulada",account_currency:"NIO"}];
    }
  };
  const result=await responseOf(await addSupplierInvoicePayment(sql,actor,validSupplierPayment()));
  assert.equal(result.status,409);
  assert.equal(result.body.error.code,"SUPPLIER_INVOICE_VOIDED");
  assert.equal(calls,2);
  assert.match(paymentStatement,/invoice_status<>'Anulada'/);
  assert.match(paymentStatement,/INSERT INTO supplier_invoice_payments/);
  assert.match(paymentStatement,/INSERT INTO cash_entries/);
});


test("purchase order approval requires a different user from its creator", () => {
  assert.equal(canApprovePurchaseOrder(actor.id, actor.id), false);
  assert.equal(canApprovePurchaseOrder(actor.id, "00000000-0000-0000-0000-000000000098"), true);
  assert.equal(canApprovePurchaseOrder(actor.id, null), true);
});

test("client error telemetry redacts contact details and strips query strings", () => {
  const result = normalizeClientErrorInput({
    error_type: "javascript_error",
    error_message: "Request failed for user person@example.com, phone +505 8888 1111",
    page_path: "/products?token=private",
    source_file: "https://erp.example/assets/app.js?secret=private",
    line_number: 45,
    column_number: 7
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.page_path, "/products");
  assert.equal(result.value.source_file, "https://erp.example/assets/app.js");
  assert.equal(result.value.error_message.includes("person@example.com"), false);
  assert.equal(result.value.error_message.includes("8888 1111"), false);
  assert.equal(normalizeClientErrorInput({ error_type: "api_error", error_message: "x" }).error.code, "INVALID_CLIENT_ERROR_TYPE");
});


test("purchase order rejects unsupported payment terms before SQL", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const result = await responseOf(await createPurchaseOrder(sql, actor, validPurchaseOrder({
    payment_terms: "No definido"
  })));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_PURCHASE_ORDER");
  assert.equal(calls, 0);
});
