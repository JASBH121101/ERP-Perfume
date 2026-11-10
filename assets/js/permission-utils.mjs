export function profileHasPermission(profile, permissionKey) {
  if (!profile || typeof permissionKey !== "string" || !permissionKey) return false;
  if (String(profile.role || "").toLowerCase() === "owner") return true;
  const grants = profile.permissions;
  // A wildcard is never accepted from a non-owner profile. The Worker emits
  // it only for the protected owner identity; a malformed client profile must
  // not accidentally broaden a worker's UI permissions.
  return Array.isArray(grants) && grants.includes(permissionKey);
}

export function profileHasAnyPermission(profile, permissionKeys) {
  return Array.isArray(permissionKeys) &&
    permissionKeys.some((key) => profileHasPermission(profile, key));
}

export function profileMatchesAuthUser(profile, authUser) {
  if (!profile || !authUser) return false;
  const profileAuthId = String(profile.authUserId || "").trim();
  const sessionAuthId = String(authUser.id || "").trim();
  const profileEmail = String(profile.email || "").trim().toLowerCase();
  const sessionEmail = String(authUser.email || "").trim().toLowerCase();
  return Boolean(profileAuthId && sessionAuthId && profileAuthId === sessionAuthId &&
    profileEmail && sessionEmail && profileEmail === sessionEmail);
}

export function profileIdentityKey(profile) {
  if (!profile) return "";
  const permissions = Array.isArray(profile.permissions)
    ? [...profile.permissions].map(String).sort()
    : [];
  return [
    String(profile.authUserId || ""),
    String(profile.id || ""),
    String(profile.role || ""),
    String(profile.roleTemplate || ""),
    String(profile.accountStatus || ""),
    String(profile.name || ""),
    String(profile.positionTitle || ""),
    permissions.join(",")
  ].join("|");
}
