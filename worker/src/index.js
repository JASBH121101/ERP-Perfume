// Production deployment is gated through GitHub Actions from main.
import { neon } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { handleERPRequest } from "./erp.js";
import { loadUserPermissions, hasPermission } from "./permissions.js";

const jwksCache = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin"
    }
  });
}

function errorResponse(status, code, message) {
  return json({ error: { code, message } }, status);
}

function getDatabase(env) {
  if (!env?.DATABASE_URL) throw new Error("Database is not configured.");
  return neon(env.DATABASE_URL);
}

function allowedOrigins(env) {
  return String(env.API_CORS_ORIGINS || "https://erp-perfume.pages.dev")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function withCors(request, env, response) {
  const origin = request.headers.get("Origin");
  const headers = new Headers(response.headers);
  headers.set("vary", "Origin");
  if (origin && allowedOrigins(env).includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
    headers.set("access-control-allow-headers", "authorization, content-type");
    headers.set("access-control-max-age", "86400");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function getJwks(url) {
  if (!jwksCache.has(url)) {
    jwksCache.set(url, createRemoteJWKSet(new URL(url)));
  }
  return jwksCache.get(url);
}

export async function provisionBootstrapOwner(sql, authRecord, env) {
  const configuredEmail = String(env?.BOOTSTRAP_OWNER_EMAIL || "").trim().toLowerCase();
  const verifiedEmail = String(authRecord?.email || "").trim();
  if (!configuredEmail || !verifiedEmail || verifiedEmail.toLowerCase() !== configuredEmail ||
      authRecord?.email_verified !== true || !authRecord?.id) {
    return null;
  }

  const displayName = String(authRecord.name || "").trim().slice(0, 120) ||
    verifiedEmail.split("@")[0].slice(0, 120);

  let rows;
  try {
    rows = await sql.query(
      "INSERT INTO app_users (auth_user_id, email, display_name, role, active, position_title, " +
      "account_status, must_change_password, role_template_key) " +
      "VALUES ($1, $2, $3, 'owner', TRUE, 'Propietario', 'active', FALSE, 'owner') " +
      "ON CONFLICT (auth_user_id) DO NOTHING " +
      "RETURNING id, auth_user_id, email, display_name, role, role_template_key, position_title, " +
      "account_status, must_change_password, active",
      [String(authRecord.id), verifiedEmail, displayName]
    );
  } catch (error) {
    // A matching email already linked to another identity must never be silently reassigned.
    if (error?.code === "23505") return null;
    throw error;
  }

  if (rows[0]) {
    await sql.query(
      "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) " +
      "VALUES ($1, 'bootstrap_owner', 'app_user', $2, $3::jsonb)",
      [rows[0].id, rows[0].id, JSON.stringify({ email: verifiedEmail.toLowerCase(), role: "owner" })]
    );
    return rows[0];
  }

  const existing = await sql.query(
    "SELECT id, auth_user_id, email, display_name, role, role_template_key, position_title, " +
    "account_status, must_change_password, active " +
    "FROM app_users WHERE auth_user_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1",
    [String(authRecord.id), verifiedEmail]
  );
  return existing[0] || null;
}

async function requireUser(request, env) {
  if (!env?.NEON_AUTH_JWKS_URL || !env?.NEON_AUTH_BASE_URL || !env?.DATABASE_URL) {
    return { response: errorResponse(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.") };
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { response: errorResponse(401, "UNAUTHORIZED", "Sign in to continue.") };
  }

  let identity;
  try {
    const verified = await jwtVerify(
      authorization.slice(7),
      getJwks(env.NEON_AUTH_JWKS_URL),
      {
        issuer: new URL(env.NEON_AUTH_BASE_URL).origin,
        audience: new URL(env.NEON_AUTH_BASE_URL).origin,
        algorithms: ["EdDSA"]
      }
    );
    identity = verified.payload;
  } catch {
    return { response: errorResponse(401, "INVALID_SESSION", "Your session is invalid or expired. Sign in again.") };
  }

  const authUserId = typeof identity.sub === "string" ? identity.sub : "";
  if (!authUserId) {
    return { response: errorResponse(401, "INVALID_SESSION", "The session does not contain a user identity.") };
  }

  try {
    const sql = getDatabase(env);
    const authRows = await sql.query(
      'SELECT id, name, email, "emailVerified" AS email_verified FROM neon_auth."user" WHERE id = $1 LIMIT 1',
      [authUserId]
    );
    const authRecord = authRows[0];

    if (!authRecord || typeof authRecord.email !== "string" || !authRecord.email.trim()) {
      return { response: errorResponse(401, "AUTH_USER_NOT_FOUND", "The signed-in account could not be found.") };
    }
    if (authRecord.email_verified !== true) {
      return { response: errorResponse(403, "VERIFIED_EMAIL_REQUIRED", "Verify your email address before accessing ERP data.") };
    }

    // A Neon Auth identity is not automatically an ERP account.
    // Only a separately provisioned app_users row grants entry.
    const rows = await sql.query(
      "SELECT id, auth_user_id, email, display_name, role, role_template_key, position_title, " +
      "account_status, must_change_password, active " +
      "FROM app_users WHERE auth_user_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1",
      [authUserId, authRecord.email.trim()]
    );

    const user = rows[0] || await provisionBootstrapOwner(sql, authRecord, env);
    if (!user) {
      return { response: errorResponse(403, "ACCOUNT_NOT_PROVISIONED", "Esta cuenta todavía no fue autorizada por el propietario del ERP.") };
    }
    if (user.account_status === "disabled") {
      return { response: errorResponse(403, "ACCOUNT_DISABLED", "El propietario deshabilitó esta cuenta del ERP. Contacta al propietario si necesitas recuperar el acceso.") };
    }
    if (user.active !== true || user.account_status !== "active") {
      return { response: errorResponse(403, "ACCOUNT_NOT_ACTIVE", "Tu correo y contraseña ya están configurados. Solo falta que el propietario active tu acceso al ERP.") };
    }

    return { user, sql };
  } catch (error) {
    console.error("[auth] Unable to resolve ERP user:", error?.message || "database error");
    return { response: errorResponse(503, "IDENTITY_UNAVAILABLE", "The ERP identity service is temporarily unavailable.") };
  }
}

async function getConfig(env) {
  const ready = Boolean(env?.DATABASE_URL && env?.NEON_AUTH_BASE_URL && env?.NEON_AUTH_JWKS_URL);
  return json({
    authBaseUrl: ready ? env.NEON_AUTH_BASE_URL : null,
    mode: ready ? "authenticated" : "demo",
    environment: env?.ERP_ENVIRONMENT || "development"
  });
}

async function getHealth(env) {
  if (!env?.DATABASE_URL) {
    return errorResponse(503, "DATABASE_NOT_CONFIGURED", "This deployment has no database connection.");
  }
  try {
    const rows = await getDatabase(env).query("SELECT 1::int AS ok");
    const ok = Boolean(rows[0] && rows[0].ok === 1);
    return json({
      ok,
      services: {
        database: ok,
        authentication: Boolean(env.NEON_AUTH_BASE_URL && env.NEON_AUTH_JWKS_URL),
        storage: Boolean(env.ERP_ASSETS)
      },
      environment: env.ERP_ENVIRONMENT || "unknown"
    });
  } catch (error) {
    console.error("[health] Database check failed:", error?.message || "unknown error");
    return errorResponse(503, "DATABASE_UNAVAILABLE", "The database check failed.");
  }
}

async function getProfile(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  try {
    const permissionContext = await loadUserPermissions(auth.sql, auth.user);
    const permissions = permissionContext.owner
      ? ["*"]
      : permissionContext.permissions
          .filter((item) => hasPermission(permissionContext, item.key))
          .map((item) => item.key);
    return json({
      user: {
        id: auth.user.id,
        authUserId: auth.user.auth_user_id,
        email: auth.user.email,
        name: auth.user.display_name,
        role: auth.user.role,
        roleTemplate: auth.user.role_template_key,
        positionTitle: auth.user.position_title,
        accountStatus: auth.user.account_status,
        mustChangePassword: auth.user.must_change_password === true,
        permissions
      }
    });
  } catch (error) {
    console.error("[auth] Permission profile failed:", error?.message || "database error");
    return errorResponse(503, "PERMISSIONS_UNAVAILABLE", "No se pudieron cargar los permisos de la cuenta.");
  }
}

async function getEmployees(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const permissionContext = await loadUserPermissions(auth.sql, auth.user);
  if (!hasPermission(permissionContext, "hr.employees.view")) {
    return errorResponse(403, "FORBIDDEN", "No tienes permiso para consultar empleados.");
  }
  try {
    const employees = await auth.sql.query(
      "SELECT id, employee_code, name, position, department, salary_nio::text AS salary_nio, " +
      "status, hire_date, phone, email, created_at, updated_at FROM employees ORDER BY LOWER(name), created_at"
    );
    return json({ employees });
  } catch (error) {
    console.error("[hr] Employee query failed:", error?.message || "unknown error");
    return errorResponse(503, "HR_UNAVAILABLE", "Employee records could not be loaded.");
  }
}

async function createEmployee(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const permissionContext = await loadUserPermissions(auth.sql, auth.user);
  if (!hasPermission(permissionContext, "hr.employees.create")) {
    return errorResponse(403, "FORBIDDEN", "No tienes permiso para crear empleados.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "The request body must be valid JSON.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const position = typeof body.position === "string" ? body.position.trim() : "";
  const department = typeof body.department === "string" ? body.department.trim() : null;
  const employeeCode = typeof body.employeeCode === "string" ? body.employeeCode.trim() : null;
  const salary = Number(body.salaryNio);

  if (!name || name.length > 120 || !position || position.length > 120) {
    return errorResponse(400, "INVALID_EMPLOYEE", "Enter a valid employee name and position.");
  }
  if (!Number.isFinite(salary) || salary < 0 || salary > 999999999) {
    return errorResponse(400, "INVALID_SALARY", "Enter a valid monthly salary in NIO.");
  }
  if (department && department.length > 80) {
    return errorResponse(400, "INVALID_DEPARTMENT", "Department must be 80 characters or fewer.");
  }
  if (employeeCode && employeeCode.length > 40) {
    return errorResponse(400, "INVALID_EMPLOYEE_CODE", "Employee code must be 40 characters or fewer.");
  }

  try {
    const rows = await auth.sql.query(
      "INSERT INTO employees (employee_code, name, position, department, salary_nio, created_by) " +
      "VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, employee_code, name, position, department, " +
      "salary_nio::text AS salary_nio, status, hire_date, phone, email, created_at, updated_at",
      [employeeCode || null, name, position, department || null, salary.toFixed(2), auth.user.id]
    );

    await auth.sql.query(
      "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) " +
      "VALUES ($1, 'create', 'employee', $2, $3::jsonb)",
      [auth.user.id, rows[0].id, JSON.stringify({ name, position, department })]
    );
    return json({ employee: rows[0] }, 201);
  } catch (error) {
    if (error?.code === "23505") {
      return errorResponse(409, "DUPLICATE_EMPLOYEE_CODE", "That employee code is already in use.");
    }
    console.error("[hr] Employee insert failed:", error?.message || "unknown error");
    return errorResponse(503, "HR_SAVE_FAILED", "The employee record could not be saved.");
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins(env).includes(origin)) {
      return errorResponse(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed to access the ERP API.");
    }

    if (request.method === "OPTIONS") {
      return withCors(request, env, new Response(null, { status: 204 }));
    }

    const path = new URL(request.url).pathname;
    let response;

    if (path === "/api/config" && request.method === "GET") {
      response = await getConfig(env);
    } else if (path === "/api/health" && request.method === "GET") {
      response = await getHealth(env);
    } else if (path === "/api/auth/profile" && request.method === "GET") {
      response = await getProfile(request, env);
    } else if (path === "/api/hr/employees" && request.method === "GET") {
      response = await getEmployees(request, env);
    } else if (path === "/api/hr/employees" && request.method === "POST") {
      response = await createEmployee(request, env);
    } else if (path.startsWith("/api/erp/")) {
      const auth = await requireUser(request, env);
      response = auth.response || await handleERPRequest(request, env, auth.user, auth.sql);
    } else if (["/api/config", "/api/health", "/api/auth/profile", "/api/hr/employees"].includes(path)) {
      response = errorResponse(405, "METHOD_NOT_ALLOWED", "This HTTP method is not supported for the requested endpoint.");
      response.headers.set("allow", path === "/api/hr/employees" ? "GET, POST, OPTIONS" : "GET, OPTIONS");
    } else {
      response = errorResponse(404, "NOT_FOUND", "The requested API route was not found.");
    }

    return withCors(request, env, response);
  }
};
