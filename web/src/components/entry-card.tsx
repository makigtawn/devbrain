import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileCode2, StickyNote, AlertTriangle, Link2, FileText } from "lucide-react";

const TYPE_META = {
  snippet: { icon: FileCode2, label: "Snippet" },
  note: { icon: StickyNote, label: "Note" },
  error: { icon: AlertTriangle, label: "Error" },
  link: { icon: Link2, label: "Link" },
  doc: { icon: FileText, label: "Doc" },
} as const;

interface EntryCardEntry {
  id: string;
  title: string;
  content: string;
  type: keyof typeof TYPE_META;
  language: string | null;
  embeddingStatus: "pending" | "success" | "failed";
  createdAt: Date | string;
  entryTags: { tag: { id: string; name: string; color: string } }[];
}

export function EntryCard({ entry }: { entry: EntryCardEntry }) {
  const meta = TYPE_META[entry.type] ?? TYPE_META.note;
  const Icon = meta.icon;

  return (
    <Link href={`/dashboard/entries/${entry.id}`}>
      <Card className="h-full transition-colors hover:border-foreground/30">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <h3 className="line-clamp-1 font-medium">{entry.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {entry.embeddingStatus === "failed" && (
              <AlertTriangle className="size-4 text-amber-500">
                <title>AI search unavailable for this entry</title>
              </AlertTriangle>
            )}
            {entry.language && (
              <Badge variant="secondary">{entry.language}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {entry.content}
          </p>
          {entry.entryTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {entry.entryTags.slice(0, 5).map(({ tag }) => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
