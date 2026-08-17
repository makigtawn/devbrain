"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, TRPCClientError } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";
import { toast } from "sonner";
import type { AppRouter } from "@/server/api/root";

export const api = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Any 429 (TOO_MANY_REQUESTS) from the API gets a toast here, regardless of which query or
 * mutation triggered it — this is the single place that turns a rate-limit rejection into
 * user-visible feedback instead of a silent failure. Per-call onError handlers can still run
 * afterward for query/mutation-specific UI.
 */
function notifyIfRateLimited(error: unknown) {
  if (
    error instanceof TRPCClientError &&
    error.data?.code === "TOO_MANY_REQUESTS"
  ) {
    toast.error("Too many requests, please slow down.");
  }
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: notifyIfRateLimited,
        }),
        mutationCache: new MutationCache({
          onError: notifyIfRateLimited,
        }),
      }),
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}
