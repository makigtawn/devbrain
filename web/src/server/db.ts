import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function getPoolConfig() {
  const urlStr = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/devbrain";
  const max = parseInt(process.env.DB_POOL_MAX || "20", 10);
  const idleTimeoutMillis = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "30000", 10);
  const connectionTimeoutMillis = parseInt(process.env.DB_POOL_CONN_TIMEOUT || "5000", 10);

  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      user: parsed.username || "postgres",
      password: parsed.password || "password",
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : "devbrain",
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    };
  } catch {
    return {
      connectionString: urlStr,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
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
