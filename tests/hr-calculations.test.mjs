import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTenure, calculateVacationBalance, calculateAguinaldoEstimate,
  calculateInss, calculateCommission, convertCommissionForPayroll,
  calculateAnnualIncomeTax, calculatePayrollWithholding, calculateProductPricing
} from "../assets/js/hr-calculations.mjs";

test("tenure renders complete years, months and days", () => {
  assert.deepEqual(calculateTenure("2024-01-15", "2026-04-27"), {
    years: 2, months: 3, days: 12, totalDays: 833, label: "2 años, 3 meses, 12 días"
  });
  assert.equal(calculateTenure("2026-11-05", "2026-11-05").label, "0 días");
  assert.equal(calculateTenure("2026-11-06", "2026-11-05").label, "Fecha de ingreso pendiente");
});

test("vacation balance accrues 2.5 days per full month and deducts approved taken leave", () => {
  const result = calculateVacationBalance({
    hireDate: "2026-01-01", employeeId: "e1", asOf: "2026-04-01",
    leaveRequests: [
      { employeeId: "e1", leaveType: "Vacaciones", status: "Aprobado", days: 2, endDate: "2026-03-10" },
      { employeeId: "e1", leaveType: "Vacaciones", status: "Pendiente", days: 5, endDate: "2026-03-20" },
      { employeeId: "e2", leaveType: "Vacaciones", status: "Aprobado", days: 3, endDate: "2026-03-10" },
      { employeeId: "e1", leaveType: "Vacaciones", status: "Aprobado", days: 4, endDate: "2026-05-10" }
    ]
  });
  assert.deepEqual(result, { accruedDays: 7.5, usedDays: 2, balanceDays: 5.5 });
});

test("aguinaldo estimate prorates the Dec-to-Nov work cycle", () => {
  const result = calculateAguinaldoEstimate({ hireDate: "2026-06-01", salaryNio: 12000, asOf: "2026-11-30" });
  assert.equal(result.cycleStart, "2025-12-01");
  assert.equal(result.cycleEnd, "2026-11-30");
  assert.equal(result.amountNio, 6016.44);
});

test("aguinaldo is not accrued before one month of service and December 1-10 closes the prior cycle", () => {
  const recentHire = calculateAguinaldoEstimate({ hireDate: "2026-11-20", salaryNio: 10000, asOf: "2026-12-05" });
  assert.equal(recentHire.amountNio, 0);
  const cycle = calculateAguinaldoEstimate({ hireDate: "2025-12-01", salaryNio: 10000, asOf: "2026-12-05" });
  assert.equal(cycle.cycleStart, "2025-12-01");
  assert.equal(cycle.cycleEnd, "2026-11-30");
});

test("commission-based aguinaldo basis uses the highest supplied recent monthly ordinary salary", () => {
  const result = calculateAguinaldoEstimate({
    hireDate: "2025-12-01", salaryNio: 10000, commissionEnabled: true,
    monthlyOrdinarySalaries: [10500, 11200, 9800, 12500, 11900, 11400],
    asOf: "2026-11-30"
  });
  assert.equal(result.monthlyBasisNio, 12500);
  assert.equal(result.amountNio, 12500);
});

test("INSS splits employee withholding from employer cost and includes commission", () => {
  assert.deepEqual(calculateInss({ baseSalaryNio: 10000, commissionsNio: 1500, employeeRate: 7, employerRate: 21.5 }), {
    contributionBaseNio: 11500, employeeInssNio: 805, employerInssNio: 2472.5
  });
});

test("commission is calculated on positive gross profit after a pro-rata discount", () => {
  assert.deepEqual(calculateCommission({
    lineTotalUsd: 80, unitCostUsd: 55, quantity: 1,
    discountShareUsd: 0, ratePercent: 3, exchangeRate: 36.6
  }), {
    grossSaleUsd: 80, netSaleUsd: 80, costUsd: 55,
    grossProfitUsd: 25, commissionUsd: 0.75, commissionNio: 27.45
  });
  assert.equal(calculateCommission({ lineTotalUsd: 50, unitCostUsd: 55, ratePercent: 3 }).commissionUsd, 0);
});

