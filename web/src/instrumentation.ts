import { validateEnv } from "@/env";

/**
 * Runs once per server instance before the first request is served. Validating here (in
 * addition to `next.config.ts`) catches the case where a var is present at build time but
 * missing on the machine actually serving traffic — a stale Vercel env, a forgotten secret
 * in a new environment, a Docker run without `--env-file`.
 */
export function register() {
  validateEnv();
}
