import { requireUser } from "../../_shared/auth.js";
import { json, errorResponse } from "../../_shared/http.js";

const HR_ROLES = ["owner", "admin", "hr"];

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env, HR_ROLES);
  if (auth.response) return auth.response;

  try {
    const employees = await auth.sql(
      "SELECT id, employee_code, name, position, department, salary_nio::text AS salary_nio, status, hire_date, phone, email, created_at, updated_at FROM employees ORDER BY LOWER(name), created_at"
    );
    return json({ employees });
  } catch (error) {
    console.error("[hr] Employee query failed:", error && error.message ? error.message : "unknown error");
    return errorResponse(503, "HR_UNAVAILABLE", "Employee records could not be loaded.");
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env, HR_ROLES);
  if (auth.response) return auth.response;

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
    const rows = await auth.sql(
      "INSERT INTO employees (employee_code, name, position, department, salary_nio, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, employee_code, name, position, department, salary_nio::text AS salary_nio, status, hire_date, phone, email, created_at, updated_at",
      [employeeCode || null, name, position, department || null, salary.toFixed(2), auth.user.id]
    );
    await auth.sql(
      "INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details) VALUES ($1, 'create', 'employee', $2, $3::jsonb)",
      [auth.user.id, rows[0].id, JSON.stringify({ name, position, department })]
    );
    return json({ employee: rows[0] }, 201);
  } catch (error) {
    if (error && error.code === "23505") {
      return errorResponse(409, "DUPLICATE_EMPLOYEE_CODE", "That employee code is already in use.");
    }
    console.error("[hr] Employee insert failed:", error && error.message ? error.message : "unknown error");
    return errorResponse(503, "HR_SAVE_FAILED", "The employee record could not be saved.");
  }
}
