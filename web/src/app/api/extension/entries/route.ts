import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { autoTagEntry, embedText } from "@/server/gemini";
import { checkRateLimit, entryWriteLimiter } from "@/lib/ratelimit";
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "@/lib/schemas/entry-form";
import { verifyAccessToken } from "@/lib/auth/jwt";

const bodySchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  sourceUrl: z.string().url().optional(),
});

async function getUserFromBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  const payload = await verifyAccessToken(token);
  if (!payload?.sub) return null;

  return { id: payload.sub, email: payload.email };
}

/** Save-from-anywhere endpoint used by the browser extension. */
export async function POST(request: NextRequest) {
  const jwtUser = await getUserFromBearerToken(request);
  if (!jwtUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(entryWriteLimiter, jwtUser.id);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests, please slow down." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, content, sourceUrl } = parsed.data;

  let user = await prisma.user.findUnique({
    where: { id: jwtUser.id },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: jwtUser.email },
    });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const auto = await autoTagEntry(title, content);

  const entry = await prisma.entry.create({
    data: {
      userId: user.id,
      title,
      content,
      type: auto.type,
      language: auto.language,
      sourceUrl,
    },
  });

  for (const rawName of [...new Set(auto.tags)]) {
    const name = rawName.trim().toLowerCase().slice(0, 40);
    if (!name) continue;
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: { count: { increment: 1 } },
      create: { userId: user.id, name, count: 1 },
    });
    await prisma.entryTag.create({ data: { entryId: entry.id, tagId: tag.id } });
  }

  const embedding = await embedText(`${title}\n${content}`);
  if (embedding) {
    const literal = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`UPDATE "entries" SET embedding = ${literal}::vector WHERE id = ${entry.id}`;
  }

  return NextResponse.json({ id: entry.id }, { status: 201 });
}
