"use client";

import { api } from "@/trpc/react";
import { EntryCard } from "@/components/entry-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const TYPES = ["all", "snippet", "note", "error", "link", "doc"] as const;
type TypeFilter = (typeof TYPES)[number];

export function DashboardClient() {
  const [type, setType] = useState<TypeFilter>("all");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.entries.list.useInfiniteQuery(
      { type: type === "all" ? undefined : type, limit: 24 },
      { getNextPageParam: (last) => last.nextCursor },
    );

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All entries</h1>
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as TypeFilter)} className="mb-6">
        <TabsList>
          {TYPES.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Nothing here yet. Save your first snippet, note, or error to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
