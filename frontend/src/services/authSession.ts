import { DEFAULT_ELO, ERoles, type UserResponse } from "@zess-online-chess/shared";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_USER_KEY = "zess_auth_user";

const LEGACY_DEMO_KEYS = [
  "zess_demo_logged_in",
  "zess_demo_user",
  "zess_demo_password",
  "zess_demo_profile",
];

export type AuthSessionUser = Pick<
  UserResponse,
  "id" | "email" | "name" | "username" | "elo" | "role" | "status" | "isVerified"
>;

export type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
};

function normalizeSessionUser(user: UserResponse): AuthSessionUser {
  // Keep only the fields the UI actually needs so stale backend-only fields do not leak into localStorage.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    elo: typeof user.elo === "number" ? user.elo : DEFAULT_ELO,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified,
  };
}

export function clearLegacyDemoSession() {
  LEGACY_DEMO_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function setAuthSession({ accessToken, refreshToken, user }: AuthSessionPayload) {
  // Auth and WebSocket both read these canonical keys, so login immediately enables realtime features.
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizeSessionUser(user)));
  clearLegacyDemoSession();
}

export function updateAuthSessionUser(user: AuthSessionUser) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  clearLegacyDemoSession();
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getCurrentUser(): AuthSessionUser | null {
  try {
    const rawUser = localStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) return null;

    const parsedUser = JSON.parse(rawUser) as Partial<AuthSessionUser>;

    if (!parsedUser.id || !parsedUser.username) {
      return null;
    }

    return {
      id: parsedUser.id,
      email: parsedUser.email ?? "",
      name: parsedUser.name ?? parsedUser.username,
      username: parsedUser.username,
      elo: typeof parsedUser.elo === "number" ? parsedUser.elo : DEFAULT_ELO,
      role: parsedUser.role ?? ERoles.GUEST,
      status: parsedUser.status ?? "active",
      isVerified: Boolean(parsedUser.isVerified),
    };
  } catch {
    return null;
  }
}

export function getCurrentUserOrRedirect(navigate: (path: string, options?: { replace?: boolean }) => void) {
  const user = getCurrentUser();

  if (!user || !getAccessToken()) {
    navigate("/login", { replace: true });
    return null;
  }

  return user;
}

export function getUserDisplayName(user: Pick<AuthSessionUser, "name" | "username">) {
  return user.name?.trim() || user.username;
}
