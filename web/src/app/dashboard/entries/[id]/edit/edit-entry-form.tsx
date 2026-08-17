"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  editEntryFormSchema,
  MAX_CONTENT_LENGTH,
  type EditEntryFormValues,
} from "@/lib/schemas/entry-form";

const TYPES = ["snippet", "note", "error", "link", "doc"] as const;

export function EditEntryForm({
  entry,
}: {
  entry: {
    id: string;
    title: string;
    content: string;
    type: (typeof TYPES)[number];
    language: string | null;
  };
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const form = useForm<EditEntryFormValues>({
    resolver: zodResolver(editEntryFormSchema),
    defaultValues: {
      title: entry.title,
      content: entry.content,
      type: entry.type,
      language: entry.language ?? "",
    },
  });

  const contentLength = form.watch("content")?.length ?? 0;
  const isNearLimit = contentLength > MAX_CONTENT_LENGTH * 0.9;
  const isOverLimit = contentLength > MAX_CONTENT_LENGTH;

  const updateEntry = api.entries.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.entries.list.invalidate(),
        utils.entries.getById.invalidate({ id: entry.id }),
      ]);
      toast.success("Entry updated");
      router.push(`/dashboard/entries/${entry.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: EditEntryFormValues) {
    updateEntry.mutate({
      id: entry.id,
      title: values.title,
      content: values.content,
      type: values.type,
      language: values.language || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit entry</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Content</FormLabel>
                      <span
                        className={cn(
                          "text-xs tabular-nums text-muted-foreground",
                          isNearLimit && "text-amber-500",
                          isOverLimit && "text-destructive",
                        )}
                      >
                        {contentLength.toLocaleString()} /{" "}
                        {MAX_CONTENT_LENGTH.toLocaleString()}
                      </span>
                    </div>
                    <FormControl>
                      <Textarea className="min-h-48 font-mono text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="capitalize">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="typescript" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={updateEntry.isPending}>
                  {updateEntry.isPending ? "Saving..." : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/entries/${entry.id}`)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
