const DAY_MS = 86400000;

function utcDate(value) {
  if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonthsClamped(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const first = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay)));
}

function plural(value, singular, pluralForm = singular + "s") {
  return value + " " + (value === 1 ? singular : pluralForm);
}

export function calculateTenure(hireDate, asOf = new Date()) {
  const start = utcDate(hireDate);
  const end = utcDate(asOf);
  if (!start || !end || start > end) return { years: 0, months: 0, days: 0, totalDays: 0, label: "Fecha de ingreso pendiente" };

  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let anchor = addMonthsClamped(start, years * 12);
  if (anchor > end) {
    years -= 1;
    anchor = addMonthsClamped(start, years * 12);
  }
  let months = (end.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + end.getUTCMonth() - anchor.getUTCMonth();
  let monthAnchor = addMonthsClamped(anchor, months);
  if (monthAnchor > end) {
    months -= 1;
    monthAnchor = addMonthsClamped(anchor, months);
  }
  const days = Math.floor((end.getTime() - monthAnchor.getTime()) / DAY_MS);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS);
  const parts = [];
  if (years) parts.push(plural(years, "año", "años"));
  if (months) parts.push(plural(months, "mes", "meses"));
  if (days || parts.length === 0) parts.push(plural(days, "día", "días"));
  return { years, months, days, totalDays, label: parts.join(", ") };
}

export function calculateVacationBalance({ hireDate, leaveRequests = [], ledgerEntries, employeeId, asOf = new Date() }) {
  const tenure = calculateTenure(hireDate, asOf);
  if (tenure.label === "Fecha de ingreso pendiente") return { accruedDays: 0, usedDays: 0, balanceDays: 0 };
  const accruedDays = Math.max(0, (tenure.years * 12 + tenure.months + tenure.days / 30) * 2.5);
  const end = utcDate(asOf);
  const usedDays = Array.isArray(ledgerEntries)
    ? Math.max(0, -ledgerEntries.reduce((total, entry) => {
        if (String(entry.employeeId ?? entry.employee_id) !== String(employeeId)) return total;
        const effectiveDate = utcDate(entry.effectiveDate ?? entry.effective_date);
        if (!effectiveDate || effectiveDate > end) return total;
        return total + Number(entry.daysDelta ?? entry.days_delta ?? 0);
      }, 0))
    : leaveRequests.reduce((total, request) => {
        if (String(request.employeeId ?? request.employee_id) !== String(employeeId) ||
            request.status !== "Aprobado" ||
            !["Vacaciones", "Vacation"].includes(request.leaveType ?? request.leave_type)) return total;
        const leaveEnd = utcDate(request.endDate ?? request.end_date);
        if (!leaveEnd || leaveEnd > end) return total;
        return total + Math.max(0, Number(request.days || 0));
      }, 0);
  return {
    accruedDays: Number(accruedDays.toFixed(2)),
    usedDays: Number(usedDays.toFixed(2)),
    balanceDays: Number(Math.max(0, accruedDays - usedDays).toFixed(2))
  };
}

export function calculateAguinaldoEstimate({
  hireDate, salaryNio = 0, commissionEnabled = false, monthlyOrdinarySalaries = [], asOf = new Date()
}) {
  const start = utcDate(hireDate);
  const end = utcDate(asOf);
  if (!start || !end || start > end) return { amountNio: 0, monthlyBasisNio: 0, cycleStart: null, cycleEnd: null, eligibleDays: 0, cycleDays: 0 };

  const year = end.getUTCMonth() === 11 && end.getUTCDate() > 10 ? end.getUTCFullYear() : end.getUTCFullYear() - 1;
  const cycleStart = new Date(Date.UTC(year, 11, 1));
  const cycleEnd = new Date(Date.UTC(year + 1, 10, 30));
  const eligibleStart = start > cycleStart ? start : cycleStart;
  const eligibleEnd = end < cycleEnd ? end : cycleEnd;
  const eligibleDays = Math.max(0, Math.floor((eligibleEnd.getTime() - eligibleStart.getTime()) / DAY_MS) + 1);
  const serviceMonthCompleted = addMonthsClamped(start, 1) <= end;
  const cycleDays = Math.floor((cycleEnd.getTime() - cycleStart.getTime()) / DAY_MS) + 1;
  const priorSixMonths = monthlyOrdinarySalaries
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0);
  const monthlyBasisNio = commissionEnabled && priorSixMonths.length
    ? Math.max(...priorSixMonths)
    : Math.max(0, Number(salaryNio) || 0);
  const amountNio = serviceMonthCompleted ? Math.round(monthlyBasisNio * eligibleDays / cycleDays * 100) / 100 : 0;
  return { amountNio, monthlyBasisNio, cycleStart: cycleStart.toISOString().slice(0, 10), cycleEnd: cycleEnd.toISOString().slice(0, 10), eligibleDays, cycleDays };
}

