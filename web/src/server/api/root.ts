import { createTRPCRouter } from "@/server/api/trpc";
import { entriesRouter } from "@/server/api/routers/entries";
import { tagsRouter } from "@/server/api/routers/tags";
import { collectionsRouter } from "@/server/api/routers/collections";
import { searchRouter } from "@/server/api/routers/search";

export const appRouter = createTRPCRouter({
  entries: entriesRouter,
  tags: tagsRouter,
  collections: collectionsRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
