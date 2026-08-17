import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Ratelimit } from "@upstash/ratelimit";
import { prisma } from "@/server/db";
import { checkRateLimit } from "@/lib/ratelimit";
import { getJWTUser } from "@/server/auth";

export async function createTRPCContext() {
  const jwtUser = await getJWTUser();
  const userId = jwtUser?.sub ?? null;

  return { prisma, userId };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/**
 * Builds a protected procedure that additionally enforces a per-user rate limit before the
 * resolver runs. Rate limit key is always ctx.userId — never IP — since every caller here is
 * already authenticated. On limit exceeded, throws TOO_MANY_REQUESTS, which the tRPC HTTP
 * adapter maps to a 429 response.
 */
export function rateLimitedProcedure(limiter: Ratelimit | null) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const result = await checkRateLimit(limiter, ctx.userId);
    if (!result.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests, please slow down.",
      });
    }
    return next();
  });
}
