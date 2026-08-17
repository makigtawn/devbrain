"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export default function CollectionsPage() {
  const utils = api.useUtils();
  const { data: collections, isLoading } = api.collections.list.useQuery();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const createCollection = api.collections.create.useMutation({
    onSuccess: async () => {
      await utils.collections.list.invalidate();
      setOpen(false);
      setName("");
      toast.success("Collection created");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New collection</DialogTitle>
            </DialogHeader>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Collection name"
              autoFocus
            />
            <DialogFooter>
              <Button
                onClick={() => createCollection.mutate({ name })}
                disabled={!name.trim() || createCollection.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !collections || collections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Collections are like folders for grouping related entries.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link key={c.id} href={`/dashboard/collections/${c.id}`}>
              <Card className="h-full transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">{c.name}</CardTitle>
                  </div>
                  <CardDescription>
                    {c._count.collectionEntries} entries
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
