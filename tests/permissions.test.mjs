import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAnyModuleAccess,
  hasPermission,
  loadUserPermissions
} from "../worker/src/permissions.js";
import { canApprovePurchaseOrder, readBootstrap, resolveRoutePermission } from "../worker/src/erp.js";

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


function createBootstrapSql() {
  const statements = [];
  const sql = (strings, ...values) => {
    const statement = strings.reduce((result, part, index) =>
      result + part + (index < values.length ? String(values[index]) : ""), "");
    statements.push(statement);
    return Promise.resolve([]);
  };
  sql.transaction = async buildQueries => Promise.all(buildQueries(sql));
  sql.query = async statement => {
    statements.push(String(statement));
    return [];
  };
  return { sql, statements };
}

function bootstrapPermissionContext(keys = []) {
  return {
    owner: false,
    permissions: keys.map(key => ({ key, parentKey: null, allowed: true }))
  };
}

test("bootstrap does not query any ERP datasets when the account has no module grants", async () => {
  const { sql, statements } = createBootstrapSql();
  const result = await readBootstrap(sql, { id: "limited-user" }, bootstrapPermissionContext());

  assert.deepEqual(result, {});
  assert.equal(statements.length, 0);
});

test("bootstrap only reads the product dataset for a product-catalog-only account", async () => {
  const { sql, statements } = createBootstrapSql();
  const result = await readBootstrap(
    sql,
    { id: "product-user" },
    bootstrapPermissionContext(["products.catalog.view"])
  );

  assert.deepEqual(Object.keys(result), ["products"]);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /FROM products/);
  assert.doesNotMatch(statements[0], /FROM (customers|orders|invoices|employees|cash_entries)/);
});

test("purchase-order access does not trigger unrelated purchase receipt item queries", async () => {
  const { sql, statements } = createBootstrapSql();
  const result = await readBootstrap(
    sql,
    { id: "purchasing-user" },
    bootstrapPermissionContext(["purchases.purchase_orders.view"])
  );

  assert.deepEqual(Object.keys(result), [
    "purchase_orders",
    "purchase_order_items",
    "purchase_receipts",
    "purchase_receipt_items"
  ]);
  assert.equal(statements.length, 4);
  assert.ok(statements.some(statement => /FROM purchase_orders/.test(statement)));
  assert.ok(statements.some(statement => /FROM purchase_receipts/.test(statement)));
  assert.ok(!statements.some(statement => /FROM purchases\b|FROM purchase_items\b/.test(statement)));
});

test("payroll access reads its settings and payroll datasets without loading employee history", async () => {
  const { sql, statements } = createBootstrapSql();
  const result = await readBootstrap(
    sql,
    { id: "payroll-user" },
    bootstrapPermissionContext(["hr.payroll.view"])
  );

  assert.deepEqual(Object.keys(result), [
    "hr_payroll_periods",
    "hr_payroll_items",
    "hr_inss_settings",
    "hr_commissions"
  ]);
  assert.equal(statements.length, 4);
  assert.ok(statements.some(statement => /FROM app_settings/.test(statement)));
  assert.ok(statements.some(statement => /FROM employee_commissions/.test(statement)));
  assert.ok(!statements.some(statement => /FROM employee_history|FROM employee_documents|FROM hr_attendance/.test(statement)));
});
