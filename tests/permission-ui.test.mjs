import test from "node:test";
import assert from "node:assert/strict";
import {
  profileHasAnyPermission,
  profileHasPermission
} from "../assets/js/permission-utils.mjs";

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

test("the explicit owner role and wildcard grant retain their intended bypass", () => {
  assert.equal(profileHasPermission({ role: "owner", permissions: [] }, "dgi.documents.view"), true);
  assert.equal(profileHasPermission({ role: "viewer", permissions: ["*"] }, "hr.payroll.view"), true);
});
