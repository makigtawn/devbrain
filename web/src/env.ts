import { z } from "zod";

/**
 * Startup environment validation.
 *
 * This module deliberately exports no values — only a `validateEnv()` that throws.
 * Keeping it value-free means it can never be pulled into a client bundle carrying
 * `DATABASE_URL` or `GEMINI_API_KEY` with it. App code keeps reading `process.env.*`
 * directly; this just guarantees a misconfigured deploy dies at build/boot with a
 * readable message instead of at the first request with a stack trace from `pg`.
 *
 * It runs twice: once from `next.config.ts` (build time, so a bad Vercel env config
 * fails the build) and once from `instrumentation.ts` (server boot, so runtime-only
 * vars are checked on the machine that actually serves traffic).
 *
 * Every `NEXT_PUBLIC_*` var must be referenced as a literal `process.env.NEXT_PUBLIC_X`
 * expression below — Next.js inlines those statically, and a dynamic `process.env[key]`
 * lookup would read `undefined` in any client-side context.
 */

/** Vars the app cannot start without. */
const requiredSchema = z.object({
  DATABASE_URL: z
    .string({ error: "missing — Postgres connection string" })
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "must be a postgres:// or postgresql:// URL",
    ),
  JWT_SECRET: z
    .string({ error: "missing — JWT secret key" })
    .min(16, "must be at least 16 characters long")
    .optional()
    .default("devbrain-default-jwt-secret-key-change-in-production-min-32-bytes"),
});

/** Vars that are optional, but must be well-formed when present. */
const optionalSchema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.url("must be a full URL, e.g. https://devbrain.app").optional(),
});

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readEnv() {
  return {
    DATABASE_URL: present(process.env.DATABASE_URL),
    JWT_SECRET: present(process.env.JWT_SECRET),
    GEMINI_API_KEY: present(process.env.GEMINI_API_KEY),
    UPSTASH_REDIS_REST_URL: present(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: present(process.env.UPSTASH_REDIS_REST_TOKEN),
    NEXT_PUBLIC_SITE_URL: present(process.env.NEXT_PUBLIC_SITE_URL),
  };
}

/**
 * Things that are fine locally but are almost certainly a mistake in production.
 * These warn rather than throw: each one has a documented graceful degradation
 * (heuristic tagging without Gemini, fail-open rate limiting without Upstash), so
 * blocking a deploy over them would be wrong. They are loud on purpose.
 */
function productionWarnings(env: ReturnType<typeof readEnv>): string[] {
  const warnings: string[] = [];

  if (!env.GEMINI_API_KEY) {
    warnings.push(
      "GEMINI_API_KEY is not set — auto-tagging falls back to heuristics and semantic " +
        "search is disabled (keyword search still works).",
    );
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not both set — rate limiting " +
        "is disabled (fail-open). Every authenticated user can spend your Gemini quota freely.",
    );
  }

  if (!env.NEXT_PUBLIC_SITE_URL) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL is not set — OG/metadata URLs fall back to http://localhost:3000, " +
        "and password-reset links break for any request without an Origin header.",
    );
  }

  if (env.DATABASE_URL?.includes("localhost")) {
    warnings.push("DATABASE_URL points at localhost — that is not reachable from a deployed app.");
  }

  // Supabase's transaction-mode pooler (port 6543) is what src/server/db.ts's pool sizing
  // assumes. Direct connections (5432) run out of Postgres connections under serverless fan-out.
  if (env.DATABASE_URL?.includes("supabase") && !env.DATABASE_URL.includes(":6543")) {
    warnings.push(
      "DATABASE_URL looks like a direct Supabase connection — use the transaction-mode " +
        "pooler (port 6543) for serverless deploys.",
    );
  }

  return warnings;
}

export function validateEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION) return;

  const env = readEnv();
  const result = requiredSchema.safeParse(env);
  const optionalResult = optionalSchema.safeParse(env);

  const issues = [
    ...(result.success ? [] : result.error.issues),
    ...(optionalResult.success ? [] : optionalResult.error.issues),
  ];

  if (issues.length > 0) {
    const lines = issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `Invalid environment variables:\n${lines.join("\n")}\n\n` +
        `See the .env block under "Setup" in README.md for the full list. ` +
        `Set SKIP_ENV_VALIDATION=1 to bypass ` +
        `(only for builds that genuinely have no runtime config, e.g. a Docker image layer).`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    for (const warning of productionWarnings(env)) {
      console.warn(`[env] ${warning}`);
    }
  }
}
