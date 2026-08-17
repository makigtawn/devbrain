import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_MAX_AGE_SECONDS, REFRESH_TOKEN_MAX_AGE_SECONDS } from "./jwt";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const isProd = process.env.NODE_ENV === "production";

export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
};

/**
 * Sets access_token and refresh_token cookies on a NextResponse object.
 */
export function setAuthCookiesOnResponse(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  return response;
}

/**
 * Clears auth cookies on a NextResponse object.
 */
export function clearAuthCookiesOnResponse(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...ACCESS_COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

/**
 * Sets access_token and refresh_token cookies on server actions / routes using next/headers cookies().
 */
export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
}

/**
 * Clears access_token and refresh_token cookies using next/headers cookies().
 */
export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, "", {
    ...ACCESS_COOKIE_OPTIONS,
    maxAge: 0,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, "", {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Helper to get tokens from request cookies or headers.
 */
export function getTokensFromRequest(request: NextRequest): {
  accessToken?: string;
  refreshToken?: string;
} {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  return { accessToken, refreshToken };
}
