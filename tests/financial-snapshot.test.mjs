import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialSnapshot, calculatePayablesSnapshot, isVoidedInvoice } from "../assets/js/financial-snapshot.mjs";

test("financial snapshot separates product gross profit from delivery income and expenses", () => {
  const invoices = [
    {
      totalUsd: 125,
      subtotalUsd: 110,
      discountUsd: 10,
      deliveryFeeUsd: 25,
      items: [
        { quantity: 2, unitPriceUsd: 40, unitCostUsd: 20 },
        { quantity: 1, unitPriceUsd: 30, unitCostUsd: 15 }
      ]
    }
  ];
  const expenses = [{ amountUsd: 12.5 }, { amountUsd: 2.5 }];

  const result = calculateFinancialSnapshot(invoices, expenses);

  assert.deepEqual(result, {
    revenue: 125,
    productNetSales: 100,
    deliveryIncome: 25,
    costOfSales: 55,
    grossProfit: 45,
    operatingExpenses: 15,
    netProfit: 55
  });
});

test("financial snapshot handles empty ledgers without NaN or negative totals", () => {
  const result = calculateFinancialSnapshot([], []);
  assert.deepEqual(result, {
    revenue: 0,
    productNetSales: 0,
    deliveryIncome: 0,
    costOfSales: 0,
    grossProfit: 0,
    operatingExpenses: 0,
    netProfit: 0
  });
});

test("financial snapshot preserves a negative operating result instead of hiding a loss", () => {
  const invoices = [{
    totalUsd: 20,
    subtotalUsd: 20,
    items: [{ quantity: 1, unitPriceUsd: 20, unitCostUsd: 25 }]
  }];
  const result = calculateFinancialSnapshot(invoices, [{ amountUsd: 3 }]);

  assert.equal(result.grossProfit, -5);
  assert.equal(result.netProfit, -8);
});

test("payables snapshot combines legacy purchases and supplier invoices without counting voided or settled invoices", () => {
  const result=calculatePayablesSnapshot(
    [{totalUsd:100,paidUsd:40}],
    [
      {amountUsd:200,paidUsd:50,status:"Abono parcial"},
      {amountUsd:80,paidUsd:0,status:"Anulada"},
      {amountUsd:25,paidUsd:25,status:"Pagada"}
    ]
  );
  assert.deepEqual(result,{
    legacyPurchasePayables:60,
    supplierInvoicePayables:150,
    total:210
  });
});

test("payables snapshot handles empty ledgers and malformed collection inputs", () => {
  assert.deepEqual(calculatePayablesSnapshot(null,undefined),{
    legacyPurchasePayables:0,
    supplierInvoicePayables:0,
    total:0
  });
});


test("voided invoices never contribute to revenue, delivery, cost, gross profit or net profit", () => {
  const result = calculateFinancialSnapshot([
    {
      status: "Pendiente", totalUsd: 40, subtotalUsd: 35, discountUsd: 5, deliveryFeeUsd: 5,
      items: [{ quantity: 1, unitPriceUsd: 35, unitCostUsd: 20 }]
    },
    {
      status: "Anulada", totalUsd: 900, subtotalUsd: 850, deliveryFeeUsd: 50,
      items: [{ quantity: 10, unitPriceUsd: 85, unitCostUsd: 60 }]
    },
    {
      status: "Cancelled", totalUsd: 500, subtotalUsd: 500, deliveryFeeUsd: 0,
      items: [{ quantity: 10, unitPriceUsd: 50, unitCostUsd: 35 }]
    }
  ], [{ amountUsd: 3 }]);
  assert.deepEqual(result, {
    revenue: 40,
    productNetSales: 30,
    deliveryIncome: 5,
    costOfSales: 20,
    grossProfit: 10,
    operatingExpenses: 3,
    netProfit: 12
  });
});

test("invoice void-state detection handles Spanish status variants and English imports", () => {
  for (const status of ["Anulada","Anulado","Cancelada","Cancelado","Void","Voided"]) {
    assert.equal(isVoidedInvoice({ status }), true, status);
  }
  assert.equal(isVoidedInvoice({ status: "Abono parcial" }), false);
});

test("payables snapshot excludes cancelled supplier invoices in all supported status variants", () => {
  const result = calculatePayablesSnapshot([], [
    { amountUsd: 100, paidUsd: 0, status: "Pendiente" },
    { amountUsd: 900, paidUsd: 0, status: "Cancelada" },
    { amountUsd: 800, paidUsd: 0, status: "Cancelado" },
    { amountUsd: 700, paidUsd: 0, status: "Voided" }
  ]);
  assert.deepEqual(result, {
    legacyPurchasePayables: 0,
    supplierInvoicePayables: 100,
    total: 100
  });
});
