import test from "node:test";
import assert from "node:assert/strict";
import { createGeneric, updateEmployeeGeneric } from "../worker/src/erp.js";

const user = { id: "22222222-2222-4222-8222-222222222222" };
const employeeId = "11111111-1111-4111-8111-111111111111";
const employeeDef = {
  table: "employees",
  fields: [
    "name","position","department","salary_nio","status","phone","email","notes",
    "commission_enabled","commission_rate","contract_type","work_schedule",
    "contract_start_date","contract_end_date"
  ],
  order: "name ASC"
};

function createSql({ settings = { sector_code: "commerce" }, record = { id: employeeId, name: "QA Employee" } } = {}) {
  const calls = [];
  return {
    calls,
    async query(statement, args) {
      calls.push({ statement, args });
      if (statement.startsWith("SELECT setting_value FROM app_settings WHERE setting_key='hr_labor_settings'")) {
        return [{ setting_value: settings }];
      }
      if (statement.startsWith('WITH changed AS (INSERT INTO "employees"')) return [record];
      throw new Error("Unexpected SQL: " + statement.slice(0, 120));
    }
  };
}

function updateSql({
  settings = { sector_code: "commerce" },
  current = { salary_nio: "10000.00", work_schedule: "Completa", status: "Activo" },
  updateResult = { id: employeeId, salary_nio: "11350.08", status: "Activo" }
} = {}) {
  const calls = [];
  return {
    calls,
    async query(statement, args) {
      calls.push({ statement, args });
      if (statement.startsWith("SELECT salary_nio,work_schedule,status FROM employees")) return [current];
      if (statement.startsWith("SELECT setting_value FROM app_settings WHERE setting_key='hr_labor_settings'")) {
        return [{ setting_value: settings }];
      }
      if (statement.includes("WITH old AS MATERIALIZED")) return updateResult ? [updateResult] : [];
      throw new Error("Unexpected SQL: " + statement.slice(0, 120));
    }
  };
}

test("employee creation rejects an active full-time salary below the default commerce minimum", async () => {
  const sql = createSql();
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Employee", salary_nio: 10000, status: "Activo", work_schedule: "Completa"
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(sql.calls.length, 1);
  assert.equal(sql.calls[0].statement.startsWith("SELECT setting_value"), true);
});

test("employee creation accepts the exact current commerce minimum", async () => {
  const sql = createSql();
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Employee", salary_nio: 11350.08, status: "Activo", work_schedule: "Completa"
  });
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.record.id, employeeId);
  assert.equal(sql.calls.length, 2);
  assert.ok(sql.calls[1].statement.includes('INSERT INTO "employees"'));
});

test("employee creation also enforces the monthly minimum for reduced schedules", async () => {
  const sql = createSql();
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Part-time Employee", salary_nio: 5000, status: "Activo", work_schedule: "Parcial"
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(sql.calls.length, 1);
});

test("inactive employee records can be prepared without activating payroll rights", async () => {
  const sql = createSql();
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Inactive Employee", salary_nio: 5000, status: "Inactivo", work_schedule: "Completa"
  });
  assert.equal(response.status, 201);
  assert.equal(sql.calls.length, 2);
});

test("employee creation follows the selected sector instead of hardcoding commerce", async () => {
  const sql = createSql({ settings: { sector_code: "manufactura" } });
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Manufacturing Employee", salary_nio: 8320.48, status: "Activo", work_schedule: "Completa"
  });
  assert.equal(response.status, 201);
});

test("employee creation uses the separate regime-especial wage and validity window", async () => {
  const sql = createSql({ settings: { sector_code: "regimen_especial" } });
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Special Regime Employee", salary_nio: 9986.46, status: "Activo", work_schedule: "Completa"
  });

  assert.equal(response.status, 201);
  assert.equal(sql.calls.length, 2);
});

test("employee salary updates below the selected floor are rejected before writing history", async () => {
  const sql = updateSql();
  const response = await updateEmployeeGeneric(sql, user, "employees", employeeDef, employeeId, {
    salary_nio: 10000,
    effective_date: "2026-11-10",
    change_reason: "Revisión de salario"
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(sql.calls.length, 2);
  assert.equal(sql.calls.some(call => call.statement.includes("WITH old AS MATERIALIZED")), false);
});

test("employee salary updates at the exact floor preserve the immutable history update", async () => {
  const sql = updateSql();
  const response = await updateEmployeeGeneric(sql, user, "employees", employeeDef, employeeId, {
    salary_nio: 11350.08,
    effective_date: "2026-11-10",
    change_reason: "Ajuste al salario mínimo 2026"
  });

  assert.equal(response.status, 200);
  assert.equal(sql.calls.length, 3);
  const mutation = sql.calls[2];
  assert.ok(mutation.statement.includes("employee_history"));
  assert.ok(mutation.statement.includes("IS NOT DISTINCT FROM $3"));
  assert.ok(mutation.statement.includes("IS NOT DISTINCT FROM $4"));
  assert.ok(mutation.statement.includes("IS NOT DISTINCT FROM $5"));
  assert.equal(mutation.args[0], 11350.08);
  assert.equal(mutation.args[2], "10000.00");
});

test("non-salary employee edits also reject active records below the current floor", async () => {
  const sql = updateSql();
  const response = await updateEmployeeGeneric(sql, user, "employees", employeeDef, employeeId, {
    position: "Asesor",
    effective_date: "2026-11-10",
    change_reason: "Cambio de puesto"
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(sql.calls.length, 2);
});

test("concurrent employee changes are detected instead of overwriting a stale wage snapshot", async () => {
  const sql = updateSql({ updateResult: null });
  const response = await updateEmployeeGeneric(sql, user, "employees", employeeDef, employeeId, {
    salary_nio: 11350.08,
    effective_date: "2026-11-10",
    change_reason: "Ajuste de salario"
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "EMPLOYEE_CHANGED_CONCURRENTLY");
  assert.equal(sql.calls.length, 3);
});

test("unknown wage sectors block employee creation instead of applying an arbitrary default", async () => {
  const sql = createSql({ settings: { sector_code: "unmapped" } });
  const response = await createGeneric(sql, user, "employees", employeeDef, {
    name: "QA Employee", salary_nio: 15000, status: "Activo", work_schedule: "Completa"
  });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "UNKNOWN_MINIMUM_WAGE_SECTOR");
  assert.equal(sql.calls.length, 1);
});
