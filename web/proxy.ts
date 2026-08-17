import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";

const PUBLIC_PATHS = ["/login", "/signup", "/"];
const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/extension",
  "/api/health",
  "/_next",
  "/favicon.ico",
];

interface CookieOptions {
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
}

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  let isValidSession = false;
  let newCookiesToSet: CookieToSet[] = [];

  if (accessToken) {
    const verified = await verifyAccessToken(accessToken);
    if (verified) {
      isValidSession = true;

      // Check if access token is near expiration (< 2 minutes remaining)
      const expTime = (verified.exp ?? 0) * 1000;
      const now = Date.now();
      const twoMinutesMs = 2 * 60 * 1000;

      if (refreshToken && expTime - now < twoMinutesMs) {
        // Attempt proactive silent refresh
        const refreshed = await attemptSilentRefresh(request);
        if (refreshed.success && refreshed.cookies.length > 0) {
          newCookiesToSet = refreshed.cookies;
        }
      }
    }
  }

  // Silent Token Refresh: If access token is missing/expired but refresh token cookie is present
  if (!isValidSession && refreshToken) {
    const refreshed = await attemptSilentRefresh(request);
    if (refreshed.success) {
      isValidSession = true;
      newCookiesToSet = refreshed.cookies;
    }
  }

  if (isPublic) {
    // If logged in and hitting /login or /signup, redirect to /dashboard
    if (isValidSession && (pathname === "/login" || pathname === "/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const response = NextResponse.redirect(url);
      applyCookiesToResponse(response, newCookiesToSet);
      return response;
    }

    const response = NextResponse.next({ request });
    applyCookiesToResponse(response, newCookiesToSet);
    return response;
  }

  // Protected route access check
  if (!isValidSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });
  applyCookiesToResponse(response, newCookiesToSet);
  return response;
}

async function attemptSilentRefresh(request: NextRequest): Promise<{
  success: boolean;
  cookies: CookieToSet[];
}> {
  try {
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    const refreshResponse = await fetch(refreshUrl.toString(), {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!refreshResponse.ok) {
      return { success: false, cookies: [] };
    }

    const cookiesToSet: CookieToSet[] = [];
    const setCookieHeader = refreshResponse.headers.getSetCookie();

    if (setCookieHeader && setCookieHeader.length > 0) {
      for (const str of setCookieHeader) {
        const parsed = parseCookieHeader(str);
        if (parsed) {
          cookiesToSet.push(parsed);
        }
      }
    }

    return { success: true, cookies: cookiesToSet };
  } catch (error) {
    console.error("Silent token refresh error in middleware:", error);
    return { success: false, cookies: [] };
  }
}

function parseCookieHeader(headerStr: string): CookieToSet | null {
  const parts = headerStr.split(";").map((p) => p.trim());
  if (parts.length === 0) return null;

  const [first, ...attributes] = parts;
  const eqIdx = first.indexOf("=");
  if (eqIdx === -1) return null;

  const name = first.substring(0, eqIdx).trim();
  const value = first.substring(eqIdx + 1).trim();

  const options: CookieOptions = { path: "/" };

  for (const attr of attributes) {
    const [attrName, attrVal] = attr.split("=").map((a) => a.trim());
    const lower = attrName.toLowerCase();
    if (lower === "httponly") options.httpOnly = true;
    else if (lower === "secure") options.secure = true;
    else if (lower === "samesite") {
      const val = attrVal?.toLowerCase();
      if (val === "lax" || val === "strict" || val === "none") {
        options.sameSite = val;
      }
    } else if (lower === "path") options.path = attrVal || "/";
    else if (lower === "max-age" && attrVal) options.maxAge = parseInt(attrVal, 10);
  }

  return { name, value, options };
}

function applyCookiesToResponse(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
) {
  for (const c of cookiesToSet) {
    response.cookies.set(c.name, c.value, c.options);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/extension|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
