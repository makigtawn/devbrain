"use client";

import { use } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { EntryCard } from "@/components/entry-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: collection, isLoading } = api.collections.getById.useQuery({ id });

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/dashboard/collections"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Collections
      </Link>

      {isLoading ? (
        <Skeleton className="mb-6 h-8 w-48" />
      ) : (
        <h1 className="mb-6 text-2xl font-semibold">{collection?.name}</h1>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !collection || collection.collectionEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No entries in this collection yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collection.collectionEntries.map(({ entry }) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
