import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAnyModuleAccess,
  hasPermission,
  loadUserPermissions
} from "../worker/src/permissions.js";
import { canApprovePurchaseOrder, resolveRoutePermission } from "../worker/src/erp.js";

test("a permission is denied when its section or module parent is denied", () => {
  const context = {
    owner: false,
    permissions: [
      { key: "hr.view", parentKey: null, allowed: true },
      { key: "hr.employees.view", parentKey: "hr.view", allowed: false },
      { key: "hr.employees.create", parentKey: "hr.employees.view", allowed: true }
    ]
  };
  assert.equal(hasPermission(context, "hr.employees.create"), false);
});

test("an action requires its own grant and every ancestor grant", () => {
  const context = {
    owner: false,
    permissions: [
      { key: "inventory.view", parentKey: null, allowed: true },
      { key: "inventory.receipts.view", parentKey: "inventory.view", allowed: true },
      { key: "inventory.receipts.receive", parentKey: "inventory.receipts.view", allowed: false }
    ]
  };
  assert.equal(hasPermission(context, "inventory.receipts.view"), true);
  assert.equal(hasPermission(context, "inventory.receipts.receive"), false);
});

test("user overrides can explicitly deny a role-template permission", async () => {
  let receivedArgs;
  const sql = {
    async query(_query, args) {
      receivedArgs = args;
      return [
        { permission_key: "products.view", parent_key: null, allowed: true },
        { permission_key: "products.catalog.view", parent_key: "products.view", allowed: false },
        { permission_key: "products.catalog.create", parent_key: "products.catalog.view", allowed: true }
      ];
    }
  };
  const context = await loadUserPermissions(sql, {
    id: "00000000-0000-0000-0000-000000000001",
    role: "viewer",
    role_template_key: "custom-inventory"
  });
  assert.deepEqual(receivedArgs, ["custom-inventory", "00000000-0000-0000-0000-000000000001"]);
  assert.equal(hasPermission(context, "products.catalog.create"), false);
});

test("the owner bypass is explicit and cannot be inferred from a role template", () => {
  assert.equal(hasPermission({ owner: true, permissions: [] }, "users.devices.manage"), true);
  assert.equal(hasPermission({
    owner: false,
    permissions: [{ key: "users.devices.manage", parentKey: "users.devices.view", allowed: true }]
  }, "users.devices.manage"), false);
});

test("bootstrap access requires dashboard or at least one permitted module", () => {
  assert.equal(hasAnyModuleAccess({ owner: false, permissions: [
    { key: "dashboard.view", parentKey: null, allowed: true }
  ] }), false);
  assert.equal(hasAnyModuleAccess({ owner: false, permissions: [
    { key: "hr.view", parentKey: null, allowed: true }
  ] }), true);
});

test("API route permissions separate manual stock out from receipts", () => {
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "", [], { movement_type: "Salida" }),
    "inventory.manual_out.create");
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "", [], { movement_type: "Entrada" }),
    "inventory.receipts.receive");
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "", [], { movement_type: "Ajuste" }),
    "inventory.adjustments.adjust");
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "", [], { movement_type: "Reversion" }), null);
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "", [], {}), null);
});

test("dedicated business routes map to their own permissions", () => {
  assert.equal(resolveRoutePermission("invoices", "POST", "", [], {}),
    "billing.invoices.create");
  assert.equal(resolveRoutePermission("invoice-payments", "POST", "", [], {}),
    "billing.payments.create");
  assert.equal(resolveRoutePermission("hr-leave-requests", "PATCH", "42", [], { status: "Aprobada" }),
    "hr.leave.approve");
  assert.equal(resolveRoutePermission("settings", "PATCH", "", [], {}),
    "settings.general.manage");
});

test("DGI documents and support files require effective DGI permissions, including the module parent", () => {
  const deniedContext = {
    owner: false,
    permissions: [
      { key: "dashboard.view", parentKey: null, allowed: true },
      { key: "dgi.view", parentKey: null, allowed: false },
      { key: "dgi.documents.view", parentKey: "dgi.view", allowed: true },
      { key: "dgi.documents.manage", parentKey: "dgi.documents.view", allowed: true }
    ]
  };
  const allowedContext = {
    owner: false,
    permissions: [
      { key: "dgi.view", parentKey: null, allowed: true },
      { key: "dgi.documents.view", parentKey: "dgi.view", allowed: true },
      { key: "dgi.documents.manage", parentKey: "dgi.documents.view", allowed: true }
    ]
  };

  assert.equal(resolveRoutePermission("dgi-support-documents", "GET", "", [], null), "dgi.documents.view");
  assert.equal(resolveRoutePermission("dgi-support-documents", "POST", "", [], {}), "dgi.documents.manage");
  assert.equal(hasPermission(deniedContext, "dgi.documents.view"), false);
  assert.equal(hasPermission(deniedContext, "dgi.documents.manage"), false);
  assert.equal(hasPermission(allowedContext, "dgi.documents.view"), true);
  assert.equal(hasPermission(allowedContext, "dgi.documents.manage"), true);
});