test("payroll converts USD commission using the frozen payroll exchange rate", () => {
  assert.deepEqual(convertCommissionForPayroll(12.5, 36.6), {
    commissionUsd: 12.5, exchangeRate: 36.6, commissionNio: 457.5
  });
  assert.throws(() => convertCommissionForPayroll(-1, 36.6), RangeError);
  assert.throws(() => convertCommissionForPayroll(10, 0), RangeError);
});


test("annual income tax applies the progressive work-income brackets", () => {
  assert.equal(calculateAnnualIncomeTax(100000), 0);
  assert.equal(calculateAnnualIncomeTax(150000), 7500);
  assert.equal(calculateAnnualIncomeTax(250000), 25000);
  assert.equal(calculateAnnualIncomeTax(400000), 57500);
  assert.equal(calculateAnnualIncomeTax(600000), 112500);
});

test("variable commission-only payroll calculates progressive IR and employer-only INATEC", () => {
  const first = calculatePayrollWithholding({
    baseSalaryNio: 0, commissionsNio: 6000, employeeInssNio: 420, frequency: "biweekly", inatecRate: 2
  });
  assert.equal(first.taxableIncomeNio, 5580);
  assert.equal(first.annualizedIncomeNio, 133920);
  assert.equal(first.irWithheldNio, 212);
  assert.equal(first.inatecEmployerNio, 120);
  const second = calculatePayrollWithholding({
    baseSalaryNio: 0, commissionsNio: 8000, employeeInssNio: 560, frequency: "biweekly", inatecRate: 2,
    previousPeriods: [{ taxableIncomeNio: 5580, irWithheldNio: 212 }]
  });
  assert.equal(second.annualizedIncomeNio, 156240);
  assert.equal(second.irWithheldNio, 491);
});

test("aguinaldo payroll withholding is exempt from IR and INATEC", () => {
  const result = calculatePayrollWithholding({ baseSalaryNio: 0, bonusesNio: 1000, periodType: "Aguinaldo" });
  assert.deepEqual(result, {
    taxableIncomeNio: 0, annualizedIncomeNio: 0, annualTaxNio: 0, irWithheldNio: 0, inatecEmployerNio: 0
  });
});

test("vacation ledger leaves paid-but-not-used days intact and subtracts leave and termination settlement", () => {
  const result = calculateVacationBalance({
    hireDate: "2026-01-01", employeeId: "e1", asOf: "2026-04-01", leaveRequests: [],
    ledgerEntries: [
      { employeeId: "e1", entryType: "cash_payment", daysDelta: 0, amountNio: 1000, effectiveDate: "2026-02-01" },
      { employeeId: "e1", entryType: "enjoyed", daysDelta: -2, effectiveDate: "2026-03-01" },
      { employeeId: "e1", entryType: "cash_settlement", daysDelta: -1, amountNio: 500, effectiveDate: "2026-03-20" },
      { employeeId: "e1", entryType: "enjoyed", daysDelta: -5, effectiveDate: "2026-05-01" }
    ]
  });
  assert.deepEqual(result, { accruedDays: 7.5, usedDays: 3, balanceDays: 4.5 });
});

test("product price recommendation protects target margin after gross-profit commission and fees", () => {
  const result = calculateProductPricing({ unitCostUsd: 100, targetMarginPercent: 35, commissionRatePercent: 3 });
  assert.equal(result.suggestedPriceUsd, 156.45);
  assert.equal(result.estimatedNetMarginPercent, 35);
  assert.throws(() => calculateProductPricing({ unitCostUsd: 100, targetMarginPercent: 80, commissionRatePercent: 25 }), RangeError);
});
