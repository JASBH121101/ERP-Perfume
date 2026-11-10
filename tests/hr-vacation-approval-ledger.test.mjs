import test from "node:test";
import assert from "node:assert/strict";
import { reviewLeaveRequest } from "../worker/src/erp.js";

const user = { id: "22222222-2222-4222-8222-222222222222" };
const requestId = "11111111-1111-4111-8111-111111111111";
const record = {
  id: requestId,
  employee_id: "33333333-3333-4333-8333-333333333333",
  leave_type: "Vacaciones",
  days: "2.00",
  status: "Aprobado",
  available_days: "7.50"
};

function sqlFor(status, row = { ...record, status }) {
  const calls = [];
  return {
    calls,
    async query(statement, args) {
      calls.push({ statement, args });
      if (statement.startsWith("WITH target AS")) return row ? [row] : [];
      if (statement.startsWith("SELECT l.status,l.leave_type")) {
        return [{
          status: "Pendiente",
          leave_type: "Vacaciones",
          days: "9.00",
          hire_date: "2026-01-01",
          end_date: "2026-04-01",
          used_days: "0.00"
        }];
      }
      if (statement.startsWith("SELECT ROUND(GREATEST(0")) return [{ balance: "7.50" }];
      throw new Error("Unexpected SQL call: " + statement.slice(0, 120));
    }
  };
}

test("approving vacation locks the pending request and creates one append-only ledger debit in the same SQL operation", async () => {
  const sql = sqlFor("Aprobado");
  const response = await reviewLeaveRequest(sql, user, requestId, { status: "Aprobado" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.record.status, "Aprobado");
  assert.equal(sql.calls.length, 1);
  assert.deepEqual(sql.calls[0].args, ["Aprobado", user.id, requestId]);

  const statement = sql.calls[0].statement;
  assert.match(statement, /FOR UPDATE OF l,e/);
  assert.match(statement, /UPDATE hr_leave_requests/);
  assert.match(statement, /INSERT INTO hr_vacation_ledger/);
  assert.match(statement, /source_leave_request_id/);
  assert.match(statement, /'enjoyed'/);
  assert.match(statement, /-ABS\(c\.days\)/);
  assert.match(statement, /WHERE \$1='Aprobado' AND c\.leave_type IN \('Vacaciones','Vacation'\)/);
  assert.match(statement, /INSERT INTO audit_log/);
});

test("rejecting vacation does not create a vacation ledger debit", async () => {
  const rejected = { ...record, status: "Rechazado" };
  const sql = sqlFor("Rechazado", rejected);
  const response = await reviewLeaveRequest(sql, user, requestId, { status: "Rechazado" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.record.status, "Rechazado");
  assert.equal(sql.calls.length, 1);
  assert.equal(sql.calls[0].args[0], "Rechazado");
  const statement = sql.calls[0].statement;
  assert.match(statement, /INSERT INTO hr_vacation_ledger/);
  assert.match(statement, /WHERE \$1='Aprobado' AND c\.leave_type IN \('Vacaciones','Vacation'\)/);
});

test("vacation request approval fails closed when requested days exceed the available ledger balance", async () => {
  const sql = sqlFor("Aprobado", null);
  const response = await reviewLeaveRequest(sql, user, requestId, { status: "Aprobado" });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "INSUFFICIENT_VACATION_BALANCE");
  assert.equal(sql.calls.length, 3);
  assert.match(sql.calls[0].statement, /b\.days<=b\.available_days/);
});

test("leave review rejects unknown statuses without querying the database", async () => {
  const sql = sqlFor("Pendiente");
  const response = await reviewLeaveRequest(sql, user, requestId, { status: "Pendiente" });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "INVALID_LEAVE_STATUS");
  assert.equal(sql.calls.length, 0);
});
