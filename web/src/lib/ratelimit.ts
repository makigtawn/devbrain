import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstashEnv =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstashEnv
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

if (!hasUpstashEnv) {
  console.warn(
    "[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — " +
      "rate limiting is disabled (fail-open). Set both env vars before deploying to production.",
  );
}

function makeLimiter(prefix: string, tokens: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `devbrain:ratelimit:${prefix}`,
    analytics: true,
  });
}

/** 20 writes/min/user — covers entries.create and entries.update, both of which call Gemini. */
export const entryWriteLimiter = makeLimiter("entry-write", 20, "1 m");

/** 20 searches/min/user — search.query embeds the query text via Gemini on every call. */
export const searchLimiter = makeLimiter("search", 20, "1 m");

export interface RateLimitResult {
  success: boolean;
  /** Seconds the caller should wait before retrying. Only meaningful when success is false. */
  retryAfterSeconds: number;
}

/**
 * Checks a rate limit bucket for a given key (always the authenticated userId — never IP,
 * since every caller here is already authenticated).
 *
 * Fails OPEN when Upstash isn't configured (e.g. local dev without a Redis instance) so the
 * app keeps working without it; fails CLOSED (blocks) only when Upstash is reachable and the
 * limit is actually exceeded.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<RateLimitResult> {
  if (!limiter) return { success: true, retryAfterSeconds: 0 };

  const result = await limiter.limit(key);
  if (result.success) return { success: true, retryAfterSeconds: 0 };

  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return { success: false, retryAfterSeconds };
}
