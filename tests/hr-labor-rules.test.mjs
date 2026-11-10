import test from "node:test";
import assert from "node:assert/strict";
import { getMinimumWageForSector, MINIMUM_WAGE_SECTORS, validateMonthlyMinimumWage } from "../assets/js/hr-labor-rules.mjs";

test("2026 commerce minimum wage is effective March 1, 2026 through February 28, 2027", () => {
  const before = getMinimumWageForSector("commerce", "2026-02-28");
  const active = getMinimumWageForSector("commerce", "2026-11-10");
  const lastDay = getMinimumWageForSector("commerce", "2027-02-28");
  const expired = getMinimumWageForSector("commerce", "2027-03-01");
  assert.equal(before.available, false);
  assert.equal(active.available, true);
  assert.equal(active.amountNio, 11350.08);
  assert.equal(lastDay.available, true);
  assert.equal(expired.available, false);
  assert.equal(expired.code, "MINIMUM_WAGE_TABLE_EXPIRED");
});

test("minimum wage validation rejects a full-time monthly salary below the selected sector floor", () => {
  const result = validateMonthlyMinimumWage({
    salaryNio: 11350.07,
    status: "Activo",
    workSchedule: "Completa",
    effectiveDate: "2026-11-10",
    settings: { sector_code: "commerce" }
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(result.minimumSalaryNio, 11350.08);
});

test("minimum wage validation accepts the exact floor and salaries above it", () => {
  for (const salaryNio of [11350.08, 12000]) {
    const result = validateMonthlyMinimumWage({
      salaryNio,
      status: "Activo",
      workSchedule: "Completa",
      effectiveDate: "2026-11-10",
      settings: { sector_code: "commerce" }
    });
    assert.equal(result.valid, true);
    assert.equal(result.applies, true);
  }
});

test("reduced schedules cannot bypass the full monthly minimum-wage rule without an approved hourly configuration", () => {
  const result = validateMonthlyMinimumWage({
    salaryNio: 5000,
    status: "Activo",
    workSchedule: "Parcial",
    effectiveDate: "2026-11-10",
    settings: { sector_code: "commerce" }
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, "MINIMUM_WAGE_VIOLATION");
  assert.equal(result.minimumSalaryNio, 11350.08);
});

test("inactive staff records do not trigger a new-hire minimum-wage rejection", () => {
  const result = validateMonthlyMinimumWage({
    salaryNio: 5000,
    status: "Inactivo",
    workSchedule: "Completa",
    effectiveDate: "2026-11-10",
    settings: { sector_code: "commerce" }
  });
  assert.equal(result.valid, true);
  assert.equal(result.applies, false);
});

test("all published 2026 sectors have a positive wage and a valid effective window", () => {
  assert.equal(MINIMUM_WAGE_SECTORS.length, 10);
  for (const sector of MINIMUM_WAGE_SECTORS) {
    assert.ok(sector.amountNio > 0, sector.code);
    assert.ok(sector.effectiveFrom <= sector.effectiveTo, sector.code);
    assert.equal(getMinimumWageForSector(sector.code, sector.effectiveFrom).available, true, sector.code);
  }
});

test("unknown sector and invalid date fail closed", () => {
  assert.equal(getMinimumWageForSector("unknown", "2026-11-10").code, "UNKNOWN_MINIMUM_WAGE_SECTOR");
  assert.equal(getMinimumWageForSector("commerce", "2026-02-30").code, "INVALID_MINIMUM_WAGE_DATE");
});
