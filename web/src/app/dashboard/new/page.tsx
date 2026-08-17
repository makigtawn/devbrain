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
  entryFormSchema,
  ENTRY_TYPE_OPTIONS,
  MAX_CONTENT_LENGTH,
  type EntryFormValues,
} from "@/lib/schemas/entry-form";

export default function NewEntryPage() {
  const router = useRouter();
  const utils = api.useUtils();

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "auto",
      language: "",
      tags: "",
    },
  });

  const contentLength = form.watch("content")?.length ?? 0;
  const isNearLimit = contentLength > MAX_CONTENT_LENGTH * 0.9;
  const isOverLimit = contentLength > MAX_CONTENT_LENGTH;

  const createEntry = api.entries.create.useMutation({
    onSuccess: async (entry) => {
      await utils.entries.list.invalidate();
      toast.success("Entry saved - AI is tagging it now");
      router.push(`/dashboard/entries/${entry.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(values: EntryFormValues) {
    createEntry.mutate({
      title: values.title,
      content: values.content,
      type: values.type === "auto" ? undefined : values.type,
      language: values.language || undefined,
      tags: (values.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New entry</CardTitle>
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
                      <Input
                        placeholder="How to connect Stripe webhooks"
                        {...field}
                      />
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
                      <Textarea
                        placeholder="Paste a snippet, error log, note, or link..."
                        className="min-h-48 font-mono text-sm"
                        {...field}
                      />
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
                          {ENTRY_TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t} className="capitalize">
                              {t === "auto" ? "Auto-detect" : t}
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

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (comma-separated, optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="stripe, webhooks, payments" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending ? "Saving..." : "Save entry"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
