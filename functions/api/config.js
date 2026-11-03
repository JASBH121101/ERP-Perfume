import { json } from "../_shared/http.js";

export async function onRequestGet({ env }) {
  return json({
    authBaseUrl: env.NEON_AUTH_BASE_URL || null,
    mode: env.NEON_AUTH_BASE_URL && env.NEON_AUTH_JWKS_URL ? "authenticated" : "demo",
    environment: env.ERP_ENVIRONMENT || "production"
  });
}
