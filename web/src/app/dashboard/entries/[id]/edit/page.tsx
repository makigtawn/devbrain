import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { notFound } from "next/navigation";
import { EditEntryForm } from "./edit-entry-form";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const entry = await prisma.entry.findFirst({
    where: { id, userId: user.id },
  });

  if (!entry) notFound();

  return <EditEntryForm entry={entry} />;
}
