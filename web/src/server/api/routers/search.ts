import { z } from "zod";
import { createTRPCRouter, rateLimitedProcedure } from "@/server/api/trpc";
import { embedText } from "@/server/gemini";
import { searchLimiter } from "@/lib/ratelimit";

interface SemanticRow {
  id: string;
  similarity: number;
}

export const searchRouter = createTRPCRouter({
  query: rateLimitedProcedure(searchLimiter)
    .input(
      z.object({
        q: z.string().min(1).max(500),
        limit: z.number().min(1).max(50).default(20),
        logSearch: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { q, limit, logSearch } = input;

      const [keywordMatches, embedding] = await Promise.all([
        ctx.prisma.entry.findMany({
          where: {
            userId: ctx.userId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
            ],
          },
          include: { entryTags: { include: { tag: true } } },
          take: limit * 2,
          orderBy: { createdAt: "desc" },
        }),
        embedText(q, { cache: true }),
      ]);

      const scores = new Map<string, number>();
      for (const entry of keywordMatches) {
        scores.set(entry.id, 0.5);
      }

      let semanticRows: SemanticRow[] = [];
      if (embedding) {
        const literal = `[${embedding.join(",")}]`;
        semanticRows = await ctx.prisma.$queryRaw<SemanticRow[]>`
          SELECT id, 1 - (embedding <=> ${literal}::vector) AS similarity
          FROM "entries"
          WHERE "user_id" = ${ctx.userId} AND embedding IS NOT NULL
          ORDER BY embedding <=> ${literal}::vector
          LIMIT ${limit * 2}
        `;
      }

      for (const row of semanticRows) {
        const prior = scores.get(row.id) ?? 0;
        scores.set(row.id, prior + Number(row.similarity) * 0.8);
      }

      const rankedIds = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      if (rankedIds.length === 0) {
        if (logSearch) {
          ctx.prisma.searchLog
            .create({
              data: { userId: ctx.userId, query: q, resultsCount: 0 },
            })
            .catch(() => {});
        }
        return [];
      }

      const entryMap = new Map(keywordMatches.map((e) => [e.id, e]));
      const missingIds = rankedIds.filter((id) => !entryMap.has(id));
      if (missingIds.length > 0) {
        const extra = await ctx.prisma.entry.findMany({
          where: { id: { in: missingIds }, userId: ctx.userId },
          include: { entryTags: { include: { tag: true } } },
        });
        for (const e of extra) entryMap.set(e.id, e);
      }

      const results = rankedIds
        .map((id) => entryMap.get(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e));

      if (logSearch) {
        ctx.prisma.searchLog
          .create({
            data: { userId: ctx.userId, query: q, resultsCount: results.length },
          })
          .catch(() => {});
      }

      return results;
    }),
});
