const roundMoneyDefault = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const VOIDED_INVOICE_STATUSES = new Set(["anulada","anulado","cancelada","cancelado","cancelled","canceled","void","voided"]);

export function isVoidedInvoice(invoice) {
  const status = typeof invoice === "string" ? invoice : invoice?.status;
  return VOIDED_INVOICE_STATUSES.has(String(status || "").trim().toLocaleLowerCase("es"));
}

export function getActiveInvoices(invoices) {
  return (Array.isArray(invoices) ? invoices : []).filter(invoice => !isVoidedInvoice(invoice));
}

export function calculateFinancialSnapshot(invoices, expenses, roundMoney = roundMoneyDefault) {
  const activeInvoices = getActiveInvoices(invoices);
  const expenseRows = Array.isArray(expenses) ? expenses : [];
  const revenue = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.totalUsd || 0), 0);
  const productNetSales = activeInvoices.reduce((sum, invoice) => {
    const lineSubtotal = (Array.isArray(invoice.items) ? invoice.items : []).reduce(
      (subtotal, item) => subtotal + Number(item.unitPriceUsd || 0) * Number(item.quantity || 0), 0
    );
    const subtotal = invoice.subtotalUsd == null ? lineSubtotal : Number(invoice.subtotalUsd || 0);
    return sum + Math.max(0, subtotal - Number(invoice.discountUsd || 0));
  }, 0);
  const deliveryIncome = roundMoney(activeInvoices.reduce((sum, invoice) => sum + Number(invoice.deliveryFeeUsd || 0), 0));
  const costOfSales = activeInvoices.reduce((sum, invoice) => (Array.isArray(invoice.items) ? invoice.items : []).reduce(
    (subtotal, item) => subtotal + Number(item.unitCostUsd || 0) * Number(item.quantity || 0), sum
  ), 0);
  const grossProfit = roundMoney(productNetSales - costOfSales);
  const operatingExpenses = roundMoney(expenseRows.reduce((sum, item) => sum + Number(item.amountUsd || 0), 0));
  return {
    revenue: roundMoney(revenue),
    productNetSales: roundMoney(productNetSales),
    deliveryIncome,
    costOfSales: roundMoney(costOfSales),
    grossProfit,
    operatingExpenses,
    netProfit: roundMoney(grossProfit + deliveryIncome - operatingExpenses)
  };
}

export function calculatePayablesSnapshot(legacyPurchases, supplierInvoices, roundMoney = roundMoneyDefault) {
  const legacyPurchasePayables = roundMoney((Array.isArray(legacyPurchases) ? legacyPurchases : []).reduce(
    (sum, purchase) => sum + Math.max(0, Number(purchase.totalUsd || 0) - Number(purchase.paidUsd || 0)), 0
  ));
  const supplierInvoicePayables = roundMoney((Array.isArray(supplierInvoices) ? supplierInvoices : [])
    .filter(invoice => !isVoidedInvoice(invoice))
    .reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amountUsd || 0) - Number(invoice.paidUsd || 0)), 0));
  return {
    legacyPurchasePayables,
    supplierInvoicePayables,
    total: roundMoney(legacyPurchasePayables + supplierInvoicePayables)
  };
}
