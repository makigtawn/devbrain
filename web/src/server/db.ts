import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function getPoolConfig() {
  const urlStr = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/devbrain";
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      user: parsed.username || "postgres",
      password: parsed.password || "password",
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : "devbrain",
      max: 1,
      idleTimeoutMillis: 10_000,
    };
  } catch {
    return {
      connectionString: urlStr,
      max: 1,
      idleTimeoutMillis: 10_000,
    };
  }
}

const pool = new Pool(getPoolConfig());
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
