import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAnyModuleAccess,
  hasPermission,
  loadUserPermissions
} from "../worker/src/permissions.js";
import { resolveRoutePermission } from "../worker/src/erp.js";

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
