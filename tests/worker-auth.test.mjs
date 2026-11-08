import assert from "node:assert/strict";
import test from "node:test";
import { provisionBootstrapOwner } from "../worker/src/index.js";

const identity = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
  name: "ERP Owner",
  email_verified: true
};
const env = { BOOTSTRAP_OWNER_EMAIL: "Owner@Example.Test" };

test("first verified sign-in bootstraps only the configured owner identity", async () => {
  const inserted = {
    id: "22222222-2222-4222-8222-222222222222",
    auth_user_id: identity.id,
    email: identity.email,
    display_name: identity.name,
    role: "owner",
    role_template_key: "owner",
    position_title: "Propietario",
    account_status: "active",
    must_change_password: false,
    active: true
  };
  const calls = [];
  const sql = {
    async query(statement, params) {
      calls.push({ statement, params });
      if (statement.startsWith("INSERT INTO app_users")) return [inserted];
      if (statement.startsWith("INSERT INTO audit_log")) return [];
      throw new Error("Unexpected query");
    }
  };

  const user = await provisionBootstrapOwner(sql, identity, env);
  assert.equal(user.role, "owner");
  assert.equal(user.active, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params[0], identity.id);
  assert.equal(calls[0].params[1], identity.email);
  assert.match(calls[0].statement, /'owner', TRUE, 'Propietario', 'active', FALSE, 'owner'/);
  assert.match(calls[1].statement, /bootstrap_owner/);
});

test("does not bootstrap a non-owner email or an unverified identity", async () => {
  let queries = 0;
  const sql = { async query() { queries += 1; return []; } };

  assert.equal(await provisionBootstrapOwner(sql, { ...identity, email: "other@example.test" }, env), null);
  assert.equal(await provisionBootstrapOwner(sql, { ...identity, email_verified: false }, env), null);
  assert.equal(await provisionBootstrapOwner(sql, identity, {}), null);
  assert.equal(queries, 0);
});

test("does not reassign an email already linked to another auth identity", async () => {
  const sql = {
    async query(statement) {
      if (statement.startsWith("INSERT INTO app_users")) {
        const error = new Error("duplicate email");
        error.code = "23505";
        throw error;
      }
      throw new Error("No follow-up query expected");
    }
  };
  assert.equal(await provisionBootstrapOwner(sql, identity, env), null);
});

test("handles concurrent first sign-ins by returning the already-created owner profile", async () => {
  const existing = {
    id: "22222222-2222-4222-8222-222222222222",
    auth_user_id: identity.id,
    email: identity.email,
    role: "owner",
    active: true,
    account_status: "active"
  };
  const calls = [];
  const sql = {
    async query(statement) {
      calls.push(statement);
      if (statement.startsWith("INSERT INTO app_users")) return [];
      if (statement.startsWith("SELECT id, auth_user_id")) return [existing];
      throw new Error("Unexpected query");
    }
  };
  const user = await provisionBootstrapOwner(sql, identity, env);
  assert.equal(user.id, existing.id);
  assert.equal(user.role, "owner");
  assert.equal(calls.length, 2);
});
