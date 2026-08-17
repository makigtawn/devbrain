"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function EntryActions({
  entryId,
  embeddingStatus,
}: {
  entryId: string;
  embeddingStatus: "pending" | "success" | "failed";
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const deleteEntry = api.entries.delete.useMutation({
    onSuccess: async () => {
      await utils.entries.list.invalidate();
      toast.success("Entry deleted");
      router.push("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const retryEmbedding = api.entries.retryEmbedding.useMutation({
    onSuccess: async (result) => {
      await utils.entries.list.invalidate();
      if (result.embeddingStatus === "success") {
        toast.success("Embedding regenerated — this entry is searchable again");
      } else {
        toast.error("Retry failed again. AI search is still unavailable for this entry.");
      }
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex items-center gap-2">
      {embeddingStatus === "failed" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => retryEmbedding.mutate({ id: entryId })}
          disabled={retryEmbedding.isPending}
        >
          <RefreshCw className="size-4" />
          {retryEmbedding.isPending ? "Retrying..." : "Retry embedding"}
        </Button>
      )}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/entries/${entryId}/edit`}>
          <Pencil className="size-4" />
          Edit
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (confirm("Delete this entry? This can't be undone.")) {
            deleteEntry.mutate({ id: entryId });
          }
        }}
        disabled={deleteEntry.isPending}
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
    </div>
  );
}