test("owner-only management routes resolve to dedicated granular permissions", () => {
  assert.equal(resolveRoutePermission("users", "GET", "", [], null), "users.accounts.view");
  assert.equal(resolveRoutePermission("users", "POST", "", [], {}), "users.accounts.create");
  assert.equal(resolveRoutePermission("users", "PATCH", "42", [], { account_status: "disabled" }), "users.accounts.disable");
  assert.equal(resolveRoutePermission("users", "PATCH", "42", [], { position_title: "Auxiliar" }), "users.accounts.edit");
  assert.equal(resolveRoutePermission("roles", "GET", "", [], null), "users.roles.view");
  assert.equal(resolveRoutePermission("roles", "POST", "", [], {}), "users.roles.create");
  assert.equal(resolveRoutePermission("roles", "PATCH", "sales", [], {}), "users.roles.edit");
  assert.equal(resolveRoutePermission("permissions", "GET", "", [], null), "users.roles.view");
  assert.equal(resolveRoutePermission("audit", "GET", "", [], null), "audit.history.view");
});

test("unknown routes fail closed", () => {
  assert.equal(resolveRoutePermission("unknown-resource", "GET", "", [], null), null);
});


test("purchase order routes distinguish drafting, submission, approval and cancellation", () => {
  assert.equal(resolveRoutePermission("purchase-orders","POST","",[],{}),"purchases.purchase_orders.create");
  assert.equal(resolveRoutePermission("purchase-orders","PATCH","po-1",[],{status:"Enviada"}),"purchases.purchase_orders.submit");
  assert.equal(resolveRoutePermission("purchase-orders","PATCH","po-1",[],{status:"Confirmada"}),"purchases.approvals.approve");
  assert.equal(resolveRoutePermission("purchase-orders","PATCH","po-1",[],{status:"Cancelada"}),"purchases.purchase_orders.cancel");
  assert.equal(resolveRoutePermission("purchase-orders","PATCH","po-1",[],{status:"Recibida"}),"purchases.purchase_orders.edit");
});

test("purchase order physical receipt route is separated from order creation", () => {
  assert.equal(resolveRoutePermission("purchase-orders","POST","po-1",["api","erp","purchase-orders","po-1","receipts"],{}),
    "purchases.receipts.receive");
});
test("supplier invoice and supplier payment routes require their dedicated permissions", () => {
  assert.equal(resolveRoutePermission("supplier-invoices","POST","",[],{}),
    "purchases.supplier_invoices.create");
  assert.equal(resolveRoutePermission("supplier-invoices","GET","",[],null),
    "purchases.supplier_invoices.view");
  assert.equal(resolveRoutePermission("supplier-invoice-payments","POST","",[],{}),
    "payables.payments.create");
  assert.equal(resolveRoutePermission("supplier-invoice-payments","PATCH","payment-1",[],{}), null);
});


test("manual inventory reversal route requires the dedicated reversal permission", () => {
  assert.equal(
    resolveRoutePermission("inventory-movements", "POST", "00000000-0000-4000-8000-000000000001",
      ["api","erp","inventory-movements","00000000-0000-4000-8000-000000000001","reverse"], {}),
    "inventory.movements.reverse"
  );
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "", [], { movement_type: "Reversion" }), null);
  assert.equal(resolveRoutePermission("inventory-movements", "POST", "00000000-0000-4000-8000-000000000001",
    ["api","erp","inventory-movements","00000000-0000-4000-8000-000000000001","other"], {}), null);
});

test("purchase order creator cannot approve their own request", () => {
  assert.equal(canApprovePurchaseOrder("creator-1", "creator-1"), false);
  assert.equal(canApprovePurchaseOrder("approver-2", "creator-1"), true);
  assert.equal(canApprovePurchaseOrder("approver-2", null), true);
});

test("HR payroll, vacation ledger and leave routes enforce dedicated permissions", () => {
  assert.equal(resolveRoutePermission("hr-payroll-items", "POST", "", [], {}), "hr.payroll.create");
  assert.equal(resolveRoutePermission("hr-payroll-items", "GET", "", [], null), "hr.payroll.view");
  assert.equal(resolveRoutePermission("hr-vacation-ledger", "GET", "", [], null), "hr.payroll.view");
  assert.equal(resolveRoutePermission("hr-vacation-ledger", "POST", "", [], { entry_type: "cash_payment" }), "hr.payroll.create");
  assert.equal(resolveRoutePermission("hr-vacation-ledger", "POST", "", [], { entry_type: "cash_settlement" }), "hr.payroll.approve");
  assert.equal(resolveRoutePermission("hr-vacation-ledger", "POST", "", [], { entry_type: "adjustment" }), "hr.payroll.approve");
  assert.equal(resolveRoutePermission("hr-vacation-ledger", "PATCH", "ledger-1", [], {}), null);
  assert.equal(resolveRoutePermission("hr-leave-requests", "POST", "", [], {}), "hr.leave.create");
  assert.equal(resolveRoutePermission("hr-leave-requests", "PATCH", "leave-1", [], { status: "Aprobado" }), "hr.leave.approve");
  assert.equal(resolveRoutePermission("hr-leave-requests", "PATCH", "leave-1", [], { status: "Rechazado" }), "hr.leave.reject");
});
