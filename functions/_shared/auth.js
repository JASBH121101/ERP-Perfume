import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDatabase } from "./db.js";
import { errorResponse } from "./http.js";

const keySets = new Map();

function getKeySet(url) {
  if (!keySets.has(url)) keySets.set(url, createRemoteJWKSet(new URL(url)));
  return keySets.get(url);
}

export async function requireUser(request, env, allowedRoles = []) {
  if (!env || !env.NEON_AUTH_JWKS_URL || !env.NEON_AUTH_BASE_URL) {
    return { response: errorResponse(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured for this deployment.") };
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { response: errorResponse(401, "UNAUTHORIZED", "Sign in to continue.") };
  }

  let identity;
  try {
    const issuer = new URL(env.NEON_AUTH_BASE_URL).origin;
    const verified = await jwtVerify(
      authorization.slice(7),
      getKeySet(env.NEON_AUTH_JWKS_URL),
      { issuer, algorithms: ["EdDSA"] }
    );
    identity = verified.payload;
  } catch {
    return { response: errorResponse(401, "INVALID_SESSION", "Your session is invalid or expired. Sign in again.") };
  }

  const authUserId = typeof identity.sub === "string" ? identity.sub : "";
  const email = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
  const displayName = typeof identity.name === "string" ? identity.name.trim() : "";
  const emailVerified = identity.emailVerified === true || identity.email_verified === true;

  if (!authUserId || !email || !emailVerified) {
    return { response: errorResponse(403, "VERIFIED_EMAIL_REQUIRED", "Verify your email address before accessing ERP data.") };
  }

  try {
    const sql = getDatabase(env);
    const rows = await sql(
      "INSERT INTO app_users (auth_user_id, email, display_name, role) VALUES ($1, $2, $3, CASE WHEN LOWER($4) = LOWER($2) THEN 'owner' ELSE 'viewer' END) ON CONFLICT (auth_user_id) DO UPDATE SET email = EXCLUDED.email, display_name = CASE WHEN EXCLUDED.display_name <> '' THEN EXCLUDED.display_name ELSE app_users.display_name END, updated_at = NOW() RETURNING id, auth_user_id, email, display_name, role, active",
      [authUserId, email, displayName, env.BOOTSTRAP_OWNER_EMAIL || ""]
    );
    const user = rows[0];

    if (!user || user.active !== true) {
      return { response: errorResponse(403, "ACCOUNT_DISABLED", "This ERP account is disabled.") };
    }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      return { response: errorResponse(403, "INSUFFICIENT_ROLE", "Your account does not have permission for this section.") };
    }
    return { user, sql };
  } catch (error) {
    console.error("[auth] Unable to resolve ERP user:", error && error.message ? error.message : "database error");
    return { response: errorResponse(503, "IDENTITY_UNAVAILABLE", "The ERP identity service is temporarily unavailable.") };
  }
}
