import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import type { NextRequest } from "next/server";

/**
 * REDIS VOLUME & TIER ESTIMATION (1,000 Users/Minute Target):
 *
 * Target: 1,000 active users/minute.
 * Assuming an average of 10 rate-limited interactions per user/minute (searches, saves, auth):
 *   - 10,000 rate limit checks / minute
 *   - 600,000 checks / hour
 *   - ~14.4 Million commands / day
 *
 * TIER ASSESSMENT:
 * - Upstash Free Tier (10,000 commands/day): EXHAUSTED IN ~60 SECONDS at target load.
 * - Turning analytics OFF prevents doubling the command volume for tracking data.
 * - RECOMMENDATION: Production requires either:
 *     1) Upstash Pay-As-You-Go ($0.20 per 100k commands -> ~$28/day at sustained peak)
 *     2) Self-hosted Redis (Redis 7, Dragonfly, or KeyDB) alongside the app for 0 API costs.
 */

const ENABLE_ANALYTICS = process.env.UPSTASH_ANALYTICS === "true";

function makeLimiter(
  prefix: string,
  tokens: number,
  window: `${number} ${"s" | "m" | "h"}`,
) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `devbrain:ratelimit:${prefix}`,
    analytics: ENABLE_ANALYTICS, // Disabled by default to prevent Redis quota burn
  });
}

/** 20 writes/min/user — covers entries.create and entries.update */
export const entryWriteLimiter = makeLimiter("entry-write", 20, "1 m");

/** 20 searches/min/user — covers search.query */
export const searchLimiter = makeLimiter("search", 20, "1 m");

/**
 * Configurable IP limiter for authentication (login and register).
 * Default: 5 attempts/minute/IP
 */
const AUTH_LIMIT_TOKENS = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "5", 10);
export const authLimiter = makeLimiter("auth", AUTH_LIMIT_TOKENS, "1 m");

export interface RateLimitResult {
  success: boolean;
  /** Seconds the caller should wait before retrying. Only meaningful when success is false. */
  retryAfterSeconds: number;
}

// Circuit breaker for unreachable remote Redis to prevent request latency spikes
let lastRedisFailure = 0;
const CIRCUIT_BREAKER_MS = 30_000;

function isCircuitBroken(): boolean {
  return Date.now() - lastRedisFailure < CIRCUIT_BREAKER_MS;
}

function tripCircuit() {
  lastRedisFailure = Date.now();
}

/**
 * In-memory fallback sliding-window limiter for auth when Redis is unavailable.
 * Guarantees that local dev or Redis downtime never leaves Argon2 unprotected against DoS.
 */
interface WindowEntry {
  timestamps: number[];
}
const memoryRateLimits = new Map<string, WindowEntry>();
const MEMORY_WINDOW_MS = 60_000;

function checkMemoryLimiter(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryRateLimits.get(key) ?? { timestamps: [] };

  entry.timestamps = entry.timestamps.filter((t) => now - t < MEMORY_WINDOW_MS);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + MEMORY_WINDOW_MS - now) / 1000));
    return { success: false, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  memoryRateLimits.set(key, entry);

  if (memoryRateLimits.size > 5000) {
    for (const [k, v] of memoryRateLimits.entries()) {
      if (v.timestamps.length === 0 || now - v.timestamps[v.timestamps.length - 1] > MEMORY_WINDOW_MS) {
        memoryRateLimits.delete(k);
      }
    }
  }

  return { success: true, retryAfterSeconds: 0 };
}

/**
 * Extract client IP from incoming request headers
 */
export function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Checks a rate limit bucket for a given key (e.g. userId).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<RateLimitResult> {
  const isAuth = key.startsWith("auth:") || key.startsWith("ip:");

  if (!limiter || isCircuitBroken()) {
    if (isAuth) {
      return checkMemoryLimiter(key, AUTH_LIMIT_TOKENS);
    }
    return { success: true, retryAfterSeconds: 0 };
  }

  try {
    const result = await limiter.limit(key);
    if (result.success) return { success: true, retryAfterSeconds: 0 };

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return { success: false, retryAfterSeconds };
  } catch (err) {
    tripCircuit();
    console.warn("[ratelimit] Redis unavailable, tripling circuit breaker:", err);
    if (isAuth) {
      return checkMemoryLimiter(key, AUTH_LIMIT_TOKENS);
    }
    return { success: true, retryAfterSeconds: 0 };
  }
}

/**
 * Checks an IP-based rate limit for authentication endpoints.
 */
export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(authLimiter, `auth:${ip}`);
}
