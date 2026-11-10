import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinancialTrendSeries,
  buildTopSellingProducts,
  buildExpenseCategorySeries,
  buildInventoryCategorySeries
} from "../assets/js/analytics-charts.mjs";

test("financial trends group daily totals and preserve revenue, cost and expenses", () => {
  const period = {
    valid: true,
    start: new Date(2026, 10, 1),
    end: new Date(2026, 10, 2, 23, 59, 59, 999)
  };
  const result = buildFinancialTrendSeries([
    { createdAt: "2026-11-01T10:00:00", totalUsd: 125, items: [{ quantity: 2, unitCostUsd: 20 }] },
    { createdAt: "2026-11-02T12:00:00", totalUsd: 80, items: [{ quantity: 1, unitCostUsd: 30 }] }
  ], [
    { createdAt: "2026-11-01T15:00:00", amountUsd: 10 },
    { createdAt: "2026-11-02T15:00:00", amountUsd: 5 }
  ], period, new Date(2026, 10, 2));

  assert.equal(result.granularity, "day");
  assert.equal(result.buckets.length, 2);
  assert.deepEqual(result.buckets.map(({ revenue, costOfSales, expenses, invoiceCount }) => ({ revenue, costOfSales, expenses, invoiceCount })), [
    { revenue: 125, costOfSales: 40, expenses: 10, invoiceCount: 1 },
    { revenue: 80, costOfSales: 30, expenses: 5, invoiceCount: 1 }
  ]);
});

test("financial trends use weekly buckets for a 90-day report", () => {
  const period = { valid: true, start: new Date(2026, 7, 1), end: new Date(2026, 9, 29, 23, 59, 59, 999) };
  const result = buildFinancialTrendSeries([
    { createdAt: "2026-08-03T09:00:00", totalUsd: 50, items: [] },
    { createdAt: "2026-08-05T09:00:00", totalUsd: 30, items: [] }
  ], [], period, new Date(2026, 9, 29));
  assert.equal(result.granularity, "week");
  assert.equal(result.buckets.reduce((sum, bucket) => sum + bucket.revenue, 0), 80);
  assert.ok(result.buckets.length >= 12);
});

test("all-history financial chart is limited to the latest six months", () => {
  const result = buildFinancialTrendSeries([
    { createdAt: "2025-01-01T09:00:00", totalUsd: 500, items: [] },
    { createdAt: "2026-10-10T09:00:00", totalUsd: 25, items: [] }
  ], [], { valid: true, start: null, end: null }, new Date(2026, 10, 10));
  assert.equal(result.granularity, "month");
  assert.equal(result.buckets.length, 6);
  assert.equal(result.buckets.reduce((sum, bucket) => sum + bucket.revenue, 0), 25);
});

test("top products aggregate quantities and sales by product identity", () => {
  const result = buildTopSellingProducts([
    { items: [{ productId: "p1", name: "Rose", quantity: 2, unitPriceUsd: 25 }, { productId: "p2", name: "Amber", quantity: 1, unitPriceUsd: 30 }] },
    { items: [{ productId: "p1", name: "Rose", quantity: 3, unitPriceUsd: 24 }] }
  ], 2);
  assert.deepEqual(result, [
    { key: "p1", name: "Rose", quantity: 5, salesUsd: 122 },
    { key: "p2", name: "Amber", quantity: 1, salesUsd: 30 }
  ]);
});

test("expense category totals are sorted and negative values do not inflate expenses", () => {
  const result = buildExpenseCategorySeries([
    { category: "Alquiler", amountUsd: 120 },
    { category: "Servicios", amountUsd: 35 },
    { category: "Alquiler", amountUsd: 30 },
    { category: "Sin categoría", amountUsd: -5 }
  ]);
  assert.deepEqual(result, [
    { label: "Alquiler", amountUsd: 150 },
    { label: "Servicios", amountUsd: 35 }
  ]);
});

test("inventory categories calculate current active stock value only", () => {
  const result = buildInventoryCategorySeries([
    { category: "Orientales", stock: 3, unitCost: 20, active: true },
    { category: "Orientales", stock: 2, unitCost: 30, active: true },
    { category: "Florales", stock: 10, unitCost: 5, active: true },
    { category: "Inactivo", stock: 100, unitCost: 20, active: false }
  ]);
  assert.deepEqual(result, [
    { label: "Orientales", valueUsd: 120, units: 5, references: 2 },
    { label: "Florales", valueUsd: 50, units: 10, references: 1 }
  ]);
});

test("chart helpers return empty output safely when there are no business records", () => {
  assert.deepEqual(buildFinancialTrendSeries([], [], { valid: true, start: null, end: null }, new Date(2026, 10, 10)).buckets.map(b => b.revenue), [0,0,0,0,0,0]);
  assert.deepEqual(buildTopSellingProducts(null), []);
  assert.deepEqual(buildExpenseCategorySeries(undefined), []);
  assert.deepEqual(buildInventoryCategorySeries([]), []);
});
