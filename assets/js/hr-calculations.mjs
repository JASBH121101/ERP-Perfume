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

export function calculateVacationBalance({ hireDate, leaveRequests = [], employeeId, asOf = new Date() }) {
  const tenure = calculateTenure(hireDate, asOf);
  if (tenure.label === "Fecha de ingreso pendiente") return { accruedDays: 0, usedDays: 0, balanceDays: 0 };
  const accruedDays = Math.max(0, (tenure.years * 12 + tenure.months + tenure.days / 30) * 2.5);
  const end = utcDate(asOf);
  const usedDays = leaveRequests.reduce((total, request) => {
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
