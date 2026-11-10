import test from "node:test";
import assert from "node:assert/strict";
import { addInvoicePayment } from "../worker/src/erp.js";

const body = {
  invoice_id: "11111111-1111-4111-8111-111111111111",
  currency: "USD",
  original_amount: 25,
  exchange_rate: 1,
  amount_usd: 25,
  account_name: "Caja USD",
  payment_method: "Efectivo"
};
const user = { id: "22222222-2222-4222-8222-222222222222" };

function mockSql(result) {
  const calls = [];
  return {
    calls,
    async query(statement, args) {
      calls.push({ statement, args });
      if (statement.startsWith("SELECT id FROM cash_accounts")) return [{ id: "33333333-3333-4333-8333-333333333333" }];
      if (statement.includes("WITH target AS MATERIALIZED")) return [result];
      throw new Error("Unexpected SQL call: " + statement.slice(0, 100));
    }
  };
}

test("API refuses a payment on an annulled invoice before writing payment, cash or audit rows", async () => {
  const sql = mockSql({ invoice_exists: true, invoice_status: "Anulada", record: null });
  const response = await addInvoicePayment(sql, user, body);
  const payload = await response.json();
  assert.equal(response.status, 409);
  assert.deepEqual(payload, {
    error: {
      code: "INVOICE_VOIDED",
      message: "No se puede registrar un abono sobre una factura anulada o cancelada."
    }
  });
  assert.equal(sql.calls.length, 2);
  const mutation = sql.calls[1].statement;
  assert.match(mutation, /FOR UPDATE/);
  assert.match(mutation, /NOT IN \('anulada','anulado','cancelada','cancelado','void','voided'\)/);
  assert.match(mutation, /INSERT INTO invoice_payments/);
  assert.match(mutation, /INSERT INTO cash_entries/);
  assert.match(mutation, /INSERT INTO audit_log/);
});

test("API returns not found when the referenced invoice does not exist", async () => {
  const sql = mockSql({ invoice_exists: false, invoice_status: null, record: null });
  const response = await addInvoicePayment(sql, user, body);
  const payload = await response.json();
  assert.equal(response.status, 404);
  assert.equal(payload.error.code, "INVOICE_NOT_FOUND");
});

test("API preserves a valid payment result for a non-voided invoice", async () => {
  const record = { id: body.invoice_id, invoice_number: "JB-0001", status: "Abono parcial", paid_usd: "25" };
  const sql = mockSql({ invoice_exists: true, invoice_status: "Pendiente", record });
  const response = await addInvoicePayment(sql, user, body);
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.deepEqual(payload.record, record);
});
