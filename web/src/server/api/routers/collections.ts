import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const collectionsRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const collection = await ctx.prisma.collection.findFirst({
        where: { id: input.id, userId: ctx.userId },
        include: {
          collectionEntries: {
            include: {
              entry: { include: { entryTags: { include: { tag: true } } } },
            },
          },
        },
      });
      if (!collection) throw new TRPCError({ code: "NOT_FOUND" });
      return collection;
    }),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.collection.findMany({
      where: { userId: ctx.userId },
      include: { _count: { select: { collectionEntries: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.collection.create({
        data: { ...input, userId: ctx.userId },
      }),
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.collection.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  addEntry: protectedProcedure
    .input(z.object({ collectionId: z.string(), entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [collection, entry] = await Promise.all([
        ctx.prisma.collection.findFirst({
          where: { id: input.collectionId, userId: ctx.userId },
        }),
        ctx.prisma.entry.findFirst({
          where: { id: input.entryId, userId: ctx.userId },
        }),
      ]);
      if (!collection || !entry) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.collectionEntry.upsert({
        where: {
          collectionId_entryId: {
            collectionId: input.collectionId,
            entryId: input.entryId,
          },
        },
        update: {},
        create: input,
      });
      return { success: true };
    }),

  removeEntry: protectedProcedure
    .input(z.object({ collectionId: z.string(), entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.collectionEntry.deleteMany({
        where: {
          collectionId: input.collectionId,
          entryId: input.entryId,
          collection: { userId: ctx.userId },
        },
      });
      return { success: true };
    }),
});