export function calculateInss({
  baseSalaryNio = 0, bonusesNio = 0, commissionsNio = 0,
  employeeRate = 7, employerRate = 21.5
}) {
  const contributionBase = Math.max(0, Number(baseSalaryNio) + Number(bonusesNio) + Number(commissionsNio));
  const employeeInssNio = Math.round(contributionBase * Number(employeeRate) / 100 * 100) / 100;
  const employerInssNio = Math.round(contributionBase * Number(employerRate) / 100 * 100) / 100;
  return { contributionBaseNio: Number(contributionBase.toFixed(2)), employeeInssNio, employerInssNio };
}

export function calculateCommission({
  lineTotalUsd = 0, unitCostUsd = 0, quantity = 1,
  discountShareUsd = 0, ratePercent = 0, exchangeRate = 1
}) {
  const grossSaleUsd = Math.max(0, Number(lineTotalUsd) || 0);
  const quantityValue = Math.max(0, Number(quantity) || 0);
  const netSaleUsd = Math.max(0, grossSaleUsd - Math.max(0, Number(discountShareUsd) || 0));
  const costUsd = Math.max(0, Number(unitCostUsd) || 0) * quantityValue;
  const grossProfitUsd = Math.max(0, netSaleUsd - costUsd);
  const commissionUsd = Math.round(grossProfitUsd * Math.max(0, Number(ratePercent) || 0) / 100 * 100) / 100;
  const rate = Number(exchangeRate);
  const commissionNio = Number.isFinite(rate) && rate > 0
    ? Math.round(commissionUsd * rate * 100) / 100
    : 0;
  return {
    grossSaleUsd: Number(grossSaleUsd.toFixed(2)),
    netSaleUsd: Number(netSaleUsd.toFixed(2)),
    costUsd: Number(costUsd.toFixed(2)),
    grossProfitUsd: Number(grossProfitUsd.toFixed(2)),
    commissionUsd,
    commissionNio
  };
}

export function convertCommissionForPayroll(commissionUsd, exchangeRate) {
  const usd = Number(commissionUsd);
  const rate = Number(exchangeRate);
  if (!Number.isFinite(usd) || usd < 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new RangeError("La comisión USD y la tasa de nómina deben ser valores válidos.");
  }
  return {
    commissionUsd: Number(usd.toFixed(2)),
    exchangeRate: Number(rate.toFixed(4)),
    commissionNio: Math.round(usd * rate * 100) / 100
  };
}


export const DEFAULT_IR_BRACKETS = Object.freeze([
  Object.freeze({ upper: 100000, base: 0, rate: 0, excess: 0 }),
  Object.freeze({ upper: 200000, base: 0, rate: 15, excess: 100000 }),
  Object.freeze({ upper: 350000, base: 15000, rate: 20, excess: 200000 }),
  Object.freeze({ upper: 500000, base: 45000, rate: 25, excess: 350000 }),
  Object.freeze({ upper: null, base: 82500, rate: 30, excess: 500000 })
]);

const PERIODS_PER_YEAR = Object.freeze({ monthly: 12, biweekly: 24, weekly: 52 });

export function calculateAnnualIncomeTax(annualTaxableIncomeNio, brackets = DEFAULT_IR_BRACKETS) {
  const income = Number(annualTaxableIncomeNio);
  if (!Number.isFinite(income) || income < 0 || !Array.isArray(brackets) || brackets.length === 0) {
    throw new RangeError("La renta anual y la tabla de IR deben ser válidas.");
  }
  const ordered = [...brackets].sort((a, b) => {
    const upperA = a.upper == null ? Infinity : Number(a.upper);
    const upperB = b.upper == null ? Infinity : Number(b.upper);
    return upperA - upperB;
  });
  const bracket = ordered.find(item => item.upper == null || income <= Number(item.upper));
  if (!bracket) throw new RangeError("La tabla de IR no cubre la renta anual.");
  const base = Number(bracket.base), rate = Number(bracket.rate), excess = Number(bracket.excess);
  if (![base, rate, excess].every(Number.isFinite) || rate < 0 || rate > 100 || income < excess) {
    throw new RangeError("La tabla de IR contiene un tramo inválido.");
  }
  return Number((base + Math.max(0, income - excess) * rate / 100).toFixed(2));
}

