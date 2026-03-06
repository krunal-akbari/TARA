import { AuthSession } from "@/lib/types/auth";

const ACCESS_TOKEN_COOKIE = "access_token=";
const SESSION_MARKER_KEY = "tara_auth_active";

function hasAccessTokenCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((cookie) => cookie.trim().startsWith(ACCESS_TOKEN_COOKIE));
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return hasAccessTokenCookie() || window.sessionStorage.getItem(SESSION_MARKER_KEY) === "1";
}

export function getStoredSession(): AuthSession | null {
  if (!isAuthenticated()) return null;
  return { tenantId: null, user: null };
}

export function setStoredSession(_session: AuthSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_MARKER_KEY, "1");
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_MARKER_KEY);
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
