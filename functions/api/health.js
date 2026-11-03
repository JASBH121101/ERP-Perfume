import { getDatabase } from "../_shared/db.js";
import { json, errorResponse } from "../_shared/http.js";

export async function onRequestGet({ env }) {
  if (!env || !env.DATABASE_URL) {
    return errorResponse(503, "DATABASE_NOT_CONFIGURED", "This deployment has no database connection.");
  }

  try {
    const sql = getDatabase(env);
    const rows = await sql.query("SELECT 1::int AS ok");
    return json({
      ok: rows[0] && rows[0].ok === 1,
      services: {
        database: Boolean(rows[0] && rows[0].ok === 1),
        authentication: Boolean(env.NEON_AUTH_BASE_URL && env.NEON_AUTH_JWKS_URL),
        storage: Boolean(env.ERP_ASSETS)
      },
      environment: env.ERP_ENVIRONMENT || "unknown"
    });
  } catch (error) {
    console.error("[health] Database check failed:", error && error.message ? error.message : "unknown error");
    return errorResponse(503, "DATABASE_UNAVAILABLE", "The database check failed.");
  }
}
