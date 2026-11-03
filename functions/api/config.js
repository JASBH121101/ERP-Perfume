import { json } from "../_shared/http.js";

export async function onRequestGet({ env }) {
  const ready = Boolean(
    env?.DATABASE_URL &&
    env?.NEON_AUTH_BASE_URL &&
    env?.NEON_AUTH_JWKS_URL
  );

  return json({
    authBaseUrl: ready ? env.NEON_AUTH_BASE_URL : null,
    mode: ready ? "authenticated" : "demo",
    environment: env?.ERP_ENVIRONMENT || "development"
  });
}
