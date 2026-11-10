import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProcurementStatusSeries,
  buildSupplierSpendSeries,
  buildCustomerRevenueSeries,
  buildCashFlowTrendSeries
} from "../assets/js/dashboard-summary.mjs";

test("purchase orders are grouped by their real workflow status", () => {
  assert.deepEqual(buildProcurementStatusSeries([
    {status:"Borrador"},{status:"Enviada"},{status:"Enviada"},
    {status:"Confirmada"},{status:"Recepción parcial"},{status:"Recibida"},
    {status:"Cancelada"},{status:"Estado futuro"}
  ]),[
    {label:"Borradores",count:1},{label:"Enviadas",count:2},
    {label:"Confirmadas",count:1},{label:"Recepción parcial",count:1},
    {label:"Recibidas",count:1},{label:"Canceladas",count:1},{label:"Otros",count:1}
  ]);
});

test("supplier spending is aggregated by supplier identity and excludes cancelled records", () => {
  assert.deepEqual(buildSupplierSpendSeries([
    {supplierId:"s1",supplier:"Casa A",totalUsd:45,status:"Recibida"},
    {supplierId:"s1",supplier:"Casa A",totalUsd:55,status:"Recibida"},
    {supplierId:"s2",supplier:"Casa B",totalUsd:80,status:"Recibida"},
    {supplierId:"s2",supplier:"Casa B",totalUsd:999,status:"Anulada"}
  ]),[
    {key:"id:s2",name:"Casa B",amountUsd:80,purchaseCount:1},
    {key:"id:s1",name:"Casa A",amountUsd:100,purchaseCount:2}
  ]);
});

test("customer revenue groups invoices by customer and ignores cancelled invoices", () => {
  assert.deepEqual(buildCustomerRevenueSeries([
    {customerId:"c1",customer:"Cliente A",totalUsd:50,status:"Pagada"},
    {customerId:"c1",customer:"Cliente A",totalUsd:25,status:"Pendiente"},
    {customerId:"c2",customer:"Cliente B",totalUsd:100,status:"Anulada"}
  ]),[
    {key:"id:c1",name:"Cliente A",revenueUsd:75,invoiceCount:2}
  ]);
});

test("cash flow groups only the latest six months and separates inflows from outflows", () => {
  const now = new Date(2026,10,10);
  const result = buildCashFlowTrendSeries([
    {createdAt:"2026-06-03T12:00:00",direction:"income",amountUsd:100},
    {createdAt:"2026-06-04T12:00:00",direction:"expense",amountUsd:20},
    {createdAt:"2025-12-31T12:00:00",direction:"income",amountUsd:500},
    {createdAt:"invalid",direction:"income",amountUsd:900}
  ],now);
  assert.equal(result.buckets.length,6);
  assert.deepEqual(result.buckets[0],{key:"2026-06",label:"jun",income:100,outflow:20});
  assert.equal(result.buckets.reduce((sum,item)=>sum+item.income,0),100);
});

test("dashboard aggregations safely handle missing collections and invalid values", () => {
  assert.deepEqual(buildProcurementStatusSeries(null),[]);
  assert.deepEqual(buildSupplierSpendSeries(undefined),[]);
  assert.deepEqual(buildCustomerRevenueSeries(null),[]);
  assert.equal(buildCashFlowTrendSeries([] ,new Date(2026,10,10)).buckets.length,6);
});
