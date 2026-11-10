import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../assets/css/ultra-compact.css", import.meta.url), "utf8");

test("owner access manager prevents re-inviting an existing ERP email", () => {
  assert.match(app, /emailAlreadyProvisioned=accessManager\.users\.some/);
  assert.match(app, /emailIdentityPending=accessManager\.pendingIdentities\.some/);
  assert.match(app, /No se puede registrar dos veces/);
});

test("access manager labels job position separately from permission profile", () => {
  assert.match(app, /data-label="Cargo"/);
  assert.match(app, /data-label="Permisos"/);
  assert.match(app, /Perfil de permisos/);
});

test("all access manager tables expose mobile field labels", () => {
  assert.match(app, /data-label="Fecha"/);
  assert.match(app, /data-label="Actor"/);
  assert.match(app, /data-label="Error"/);
  assert.match(app, /data-label="Origen"/);
  assert.match(app, /data-label="Identidad"/);
  assert.match(app, /data-label="Acciones"/);
});

test("access manager tables become single-column cards on narrow screens", () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.access-manager-section/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(css, /overflow: visible !important/);
  assert.match(css, /width: 100% !important/);
});
