import test from "node:test";
import assert from "node:assert/strict";
import {
  profileHasAnyPermission,
  profileHasPermission,
  profileIdentityKey,
  profileMatchesAuthUser
} from "../assets/js/permission-utils.mjs";
import { readFileSync } from "node:fs";

const bootstrap = readFileSync(new URL("../assets/js/bootstrap.mjs", import.meta.url), "utf8");

test("a custom role can open an HR tab when its explicit permission is granted", () => {
  const profile = { role: "viewer", permissions: ["dashboard.view", "hr.employees.view"] };
  assert.equal(profileHasPermission(profile, "hr.employees.view"), true);
  assert.equal(profileHasAnyPermission(profile, ["hr.employees.view", "hr.attendance.view"]), true);
});

test("a custom role cannot open an HR or DGI tab without the matching grant", () => {
  const profile = { role: "viewer", permissions: ["dashboard.view"] };
  assert.equal(profileHasAnyPermission(profile, ["hr.employees.view", "hr.attendance.view"]), false);
  assert.equal(profileHasPermission(profile, "dgi.documents.view"), false);
});

test("only the protected owner role can bypass individual permission grants", () => {
  assert.equal(profileHasPermission({ role: "owner", permissions: [] }, "dgi.documents.view"), true);
  assert.equal(profileHasPermission({ role: "viewer", permissions: ["*"] }, "hr.payroll.view"), false);
});

test("the Worker profile must match both the authenticated Neon user id and email", () => {
  const authUser = { id: "auth-1", email: "worker@example.test" };
  const matchingProfile = { authUserId: "auth-1", email: "WORKER@example.test", role: "viewer" };
  assert.equal(profileMatchesAuthUser(matchingProfile, authUser), true);
  assert.equal(profileMatchesAuthUser({ ...matchingProfile, authUserId: "auth-2" }, authUser), false);
  assert.equal(profileMatchesAuthUser({ ...matchingProfile, email: "owner@example.test" }, authUser), false);
  assert.equal(profileMatchesAuthUser({ ...matchingProfile, authUserId: "" }, authUser), false);
});

test("the Bodega profile exposes only its inventory-related navigation modules", () => {
  const bodega = {
    role: "viewer",
    permissions: [
      "dashboard.view",
      "products.catalog.view",
      "inventory.stock.view",
      "inventory.receipts.view",
      "purchases.purchase_orders.view",
      "purchases.receipts.view",
      "suppliers.records.view"
    ]
  };
  const viewPermissions = {
    dashboard: ["dashboard.view"],
    orders: ["orders.records.view"],
    billing: ["billing.invoices.view"],
    customers: ["customers.records.view"],
    products: ["products.catalog.view"],
    catalog: ["products.catalog.view"],
    inventory: ["inventory.stock.view", "inventory.receipts.view"],
    purchases: ["purchases.receipts.view"],
    purchaseOrders: ["purchases.purchase_orders.view", "purchases.receipts.view"],
    suppliers: ["suppliers.records.view"],
    expenses: ["expenses.records.view"],
    cash: ["cash.entries.view"],
    hr: ["hr.employees.view", "hr.attendance.view", "hr.payroll.view"],
    dgi: ["dgi.documents.view"],
    analytics: ["analytics.reports.view"],
    settings: ["settings.general.view"],
    payables: ["purchases.supplier_invoices.view"],
    receivables: ["receivables.view", "billing.payments.view"]
  };
  const visible = Object.entries(viewPermissions)
    .filter(([, keys]) => profileHasAnyPermission(bodega, keys))
    .map(([view]) => view);
  assert.deepEqual(visible, [
    "dashboard", "products", "catalog", "inventory", "purchases",
    "purchaseOrders", "suppliers"
  ]);
  assert.equal(profileHasAnyPermission(bodega, ["billing.invoices.view", "cash.entries.view"]), false);
});

test("identity keys are stable across permission ordering and change when grants change", () => {
  const profile = {
    authUserId: "auth-1", id: "erp-1", role: "viewer", roleTemplate: "inventory",
    permissions: ["products.catalog.view", "inventory.stock.view"]
  };
  assert.equal(profileIdentityKey(profile), profileIdentityKey({
    ...profile, permissions: [...profile.permissions].reverse()
  }));
  assert.notEqual(profileIdentityKey(profile), profileIdentityKey({
    ...profile, permissions: ["products.catalog.view"]
  }));
});

test("the auth bootstrap rejects mismatched profiles and remounts the SPA on sign-out or identity changes", () => {
  assert.match(bootstrap, /profileMatchesAuthUser\(body\.user, authUser\)/);
  assert.match(bootstrap, /nextProfileKey !== appLoadedProfileKey/);
  const signOut = bootstrap.match(/async signOut\(\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.match(signOut, /window\.location\.reload\(\)/);
});
