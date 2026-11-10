function validDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (value == null || value === "") return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parts = text.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function bucketStart(date, granularity) {
  if (granularity === "year") return new Date(date.getFullYear(), 0, 1);
  if (granularity === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  if (granularity === "week") {
    const day = dayStart(date);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return day;
  }
  return dayStart(date);
}

function bucketKey(date, granularity) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (granularity === "year") return year;
  if (granularity === "month") return year + "-" + month;
  return year + "-" + month + "-" + day;
}

function bucketLabel(date, granularity) {
  if (granularity === "year") return String(date.getFullYear());
  if (granularity === "month") return new Intl.DateTimeFormat("es-NI", { month: "short", year: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "short" }).format(date);
}

function advanceBucket(date, granularity) {
  const next = new Date(date);
  if (granularity === "year") next.setFullYear(next.getFullYear() + 1);
  else if (granularity === "month") next.setMonth(next.getMonth() + 1);
  else if (granularity === "week") next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  return next;
}

export function buildFinancialTrendSeries(invoices = [], expenses = [], period = null, now = new Date()) {
  if (period?.valid === false) return { granularity: "day", buckets: [] };
  const today = dayStart(now);
  let start = period?.start ? dayStart(validDate(period.start) || today) : new Date(today.getFullYear(), today.getMonth() - 5, 1);
  let end = period?.end ? dayStart(validDate(period.end) || today) : today;
  if (start > end) return { granularity: "day", buckets: [] };
  const durationDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const granularity = durationDays <= 45 ? "day" : durationDays <= 180 ? "week" : durationDays > 730 ? "year" : "month";
  const buckets = [];
  let cursor = bucketStart(start, granularity);
  while (cursor <= end && buckets.length < 120) {
    buckets.push({
      key: bucketKey(cursor, granularity),
      label: bucketLabel(cursor, granularity),
      revenue: 0,
      costOfSales: 0,
      expenses: 0,
      invoiceCount: 0
    });
    cursor = advanceBucket(cursor, granularity);
  }
  const indexes = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  const addToBucket = (dateValue, field, amount) => {
    const date = validDate(dateValue);
    if (!date || date < start || date > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)) return;
    const key = bucketKey(bucketStart(date, granularity), granularity);
    const index = indexes.get(key);
    if (index == null) return;
    buckets[index][field] += Number.isFinite(Number(amount)) ? Number(amount) : 0;
  };
  for (const invoice of Array.isArray(invoices) ? invoices : []) {
    const date = invoice?.createdAt ?? invoice?.invoiceDate ?? invoice?.date;
    const valid = validDate(date);
    if (!valid || valid < start || valid > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)) continue;
    addToBucket(date, "revenue", Number(invoice.totalUsd || 0));
    const cost = (Array.isArray(invoice.items) ? invoice.items : []).reduce(
      (sum, item) => sum + Number(item.unitCostUsd || 0) * Number(item.quantity || 0), 0
    );
    addToBucket(date, "costOfSales", cost);
    const index = indexes.get(bucketKey(bucketStart(valid, granularity), granularity));
    if (index != null) buckets[index].invoiceCount += 1;
  }
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    addToBucket(expense?.createdAt ?? expense?.expenseDate ?? expense?.date, "expenses", Number(expense?.amountUsd || 0));
  }
  return {
    granularity,
    buckets: buckets.map(bucket => ({
      ...bucket,
      revenue: Math.round(bucket.revenue * 100) / 100,
      costOfSales: Math.round(bucket.costOfSales * 100) / 100,
      expenses: Math.round(bucket.expenses * 100) / 100
    }))
  };
}

export function buildTopSellingProducts(invoices = [], limit = 5) {
  const totals = new Map();
  for (const invoice of Array.isArray(invoices) ? invoices : []) {
    for (const item of Array.isArray(invoice?.items) ? invoice.items : []) {
      const name = String(item?.name || "Producto sin nombre").trim();
      const key = String(item?.productId || item?.sku || name);
      const current = totals.get(key) || { key, name, quantity: 0, salesUsd: 0 };
      const quantity = Number(item?.quantity || 0);
      current.quantity += Number.isFinite(quantity) ? quantity : 0;
      current.salesUsd += quantity * Number(item?.unitPriceUsd || 0);
      totals.set(key, current);
    }
  }
  return [...totals.values()]
    .filter(item => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.salesUsd - a.salesUsd || a.name.localeCompare(b.name, "es"))
    .slice(0, Math.max(1, Number(limit) || 5))
    .map(item => ({ ...item, salesUsd: Math.round(item.salesUsd * 100) / 100 }));
}

export function buildExpenseCategorySeries(expenses = [], limit = 6) {
  const totals = new Map();
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    const label = String(expense?.category || "Sin categoría").trim() || "Sin categoría";
    totals.set(label, (totals.get(label) || 0) + Number(expense?.amountUsd || 0));
  }
  return [...totals.entries()]
    .map(([label, amountUsd]) => ({ label, amountUsd: Math.round(amountUsd * 100) / 100 }))
    .filter(item => item.amountUsd > 0)
    .sort((a, b) => b.amountUsd - a.amountUsd || a.label.localeCompare(b.label, "es"))
    .slice(0, Math.max(1, Number(limit) || 6));
}

export function buildInventoryCategorySeries(products = [], limit = 6) {
  const totals = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    if (product?.active === false) continue;
    const label = String(product?.category || "Sin categoría").trim() || "Sin categoría";
    const stock = Math.max(0, Number(product?.stock || 0));
    const unitCost = Math.max(0, Number(product?.unitCost || 0));
    const current = totals.get(label) || { label, valueUsd: 0, units: 0, references: 0 };
    current.valueUsd += stock * unitCost;
    current.units += stock;
    current.references += 1;
    totals.set(label, current);
  }
  return [...totals.values()]
    .map(item => ({ ...item, valueUsd: Math.round(item.valueUsd * 100) / 100 }))
    .filter(item => item.valueUsd > 0 || item.units > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd || a.label.localeCompare(b.label, "es"))
    .slice(0, Math.max(1, Number(limit) || 6));
}
