import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSupplierInput,
  createSupplier,
  updateSupplier
} from "../worker/src/erp.js";

const actor = { id: "00000000-0000-0000-0000-000000000099", role: "owner" };
const supplierId = "00000000-0000-0000-0000-000000000201";

async function responseOf(response) {
  return { status: response.status, body: await response.json() };
}

function validSupplier(overrides = {}) {
  return {
    name: "  Aromas   del Norte  ",
    contact: "María López",
    phone: "8223-4395",
    additional_phones: ["8617 4977", "+505 7880 5409"],
    email: "ventas@example.test",
    address: "Granada, Nicaragua",
    payment_terms: "Crédito 15 días",
    minimum_order_usd: 300,
    lead_time_days: 5,
    currency: "USD",
    notes: "Proveedor nacional",
    active: true,
    ...overrides
  };
}

test("supplier normalization separates company, contact person and normalized primary/secondary phones", () => {
  const result = normalizeSupplierInput(validSupplier());
  assert.equal(result.error, undefined);
  assert.equal(result.value.name, "Aromas del Norte");
  assert.equal(result.value.contact, "María López");
  assert.equal(result.value.phone, "+50582234395");
  assert.deepEqual(
    result.value.additional_phones.map(item => item.phone),
    ["+50586174977", "+50578805409"]
  );
  assert.equal(result.value.additional_phones[0].display_order, 1);
  assert.equal(result.value.additional_phones[1].display_order, 2);
  assert.equal(result.value.minimum_order_usd, 300);
  assert.equal(result.value.lead_time_days, 5);
});

test("supplier normalization rejects duplicated primary/secondary phones", async () => {
  const result = normalizeSupplierInput(validSupplier({
    additional_phones: ["+505 8223-4395"]
  }));
  assert.ok(result.error);
  assert.equal(result.error.status, 400);
  const body = await result.error.json();
  assert.equal(body.error.code, "DUPLICATE_SUPPLIER_PHONE");
});

test("supplier normalization rejects more than five additional numbers and invalid Nicaraguan phones", async () => {
  const tooMany = normalizeSupplierInput(validSupplier({
    additional_phones: ["88881111", "88882222", "88883333", "88884444", "88885555", "88886666"]
  }));
  assert.ok(tooMany.error);
  assert.equal((await tooMany.error.json()).error.code, "INVALID_SUPPLIER_PHONES");

  const invalidPhone = normalizeSupplierInput(validSupplier({ phone: "1234" }));
  assert.ok(invalidPhone.error);
  assert.equal((await invalidPhone.error.json()).error.code, "INVALID_SUPPLIER_PHONE");
});

test("supplier creation saves the company, primary phone, extra phones and audit in one SQL operation", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{
        id: supplierId,
        name: "Aromas del Norte",
        phone: "+50582234395",
        additional_phones: [
          { phone: "+50586174977", display_order: 1 },
          { phone: "+50578805409", display_order: 2 }
        ]
      }];
    }
  };

  const result = await responseOf(await createSupplier(sql, actor, validSupplier()));
  assert.equal(result.status, 201);
  assert.equal(result.body.record.id, supplierId);
  assert.match(captured.statement, /INSERT INTO suppliers/);
  assert.match(captured.statement, /INSERT INTO supplier_phone_numbers/);
  assert.match(captured.statement, /INSERT INTO audit_log/);
  assert.equal(captured.values[0], "Aromas del Norte");
  assert.equal(captured.values[2], "+50582234395");
  assert.deepEqual(JSON.parse(captured.values[11]).map(item => item.phone), [
    "+50586174977", "+50578805409"
  ]);
  assert.equal(captured.values[12], actor.id);
});

test("supplier update replaces all secondary phones atomically without multiplying inserts", async () => {
  let captured;
  const sql = {
    async query(statement, values) {
      captured = { statement, values };
      return [{ id: supplierId, name: "Aromas del Norte", additional_phones: [] }];
    }
  };

  const result = await responseOf(await updateSupplier(sql, actor, supplierId, validSupplier({
    additional_phones: ["86174977", "78805409"]
  })));
  assert.equal(result.status, 200);
  assert.match(captured.statement, /DELETE FROM supplier_phone_numbers/);
  assert.match(captured.statement, /delete_barrier AS \(SELECT count\(\*\) FROM deleted_phones\)/);
  assert.match(captured.statement, /INSERT INTO supplier_phone_numbers/);
  assert.equal(captured.values[12], supplierId);
  assert.equal(captured.values[13], actor.id);
  assert.deepEqual(JSON.parse(captured.values[11]).map(item => item.display_order), [1, 2]);
});

test("invalid supplier data is rejected before a database write", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; return []; } };
  const result = await responseOf(await createSupplier(sql, actor, validSupplier({
    email: "not-an-email"
  })));
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_SUPPLIER_EMAIL");
  assert.equal(calls, 0);
});
