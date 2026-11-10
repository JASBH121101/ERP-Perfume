import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTenure, calculateVacationBalance, calculateAguinaldoEstimate,
  calculateInss, calculateCommission, convertCommissionForPayroll,
  calculateAnnualLaborIR, calculateLaborIR, calculateInatec, calculateEmployerLaborCost
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


test("paid vacation settlement reduces the live balance without double-counting a linked leave request",()=>{
 const r=calculateVacationBalance({hireDate:"2026-01-01",employeeId:"e1",asOf:"2026-07-01",
 leaveRequests:[{id:"leave-1",employeeId:"e1",leaveType:"Vacaciones",status:"Aprobado",days:5,endDate:"2026-06-10"}],
 settlements:[
 {employeeId:"e1",leaveRequestId:"leave-1",settlementType:"Disfrute",status:"Pagada",days:5},
 {employeeId:"e1",settlementType:"Compensacion",status:"Pendiente",days:2},
 {employeeId:"e1",settlementType:"Compensacion",status:"Pagada",days:1}
 ]});
 assert.equal(r.accruedDays,15); assert.equal(r.usedDays,1);
 assert.equal(r.compensatedDays,1); assert.equal(r.balanceDays,13);
});
test("Nicaragua progressive annual labor IR uses marginal bands",()=>{
 assert.equal(calculateAnnualLaborIR(100000).annualTaxNio,0);
 assert.equal(calculateAnnualLaborIR(150000).annualTaxNio,7500);
 assert.equal(calculateAnnualLaborIR(250000).annualTaxNio,25000);
 const r=calculateLaborIR({monthlyGrossNio:15000,monthlyEmployeeInssNio:1050,monthsRemaining:12});
 assert.equal(r.projectedAnnualNetIncomeNio,167400); assert.equal(r.annualTaxNio,10110);
 assert.equal(r.monthlyWithholdingNio,842.5);
});
test("INATEC and employer labor cost separate employer contributions from employee deductions",()=>{
 assert.deepEqual(calculateInatec({baseSalaryNio:10000,employerRate:2}),{contributionBaseNio:10000,employerInatecNio:200});
 const r=calculateEmployerLaborCost({baseSalaryNio:10000,employerInssRate:21.5,inatecRate:2});
 assert.equal(r.employerInssNio,2150); assert.equal(r.employerInatecNio,200);
 assert.equal(r.vacationProvisionNio,833.33); assert.equal(r.aguinaldoProvisionNio,833.33);
 assert.equal(r.totalEmployerCostNio,14016.66);
});
test("invalid INATEC rates are rejected",()=>assert.throws(()=>calculateInatec({baseSalaryNio:10000,employerRate:101}),RangeError));
