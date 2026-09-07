import { z } from "zod";
import { createTRPCRouter, protectedProcedure, rateLimitedProcedure } from "@/server/api/trpc";
import { heuristicAutoTag, embedText } from "@/server/gemini";
import { entryWriteLimiter } from "@/lib/ratelimit";
import { entryQueue } from "@/lib/queue";
import { TRPCError } from "@trpc/server";

const writeProcedure = rateLimitedProcedure(entryWriteLimiter);

const entryTypeEnum = z.enum(["snippet", "note", "error", "link", "doc"]);

const MAX_CONTENT_LENGTH = 50000;
const MAX_SOURCE_URL_LENGTH = 500;

const createEntryInput = z.object({
  title: z.string().min(1).max(300),
  content: z
    .string()
    .min(1)
    .max(MAX_CONTENT_LENGTH, "Content must be under 50,000 characters"),
  type: entryTypeEnum.optional(),
  language: z.string().optional(),
  sourceUrl: z
    .string()
    .url()
    .max(MAX_SOURCE_URL_LENGTH, "URL must be under 500 characters")
    .optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

async function upsertTags(
  prisma: typeof import("@/server/db").prisma,
  userId: string,
  entryId: string,
  tagNames: string[],
) {
  const cleaned = [
    ...new Set(
      tagNames
        .map((t) => t.trim().toLowerCase().slice(0, 40))
        .filter(Boolean),
    ),
  ];
  if (cleaned.length === 0) return;

  const tags = await Promise.all(
    cleaned.map((name) =>
      prisma.tag.upsert({
        where: { userId_name: { userId, name } },
        update: { count: { increment: 1 } },
        create: { userId, name, count: 1 },
      })
    )
  );

  await Promise.all(
    tags.map((tag) =>
      prisma.entryTag.upsert({
        where: { entryId_tagId: { entryId, tagId: tag.id } },
        update: {},
        create: { entryId, tagId: tag.id },
      })
    )
  );
}

async function setEmbedding(
  prisma: typeof import("@/server/db").prisma,
  entryId: string,
  content: string,
) {
  const embedding = await embedText(content);
  if (!embedding) {
    await prisma.entry.update({
      where: { id: entryId },
      data: { embeddingStatus: "failed" },
    });
    return;
  }
  const literal = `[${embedding.join(",")}]`;
  await prisma.$executeRaw`UPDATE "entries" SET embedding = ${literal}::vector, embedding_status = 'success' WHERE id = ${entryId}`;
}

export const entriesRouter = createTRPCRouter({
  create: writeProcedure
    .input(createEntryInput)
    .mutation(async ({ ctx, input }) => {
      // Instant heuristic tagging (runs in <1ms)
      const auto = heuristicAutoTag(input.title, input.content);

      const entry = await ctx.prisma.entry.create({
        data: {
          userId: ctx.userId,
          title: input.title,
          content: input.content,
          type: input.type ?? auto.type,
          language: input.language ?? auto.language,
          sourceUrl: input.sourceUrl,
          isPublic: input.isPublic ?? false,
          embeddingStatus: "pending",
        },
      });

      const userTags = input.tags ?? [];
      const initialTags = [...new Set([...userTags, ...auto.tags])];
      if (initialTags.length > 0) {
        await upsertTags(ctx.prisma, ctx.userId, entry.id, initialTags);
      }

      // Enqueue background processing for Gemini AI auto-tagging & vector embedding
      entryQueue.enqueue({
        entryId: entry.id,
        userId: ctx.userId,
        title: input.title,
        content: input.content,
        existingTags: initialTags,
      });

      return entry;
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(300).optional(),
        content: z
          .string()
          .min(1)
          .max(MAX_CONTENT_LENGTH, "Content must be under 50,000 characters")
          .optional(),
        type: entryTypeEnum.optional(),
        language: z.string().optional(),
        sourceUrl: z
          .string()
          .url()
          .max(MAX_SOURCE_URL_LENGTH, "URL must be under 500 characters")
          .optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.entry.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const entry = await ctx.prisma.entry.update({
        where: { id },
        data,
      });

      if (data.title || data.content) {
        await ctx.prisma.entry.update({
          where: { id: entry.id },
          data: { embeddingStatus: "pending" },
        });

        entryQueue.enqueue({
          entryId: entry.id,
          userId: ctx.userId,
          title: entry.title,
          content: entry.content,
        });
      }

      return entry;
    }),

  retryEmbedding: writeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.entry.findFirst({
        where: { id: input.id, userId: ctx.userId },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await setEmbedding(ctx.prisma, entry.id, `${entry.title}\n${entry.content}`);

      return ctx.prisma.entry.findUniqueOrThrow({
        where: { id: entry.id },
        select: { id: true, embeddingStatus: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.entry.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const entry = await ctx.prisma.entry.findFirst({
        where: { id: input.id, userId: ctx.userId },
        include: { entryTags: { include: { tag: true } } },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      return entry;
    }),

  list: protectedProcedure
    .input(
      z.object({
        type: entryTypeEnum.optional(),
        tagId: z.string().optional(),
        collectionId: z.string().optional(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const entries = await ctx.prisma.entry.findMany({
        where: {
          userId: ctx.userId,
          type: input.type,
          entryTags: input.tagId ? { some: { tagId: input.tagId } } : undefined,
          collectionEntries: input.collectionId
            ? { some: { collectionId: input.collectionId } }
            : undefined,
        },
        include: { entryTags: { include: { tag: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (entries.length > input.limit) {
        const next = entries.pop();
        nextCursor = next!.id;
      }

      return { entries, nextCursor };
    }),
});
