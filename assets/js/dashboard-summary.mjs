const roundCurrency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const CANCELLED = new Set(["anulada","anulado","cancelada","cancelado","void"]);

export function buildProcurementStatusSeries(purchaseOrders) {
  const definitions = [
    ["Borrador","Borradores"],
    ["Enviada","Enviadas"],
    ["Confirmada","Confirmadas"],
    ["Recepción parcial","Recepción parcial"],
    ["Recibida","Recibidas"],
    ["Cancelada","Canceladas"]
  ];
  const buckets = new Map(definitions.map(([key,label]) => [key,{label,count:0}]));
  let others = 0;
  for (const order of Array.isArray(purchaseOrders) ? purchaseOrders : []) {
    const status = String(order?.status || "").trim();
    if (!status) continue;
    const bucket = buckets.get(status);
    if (bucket) bucket.count += 1;
    else others += 1;
  }
  const result = definitions.map(([key]) => buckets.get(key)).filter(item => item.count > 0);
  if (others) result.push({label:"Otros",count:others});
  return result;
}

export function buildSupplierSpendSeries(purchases, limit = 5) {
  const totals = new Map();
  for (const purchase of Array.isArray(purchases) ? purchases : []) {
    if (!purchase || CANCELLED.has(String(purchase.status || "").trim().toLowerCase())) continue;
    const name = String(purchase.supplier || purchase.supplierName || "Proveedor sin nombre").trim();
    const id = String(purchase.supplierId || "").trim();
    const key = id ? "id:" + id : "name:" + name.toLocaleLowerCase("es");
    const amountUsd = Math.max(0,Number(purchase.totalUsd || 0));
    if (!Number.isFinite(amountUsd)) continue;
    const current = totals.get(key) || {key,name,amountUsd:0,purchaseCount:0};
    current.amountUsd = roundCurrency(current.amountUsd + amountUsd);
    current.purchaseCount += 1;
    totals.set(key,current);
  }
  const max = Number.isFinite(Number(limit)) ? Math.max(0,Math.floor(Number(limit))) : 5;
  return [...totals.values()].sort((a,b)=>b.amountUsd-a.amountUsd || a.name.localeCompare(b.name,"es")).slice(0,max);
}

export function buildCustomerRevenueSeries(invoices, limit = 5) {
  const totals = new Map();
  for (const invoice of Array.isArray(invoices) ? invoices : []) {
    if (!invoice || CANCELLED.has(String(invoice.status || "").trim().toLowerCase())) continue;
    const name = String(invoice.customer || invoice.customerName || "Cliente sin nombre").trim();
    const id = String(invoice.customerId || "").trim();
    const key = id ? "id:" + id : "name:" + name.toLocaleLowerCase("es");
    const revenueUsd = Math.max(0,Number(invoice.totalUsd || 0));
    if (!Number.isFinite(revenueUsd)) continue;
    const current = totals.get(key) || {key,name,revenueUsd:0,invoiceCount:0};
    current.revenueUsd = roundCurrency(current.revenueUsd + revenueUsd);
    current.invoiceCount += 1;
    totals.set(key,current);
  }
  const max = Number.isFinite(Number(limit)) ? Math.max(0,Math.floor(Number(limit))) : 5;
  return [...totals.values()].sort((a,b)=>b.revenueUsd-a.revenueUsd || a.name.localeCompare(b.name,"es")).slice(0,max);
}

export function buildCashFlowTrendSeries(entries, now = new Date()) {
  const reference = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(reference.getTime())) throw new TypeError("A valid reference date is required.");
  const first = new Date(reference.getFullYear(),reference.getMonth()-5,1);
  const buckets = [];
  const index = new Map();
  for (let offset=0;offset<6;offset++) {
    const date = new Date(first.getFullYear(),first.getMonth()+offset,1);
    const key = date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
    const bucket = {key,label:date.toLocaleDateString("es-NI",{month:"short"}),income:0,outflow:0};
    buckets.push(bucket);
    index.set(key,bucket);
  }
  for (const entry of Array.isArray(entries) ? entries : []) {
    const date = new Date(entry?.createdAt || "");
    if (Number.isNaN(date.getTime())) continue;
    const key = date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
    const bucket = index.get(key);
    if (!bucket) continue;
    const amount = Math.max(0,Number(entry.amountUsd || 0));
    if (!Number.isFinite(amount)) continue;
    if (String(entry.direction || "").toLowerCase() === "income") bucket.income += amount;
    else bucket.outflow += amount;
  }
  return {
    buckets:buckets.map(bucket=>({...bucket,income:roundCurrency(bucket.income),outflow:roundCurrency(bucket.outflow)}))
  };
}
