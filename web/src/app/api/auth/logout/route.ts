import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { hashRefreshToken } from "@/lib/auth/jwt";
import { clearAuthCookiesOnResponse, getTokensFromRequest } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    let rawRefreshToken = getTokensFromRequest(request).refreshToken;

    if (!rawRefreshToken) {
      const body = await request.json().catch(() => ({}));
      if (typeof body.refreshToken === "string") {
        rawRefreshToken = body.refreshToken;
      }
    }

    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revoked: false },
        data: { revoked: true },
      });
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    return clearAuthCookiesOnResponse(response);
  } catch (error) {
    console.error("Logout API error:", error);
    const response = NextResponse.json({ success: true }, { status: 200 });
    return clearAuthCookiesOnResponse(response);
  }
}
