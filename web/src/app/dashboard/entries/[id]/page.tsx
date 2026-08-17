import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { EntryActions } from "@/components/entry-actions";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

const CODE_TYPES = new Set(["snippet", "error"]);

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const entry = await prisma.entry.findFirst({
    where: { id, userId: user.id },
    include: { entryTags: { include: { tag: true } } },
  });

  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{entry.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {entry.type}
            </Badge>
            {entry.language && <Badge variant="outline">{entry.language}</Badge>}
            {entry.embeddingStatus === "failed" && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle className="size-3" />
                AI search unavailable
              </Badge>
            )}
            {entry.entryTags.map(({ tag }) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
        <EntryActions entryId={entry.id} embeddingStatus={entry.embeddingStatus} />
      </div>

      {entry.sourceUrl && (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 block text-sm text-blue-500 hover:underline"
        >
          {entry.sourceUrl}
        </a>
      )}

      {CODE_TYPES.has(entry.type) ? (
        <CodeBlock code={entry.content} language={entry.language ?? "text"} />
      ) : (
        <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm">
          {entry.content}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Saved {entry.createdAt.toLocaleString()}
      </p>
    </div>
  );
}
