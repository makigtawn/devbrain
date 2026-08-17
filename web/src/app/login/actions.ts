"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth/jwt";
import {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookies";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    redirect(`/login?error=${encodeURIComponent("Invalid email or password.")}`);
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

  await setAuthCookies(accessToken, refreshToken);
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("Email and password are required.")}`);
  }

  if (password.length < 6) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 6 characters.")}`);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    redirect(`/signup?error=${encodeURIComponent("An account with this email already exists.")}`);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
    },
  });

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

  await setAuthCookies(accessToken, refreshToken);
  redirect(
    `/login?info=${encodeURIComponent(
      "Account created successfully! Log in below with your credentials.",
    )}`,
  );
}

export async function signOut() {
  try {
    const cookieStore = await cookies();
    const rawRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revoked: false },
        data: { revoked: true },
      });
    }
  } catch (error) {
    console.error("SignOut error:", error);
  }

  await clearAuthCookies();
  redirect("/login");
}

export async function requestPasswordReset() {
  redirect(
    `/forgot-password?info=${encodeURIComponent(
      "If an account exists for that email, password reset instructions have been logged.",
    )}`,
  );
}

export async function updatePassword() {
  redirect(
    `/login?info=${encodeURIComponent(
      "Password update feature is managed via account settings.",
    )}`,
  );
}