export function calculatePayrollWithholding({
  baseSalaryNio = 0, bonusesNio = 0, commissionsNio = 0, employeeInssNio = 0,
  frequency = "monthly", previousPeriods = [], inatecRate = 2, brackets = DEFAULT_IR_BRACKETS,
  periodType = "Ordinaria"
}) {
  const amounts = [baseSalaryNio, bonusesNio, commissionsNio, employeeInssNio, inatecRate].map(Number);
  if (!amounts.every(Number.isFinite) || amounts.some(value => value < 0) ||
      !Object.prototype.hasOwnProperty.call(PERIODS_PER_YEAR, frequency)) {
    throw new RangeError("Los importes, la frecuencia y la tasa INATEC deben ser válidos.");
  }
  const gross = amounts[0] + amounts[1] + amounts[2];
  const taxable = Math.max(0, gross - amounts[3]);
  if (periodType === "Aguinaldo") {
    return { taxableIncomeNio: 0, annualizedIncomeNio: 0, annualTaxNio: 0, irWithheldNio: 0, inatecEmployerNio: 0 };
  }
  const history = previousPeriods.map(item => ({
    taxable: Number(item.taxableIncomeNio ?? item.taxable_income_nio ?? 0),
    withheld: Number(item.irWithheldNio ?? item.ir_withheld_nio ?? 0)
  }));
  if (history.some(item => !Number.isFinite(item.taxable) || item.taxable < 0 || !Number.isFinite(item.withheld) || item.withheld < 0)) {
    throw new RangeError("El historial de retenciones contiene importes inválidos.");
  }
  const periodsPerYear = PERIODS_PER_YEAR[frequency], periodCount = history.length + 1;
  const averageTaxablePerPeriod = (history.reduce((sum, item) => sum + item.taxable, 0) + taxable) / periodCount;
  const annualizedIncome = averageTaxablePerPeriod * periodsPerYear;
  const annualTax = calculateAnnualIncomeTax(annualizedIncome, brackets);
  const cumulativeTaxDue = annualTax * periodCount / periodsPerYear;
  const priorWithheld = history.reduce((sum, item) => sum + item.withheld, 0);
  return {
    taxableIncomeNio: Number(taxable.toFixed(2)),
    annualizedIncomeNio: Number(annualizedIncome.toFixed(2)),
    annualTaxNio: annualTax,
    irWithheldNio: Number(Math.max(0, cumulativeTaxDue - priorWithheld).toFixed(2)),
    inatecEmployerNio: Number((gross * amounts[4] / 100).toFixed(2))
  };
}

export function calculateProductPricing({
  unitCostUsd = 0, targetMarginPercent = 35, commissionRatePercent = 3,
  commissionBasis = "gross_profit", paymentFeePercent = 0, otherVariableCostPercent = 0
}) {
  const values = [unitCostUsd, targetMarginPercent, commissionRatePercent, paymentFeePercent, otherVariableCostPercent].map(Number);
  if (!values.every(Number.isFinite) || values[0] < 0 ||
      values.slice(1).some(value => value < 0 || value > 100) ||
      !["gross_profit", "sales"].includes(commissionBasis)) {
    throw new RangeError("Los costos y porcentajes de precio deben ser válidos.");
  }
  const [cost, marginPct, commissionPct, paymentPct, otherPct] = values;
  const commission = commissionPct / 100, denominator = 1 - marginPct / 100 - commission - paymentPct / 100 - otherPct / 100;
  const numerator = commissionBasis === "gross_profit" ? cost * (1 - commission) : cost;
  if (denominator <= 0) throw new RangeError("Los porcentajes no dejan espacio para cubrir el costo y el margen objetivo.");
  const suggestedPriceUsd = Number((numerator / denominator).toFixed(2));
  const grossProfitUsd = Number((suggestedPriceUsd - cost).toFixed(2));
  const commissionUsd = commissionBasis === "gross_profit"
    ? Number((grossProfitUsd * commission).toFixed(2))
    : Number((suggestedPriceUsd * commission).toFixed(2));
  const paymentFeesUsd = Number((suggestedPriceUsd * paymentPct / 100).toFixed(2));
  const otherVariableCostsUsd = Number((suggestedPriceUsd * otherPct / 100).toFixed(2));
  const netProfitUsd = Number((grossProfitUsd - commissionUsd - paymentFeesUsd - otherVariableCostsUsd).toFixed(2));
  return {
    suggestedPriceUsd, grossProfitUsd, commissionUsd, paymentFeesUsd, otherVariableCostsUsd,
    netProfitUsd, estimatedNetMarginPercent: suggestedPriceUsd > 0 ? Number((netProfitUsd / suggestedPriceUsd * 100).toFixed(2)) : 0
  };
}
