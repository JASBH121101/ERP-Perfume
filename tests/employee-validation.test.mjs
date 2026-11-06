import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmployeeCreateInput } from "../worker/src/erp.js";

test("employee contact normalization accepts an email without a phone", () => {
  const result = normalizeEmployeeCreateInput({
    name: "Colaborador",
    email: "  Persona@Example.COM ",
    commission_enabled: false,
    commission_rate: 17
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.email, "persona@example.com");
  assert.equal(result.value.phone, null);
  assert.equal(result.value.commission_enabled, false);
  assert.equal(result.value.commission_rate, 0);
});

test("employee contact normalization converts a Nicaraguan phone to E.164", () => {
  const result = normalizeEmployeeCreateInput({
    email: "",
    phone: "8888-8888",
    commission_enabled: false,
    commission_rate: 3
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.phone, "+50588888888");
  assert.equal(result.value.email, null);
  assert.equal(result.value.commission_rate, 0);
});

test("employee contact normalization preserves an international E.164 phone", () => {
  const result = normalizeEmployeeCreateInput({ phone: "+1 (415) 555-2671", email: "" });
  assert.equal(result.error, undefined);
  assert.equal(result.value.phone, "+14155552671");
});

test("employee creation allows contact details to be completed later", () => {
  const result = normalizeEmployeeCreateInput({ name: "Colaborador", commission_enabled: false });
  assert.equal(result.error, undefined);
  assert.equal(result.value.email, null);
  assert.equal(result.value.phone, null);
  assert.equal(result.value.commission_rate, 0);
});

test("partial employee updates preserve contact fields that were not submitted", () => {
  const result = normalizeEmployeeCreateInput({ position: "Asesor de ventas" }, { partial: true });
  assert.equal(result.error, undefined);
  assert.equal(Object.hasOwn(result.value, "email"), false);
  assert.equal(Object.hasOwn(result.value, "phone"), false);
  assert.equal(result.value.position, "Asesor de ventas");
});

test("employee creation rejects invalid optional contacts when supplied", () => {
  assert.equal(normalizeEmployeeCreateInput({ email: "correo-invalido" }).error.code, "INVALID_EMPLOYEE_EMAIL");
  assert.equal(normalizeEmployeeCreateInput({ phone: "123" }).error.code, "INVALID_EMPLOYEE_PHONE");
});

test("commission rate is forced to zero when commission is disabled", () => {
  const result = normalizeEmployeeCreateInput({
    email: "staff@example.test",
    commission_enabled: false,
    commission_rate: 25
  });

  assert.equal(result.value.commission_enabled, false);
  assert.equal(result.value.commission_rate, 0);
});

test("commission rate is validated when commission is enabled", () => {
  const valid = normalizeEmployeeCreateInput({
    email: "seller@example.test",
    commission_enabled: true,
    commission_rate: 5.5
  });
  assert.equal(valid.error, undefined);
  assert.equal(valid.value.commission_rate, 5.5);

  assert.equal(normalizeEmployeeCreateInput({
    email: "seller@example.test",
    commission_enabled: true,
    commission_rate: 0
  }).error.code, "INVALID_EMPLOYEE_COMMISSION");

  assert.equal(normalizeEmployeeCreateInput({
    email: "seller@example.test",
    commission_enabled: true,
    commission_rate: 101
  }).error.code, "INVALID_EMPLOYEE_COMMISSION");
});


test("employee creation accepts contract type, schedule and fixed-term dates", () => {
  const result = normalizeEmployeeCreateInput({
    name: "Colaborador",
    contract_type: "Temporal",
    work_schedule: "Parcial",
    contract_start_date: "2026-11-06",
    contract_end_date: "2027-05-06"
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.contract_type, "Temporal");
  assert.equal(result.value.work_schedule, "Parcial");
  assert.equal(result.value.contract_start_date, "2026-11-06");
  assert.equal(result.value.contract_end_date, "2027-05-06");
});

test("employee contract validation rejects unsupported values and invalid dates", () => {
  assert.equal(normalizeEmployeeCreateInput({ contract_type: "Por horas" }).error.code, "INVALID_EMPLOYEE_CONTRACT_TYPE");
  assert.equal(normalizeEmployeeCreateInput({ work_schedule: "Flexible" }).error.code, "INVALID_EMPLOYEE_WORK_SCHEDULE");
  assert.equal(normalizeEmployeeCreateInput({
    contract_type: "Temporal",
    contract_start_date: "2026-11-06",
    contract_end_date: null
  }).error.code, "TEMPORARY_CONTRACT_DATES_REQUIRED");
  assert.equal(normalizeEmployeeCreateInput({
    contract_type: "Indefinido",
    contract_start_date: "2026-11-06",
    contract_end_date: "2027-01-01"
  }).error.code, "UNEXPECTED_CONTRACT_END_DATE");
  assert.equal(normalizeEmployeeCreateInput({
    contract_type: "Temporal",
    contract_start_date: "2026-11-06",
    contract_end_date: "2026-10-31"
  }).error.code, "INVALID_EMPLOYEE_CONTRACT_RANGE");
  assert.equal(normalizeEmployeeCreateInput({
    contract_type: "Temporal",
    contract_start_date: "2026-02-30",
    contract_end_date: "2026-03-01"
  }).error.code, "INVALID_EMPLOYEE_CONTRACT_START_DATE");
});

test("partial employee updates preserve contract terms not included in the payload", () => {
  const result = normalizeEmployeeCreateInput({ position: "Asesor de ventas" }, { partial: true });
  assert.equal(result.error, undefined);
  assert.equal(Object.hasOwn(result.value, "contract_type"), false);
  assert.equal(Object.hasOwn(result.value, "work_schedule"), false);
  assert.equal(Object.hasOwn(result.value, "contract_start_date"), false);
  assert.equal(Object.hasOwn(result.value, "contract_end_date"), false);
});
