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

test("the auth bootstrap rejects mismatched profiles and reloads the SPA after sign-out or identity changes", () => {
  assert.match(bootstrap, /profileMatchesAuthUser\(body\.user, authUser\)/);
  assert.match(bootstrap, /nextProfileKey !== appLoadedProfileKey/);
  assert.match(bootstrap, /window\.location\.reload\(\)/);
});
