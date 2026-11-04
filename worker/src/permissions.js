const OWNER_ROLE = "owner";

export async function loadUserPermissions(sql, user) {
  if (!user) return { owner: false, permissions: [] };
  if (user.role === OWNER_ROLE) return { owner: true, permissions: ["*"], catalog: [] };

  const roleKey = user.role_template_key || user.role || "viewer";
  const rows = await sql.query(
    "SELECT p.permission_key, p.parent_key, " +
    "COALESCE(u.allowed, r.allowed, false) AS allowed " +
    "FROM permission_catalog p " +
    "LEFT JOIN role_template_permissions r " +
    "ON r.permission_key = p.permission_key AND r.role_key = $1 " +
    "LEFT JOIN user_permission_overrides u " +
    "ON u.permission_key = p.permission_key AND u.user_id = $2::uuid " +
    "ORDER BY p.sort_order, p.permission_key",
    [roleKey, user.id]
  );

  return {
    owner: false,
    permissions: rows.map((row) => ({
      key: row.permission_key,
      parentKey: row.parent_key || null,
      allowed: row.allowed === true
    }))
  };
}

export function hasPermission(context, permissionKey) {
  if (!context || typeof permissionKey !== "string" || !permissionKey) return false;
  if (context.owner === true) return true;

  const nodes = new Map(
    (Array.isArray(context.permissions) ? context.permissions : [])
      .filter((item) => item && typeof item.key === "string")
      .map((item) => [item.key, item])
  );

  let current = nodes.get(permissionKey);
  if (!current || current.allowed !== true) return false;

  const visited = new Set();
  while (current.parentKey) {
    if (visited.has(current.key)) return false;
    visited.add(current.key);
    current = nodes.get(current.parentKey);
    if (!current || current.allowed !== true) return false;
  }

  return true;
}

export function hasAnyModuleAccess(context) {
  if (context?.owner === true) return true;
  return (context?.permissions || []).some((item) =>
    item?.allowed === true && item?.parentKey == null && item.key !== "dashboard.view"
  );
}
