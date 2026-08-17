"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function TagsPage() {
  const { data: tags, isLoading } = api.tags.list.useQuery();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold">Tags</h1>

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      ) : !tags || tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tags are created automatically by AI when you save entries.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link key={tag.id} href={`/dashboard?tagId=${tag.id}`}>
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 text-sm"
                style={{ borderColor: tag.color }}
              >
                {tag.name}
                <span className="text-muted-foreground">{tag.count}</span>
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
