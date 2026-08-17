import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";

/** Verifies access token from cookies and returns the verified JWT user payload. */
export async function getJWTUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/** Fetches the current authenticated user's Prisma database record. */
export async function getCurrentUser() {
  const payload = await getJWTUser();
  if (!payload?.sub) return null;

  return prisma.user.findUnique({
    where: { id: payload.sub },
  });
}

/** Requires an authenticated user, redirecting to /login if missing. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
