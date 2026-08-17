import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookiesOnResponse } from "@/lib/auth/cookies";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid credentials" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const accessToken = await generateAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const { rawToken: refreshToken, tokenHash, expiresAt } = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const isExtension =
      request.headers.get("x-client-type") === "extension" ||
      request.headers.get("user-agent")?.includes("Extension");

    const payload = isExtension
      ? {
          user: { id: user.id, email: user.email, name: user.name },
          accessToken,
          refreshToken,
        }
      : {
          user: { id: user.id, email: user.email, name: user.name },
        };

    const response = NextResponse.json(payload, { status: 200 });
    return setAuthCookiesOnResponse(response, accessToken, refreshToken);
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
