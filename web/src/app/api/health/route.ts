import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Liveness + database readiness, for uptime monitors and platform health checks.
 *
 * Unauthenticated on purpose, so it must not leak anything an attacker can use: no version
 * strings, no connection details, no error text from the driver. Just up/down and latency.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    // Full detail to the server log, nothing to the caller.
    console.error("[health] database check failed:", err);
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "ok", database: "ok", latencyMs: Date.now() - startedAt },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
