const ADMIN_ACCESS_STORAGE_KEY = "oneulbada-admin-access";
export const ADMIN_QUERY_TOKEN_KEY = "adminToken";

export function resolveAdminAccessToken() {
  return import.meta.env.VITE_ADMIN_ACCESS_TOKEN?.trim() || "oneulbada-ops-2026";
}

export function resolveAdminAccessPin() {
  return import.meta.env.VITE_ADMIN_ACCESS_PIN?.trim() || "758400";
}

export function hasAdminAccess() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ADMIN_ACCESS_STORAGE_KEY) === "granted";
}

export function grantAdminAccess(token: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedToken = token.trim();
  if (
    !normalizedToken ||
    (normalizedToken !== resolveAdminAccessToken() && normalizedToken !== resolveAdminAccessPin())
  ) {
    return false;
  }

  window.localStorage.setItem(ADMIN_ACCESS_STORAGE_KEY, "granted");
  return true;
}

export function revokeAdminAccess() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ADMIN_ACCESS_STORAGE_KEY);
}
