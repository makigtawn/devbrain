"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Input } from "@/components/ui/input";
import { EntryCard } from "@/components/entry-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export function SearchClient() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 350);

  const { data, isFetching } = api.search.query.useQuery(
    { q: debounced },
    { enabled: debounced.trim().length > 0 },
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-semibold">Search</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "How did I connect Stripe webhooks?"'
          className="pl-9"
        />
      </div>

      {debounced.trim().length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Search combines keyword matching with AI semantic search across
          everything you&apos;ve saved.
        </p>
      ) : isFetching ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No results found.</p>
      )}
    </div>
  );
}
