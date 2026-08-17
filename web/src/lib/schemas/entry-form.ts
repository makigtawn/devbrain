import { z } from "zod";

export const MAX_TITLE_LENGTH = 300;
export const MAX_CONTENT_LENGTH = 50000;

/** "auto" is a UI-only sentinel meaning "let Gemini classify it" — the create mutation
 *  omits `type` entirely when it sees this value. */
export const ENTRY_TYPE_OPTIONS = ["auto", "snippet", "note", "error", "link", "doc"] as const;
export const entryFormTypeEnum = z.enum(ENTRY_TYPE_OPTIONS);

export const entryFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(MAX_TITLE_LENGTH, `Title must be under ${MAX_TITLE_LENGTH} characters`),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(MAX_CONTENT_LENGTH, "Content exceeds 50,000 character limit"),
  type: entryFormTypeEnum,
  language: z.string().optional(),
  tags: z.string().optional(),
});

export type EntryFormValues = z.infer<typeof entryFormSchema>;

/** Same rules, minus the "auto" sentinel and tags string — used by the edit form, which
 *  edits an existing (already-classified) entry and doesn't touch tags. */
export const editEntryFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(MAX_TITLE_LENGTH, `Title must be under ${MAX_TITLE_LENGTH} characters`),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(MAX_CONTENT_LENGTH, "Content exceeds 50,000 character limit"),
  type: z.enum(["snippet", "note", "error", "link", "doc"]),
  language: z.string().optional(),
});

export type EditEntryFormValues = z.infer<typeof editEntryFormSchema>;
