import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import crypto from "node:crypto";

const DEFAULT_SECRET = "devbrain-default-jwt-secret-key-change-in-production-min-32-bytes";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

export interface UserJWTPayload extends JWTPayload {
  sub: string;
  email: string;
  name?: string | null;
}

export const ACCESS_TOKEN_EXPIRY = "15m";
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes in seconds

export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generates an Access JWT token signed with JOSE for Edge compatibility.
 */
export async function generateAccessToken(payload: {
  sub: string;
  email: string;
  name?: string | null;
}): Promise<string> {
  const secretKey = getSecretKey();
  return new SignJWT({
    email: payload.email,
    name: payload.name ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secretKey);
}

/**
 * Verifies an Access JWT token statelessly using JOSE.
 */
export async function verifyAccessToken(
  token: string,
): Promise<UserJWTPayload | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }
    return payload as UserJWTPayload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically random opaque refresh token and its SHA-256 hash.
 */
export function generateRefreshToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000);
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Hashes an opaque refresh token using SHA-256 before database operations.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
