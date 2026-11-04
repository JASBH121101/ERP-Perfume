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

test("unknown routes fail closed", () => {
  assert.equal(resolveRoutePermission("unknown-resource", "GET", "", [], null), null);
});
