export function profileHasPermission(profile, permissionKey) {
  if (!profile || typeof permissionKey !== "string" || !permissionKey) return false;
  if (String(profile.role || "").toLowerCase() === "owner") return true;
  const grants = profile.permissions;
  return Array.isArray(grants) && (grants.includes("*") || grants.includes(permissionKey));
}

export function profileHasAnyPermission(profile, permissionKeys) {
  return Array.isArray(permissionKeys) &&
    permissionKeys.some((key) => profileHasPermission(profile, key));
}
