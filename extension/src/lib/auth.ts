import { Storage } from "@plasmohq/storage";
import { API_BASE_URL } from "./config";

const storage = new Storage({ area: "local" });

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  const session: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };

  await storage.set("access_token", session.accessToken);
  await storage.set("refresh_token", session.refreshToken);
  await storage.set("user_info", session.user);

  return session;
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = await storage.get<string>("refresh_token");
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
  } finally {
    await storage.remove("access_token");
    await storage.remove("refresh_token");
    await storage.remove("user_info");
  }
}

export async function getAccessToken(): Promise<string | null> {
  return (await storage.get<string>("access_token")) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await storage.get<string>("refresh_token")) ?? null;
}

export async function getUser(): Promise<User | null> {
  return (await storage.get<User>("user_info")) ?? null;
}

export async function refreshSession(): Promise<AuthSession | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await logout();
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await logout();
      return null;
    }

    const data = await res.json();
    const session: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };

    await storage.set("access_token", session.accessToken);
    await storage.set("refresh_token", session.refreshToken);
    await storage.set("user_info", session.user);

    return session;
  } catch (error) {
    console.error("Failed to refresh session in extension:", error);
    await logout();
    return null;
  }
}

export async function getSession(): Promise<{ user: User; accessToken: string } | null> {
  let accessToken = await getAccessToken();
  let user = await getUser();

  if (accessToken && user) {
    return { accessToken, user };
  }

  const refreshed = await refreshSession();
  if (refreshed) {
    return { accessToken: refreshed.accessToken, user: refreshed.user };
  }

  return null;
}
