import test from "node:test";
import assert from "node:assert/strict";
import { createPayrollItem } from "../worker/src/erp.js";

const periodId = "11111111-1111-4111-8111-111111111111";
const employeeId = "22222222-2222-4222-8222-222222222222";
const user = { id: "33333333-3333-4333-8333-333333333333" };
const settings = [
  { setting_key: "hr_inss_settings", setting_value: { employee_rate: 7, employer_rate: 21.5 } },
  { setting_key: "hr_tax_settings", setting_value: { inatec_rate: 2, ir_brackets: [{"upper":100000,"base":0,"rate":0,"excess":0},{"upper":200000,"base":0,"rate":15,"excess":100000},{"upper":350000,"base":15000,"rate":20,"excess":200000},{"upper":500000,"base":45000,"rate":25,"excess":350000},{"upper":null,"base":82500,"rate":30,"excess":500000}] } },
  { setting_key: "hr_labor_settings", setting_value: { sector_code: "commerce" } }
];

function mockSql({
  periodEnd = "2026-11-10",
  periodFrequency = "monthly",
  periodType = "Ordinaria",
  employeeSalary = "12000.00",
  employeeStatus = "Activo",
  createResult = { id: "payroll-item-qa", net_salary_nio: "11350.08" }
} = {}) {
  const calls = [];
  return {
    calls,
    async query(statement, args) {
      calls.push({ statement, args });
      if (statement.startsWith("SELECT setting_key,setting_value FROM app_settings")) return settings;
      if (statement.startsWith("SELECT p.status AS period_status")) {
        return [{
          period_status: "Borrador",
          period_type: periodType,
          period_frequency: periodFrequency,
          period_end: periodEnd,
          salary_nio: employeeSalary,
          work_schedule: "Completa",
          employee_status: employeeStatus
        }];
      }
      if (statement.includes("WITH period AS (SELECT id,status,period_start")) return createResult ? [createResult] : [];
      if (statement.startsWith("SELECT status,period_type FROM hr_payroll_periods")) return [{ status: "Borrador", period_type: periodType }];
      if (statement.startsWith("SELECT id,salary_nio FROM employees")) return [{ id: employeeId, salary_nio: employeeSalary }];
      throw new Error("Unexpected SQL: " + statement.slice(0, 120));
    }
  };
}

const validBody = {
  payroll_period_id: periodId,
  employee_id: employeeId,
  base_salary_nio: 11350.08,
  bonuses_nio: 0,
  deductions_nio: 0,
  notes: "QA minimum wage"
};

test("monthly payroll rejects a base lower than the sector minimum", async () => {
  const sql = mockSql();
  const response = await createPayrollItem(sql, user, { ...validBody, base_salary_nio: 11350.07 });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "PAYROLL_BELOW_MINIMUM_WAGE");
  assert.equal(sql.calls.length, 2);
  assert.equal(sql.calls.some(call => call.statement.includes("WITH period AS (SELECT id,status,period_start")), false);
});

test("monthly payroll accepts the exact sector minimum and carries the floor into locked SQL", async () => {
  const sql = mockSql();
  const response = await createPayrollItem(sql, user, validBody);
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.record.id, "payroll-item-qa");
  assert.equal(sql.calls.length, 3);
  const mutation = sql.calls[2];
  assert.ok(mutation.statement.includes("salary_nio >= $13 FOR UPDATE"));
  assert.ok(mutation.statement.includes("$3>=$12"));
  assert.equal(mutation.args[11], 11350.08);
  assert.equal(mutation.args[12], 11350.08);
});

test("biweekly payroll uses half the monthly sector minimum", async () => {
  const sql = mockSql({ periodFrequency: "biweekly" });
  const rejected = await createPayrollItem(sql, user, { ...validBody, base_salary_nio: 5675.03 });
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error.code, "PAYROLL_BELOW_MINIMUM_WAGE");

  const acceptedSql = mockSql({ periodFrequency: "biweekly" });
  const accepted = await createPayrollItem(acceptedSql, user, { ...validBody, base_salary_nio: 5675.04 });
  assert.equal(accepted.status, 201);
  assert.equal(acceptedSql.calls[2].args[11], 5675.04);
});

test("weekly payroll uses the monthly minimum multiplied by twelve divided by fifty-two", async () => {
  const required = Number((11350.08 * 12 / 52).toFixed(2));
  const sql = mockSql({ periodFrequency: "weekly" });
  const rejected = await createPayrollItem(sql, user, { ...validBody, base_salary_nio: required - 0.01 });
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error.code, "PAYROLL_BELOW_MINIMUM_WAGE");

  const acceptedSql = mockSql({ periodFrequency: "weekly" });
  const accepted = await createPayrollItem(acceptedSql, user, { ...validBody, base_salary_nio: required });
  assert.equal(accepted.status, 201);
  assert.equal(acceptedSql.calls[2].args[11], required);
});

test("aguinaldo remains calculated separately while the employee's ordinary monthly salary is validated", async () => {
  const sql = mockSql({ periodType: "Aguinaldo", periodFrequency: "monthly" });
  const response = await createPayrollItem(sql, user, {
    ...validBody, base_salary_nio: 0, bonuses_nio: 0, deductions_nio: 0
  });
  assert.equal(response.status, 201);
  assert.ok(sql.calls[2].statement.includes("p.period_type='Aguinaldo'"));
});

test("payroll cannot proceed when the employee's monthly salary is below the current minimum", async () => {
  const sql = mockSql({ employeeSalary: "11000.00" });
  const response = await createPayrollItem(sql, user, validBody);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(sql.calls.length, 2);
});

test("payroll fails closed after the wage table's effective period ends", async () => {
  const sql = mockSql({ periodEnd: "2027-03-01" });
  const response = await createPayrollItem(sql, user, validBody);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "MINIMUM_WAGE_TABLE_EXPIRED");
  assert.equal(sql.calls.length, 2);
});
