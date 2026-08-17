import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const tagsRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.tag.findMany({
      where: { userId: ctx.userId },
      orderBy: { count: "desc" },
    }),
  ),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.tag.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: { name: input.name.toLowerCase().trim() },
      });
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  setColor: protectedProcedure
    .input(z.object({ id: z.string(), color: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tag.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: { color: input.color },
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tag.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),
});
