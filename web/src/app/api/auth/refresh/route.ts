import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth/jwt";
import {
  clearAuthCookiesOnResponse,
  getTokensFromRequest,
  setAuthCookiesOnResponse,
} from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    let rawRefreshToken = getTokensFromRequest(request).refreshToken;

    if (!rawRefreshToken) {
      const body = await request.json().catch(() => ({}));
      if (typeof body.refreshToken === "string") {
        rawRefreshToken = body.refreshToken;
      }
    }

    if (!rawRefreshToken) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        rawRefreshToken = authHeader.slice(7);
      }
    }

    if (!rawRefreshToken) {
      return NextResponse.json(
        { error: "Refresh token is missing" },
        { status: 401 },
      );
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      const res = NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 },
      );
      return clearAuthCookiesOnResponse(res);
    }

    // Refresh Token Rotation & Theft Detection:
    if (tokenRecord.revoked) {
      console.warn(
        `[Security Alert] Reuse of revoked refresh token detected for userId: ${tokenRecord.userId}. Invalidating all sessions.`,
      );
      await prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revoked: false },
        data: { revoked: true },
      });

      const res = NextResponse.json(
        { error: "Compromised session detected. All sessions invalidated. Please log in again." },
        { status: 401 },
      );
      return clearAuthCookiesOnResponse(res);
    }

    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revoked: true },
      });

      const res = NextResponse.json(
        { error: "Refresh token expired. Please log in again." },
        { status: 401 },
      );
      return clearAuthCookiesOnResponse(res);
    }

    // Revoke current refresh token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    const user = tokenRecord.user;

    // Issue new access and refresh token pair
    const accessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const { rawToken: newRefreshToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } =
      generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    const isExtension =
      request.headers.get("x-client-type") === "extension" ||
      request.headers.get("user-agent")?.includes("Extension");

    const payload = isExtension
      ? {
          user: { id: user.id, email: user.email, name: user.name },
          accessToken,
          refreshToken: newRefreshToken,
        }
      : {
          user: { id: user.id, email: user.email, name: user.name },
        };

    const response = NextResponse.json(payload, { status: 200 });
    return setAuthCookiesOnResponse(response, accessToken, newRefreshToken);
  } catch (error) {
    console.error("Refresh API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
