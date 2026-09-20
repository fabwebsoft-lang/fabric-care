const SESSION_KEY = "fabric_care_session_token";
const ROLE_KEY = "fabric_care_role_token";
const USER_CACHE_KEY = "fabric_care_user_cache";

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string) {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {}
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {}
}

export function getRoleToken(): string | null {
  try {
    return localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export function setRoleToken(token: string) {
  try {
    localStorage.setItem(ROLE_KEY, token);
  } catch {}
}

export function clearRoleToken() {
  try {
    localStorage.removeItem(ROLE_KEY);
  } catch {}
}

export function getCachedUser(): any | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: any) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {}
}

export function clearAllSession() {
  clearSessionToken();
  clearRoleToken();
  setCachedUser(null);
}
