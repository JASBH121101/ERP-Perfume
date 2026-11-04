const OWNER_ROLE = "owner";

export async function loadUserPermissions(sql, user) {
  if (!user || user.role === OWNER_ROLE) return { owner: true, permissions: ["*"] };
  const rows = await sql.query(
    "SELECT p.permission_key, COALESCE(u.allowed, r.allowed, false) AS allowed " +
    "FROM permission_catalog p " +
    "LEFT JOIN role_template_permissions r ON r.permission_key=p.permission_key AND r.role_key=$1 " +
    "LEFT JOIN user_permission_overrides u ON u.permission_key=p.permission_key AND u.user_id=$2::uuid",
    [user.role, user.id]
  );
  return { owner: false, permissions: rows.filter(row => row.allowed === true).map(row => row.permission_key) };
}

export function hasPermission(context, permissionKey) {
  if (!context) return false;
  if (context.owner === true) return true;
  const granted = new Set(Array.isArray(context.permissions) ? context.permissions : []);
  if (granted.has(permissionKey)) return true;

  // A section/action is usable only when its own grant AND its parent view grants exist.
  const parts = String(permissionKey || "").split(".");
  if (parts.length >= 3) {
    const moduleView = parts[0] + ".view";
    if (!granted.has(moduleView)) return false;
    if (parts.length >= 4) {
      const sectionView = parts.slice(0, 2).join(".") + ".view";
      if (!granted.has(sectionView)) return false;
    }
    return granted.has(permissionKey);
  }
  return granted.has(permissionKey);
}

export async function requirePermission(sql, user, permissionKey) {
  const context = await loadUserPermissions(sql, user);
  return hasPermission(context, permissionKey);
}
