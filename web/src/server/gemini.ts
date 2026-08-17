import { GoogleGenAI, Type } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Returns a 1536-dim embedding, or null if no Gemini key is configured or
 * the API call fails — callers must treat null as "skip semantic search for
 * this entry," never as a reason to fail the caller's own operation.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;

  try {
    const res = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.slice(0, 8000),
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });

    return res.embeddings?.[0]?.values ?? null;
  } catch (err) {
    console.error("Gemini embedContent failed:", err);
    return null;
  }
}

export interface AutoTagResult {
  tags: string[];
  summary: string;
  type: "snippet" | "note" | "error" | "link" | "doc";
  language?: string;
}

const autoTagResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
    type: {
      type: Type.STRING,
      enum: ["snippet", "note", "error", "link", "doc"],
    },
    language: { type: Type.STRING, nullable: true },
  },
  required: ["tags", "summary", "type"],
};

/**
 * Uses Gemini to classify and tag a new entry. Falls back to a heuristic
 * classification when no Gemini key is configured OR the API call fails
 * (outage, timeout, rate limit) — a Gemini problem must never fail the
 * entry save itself.
 */
export async function autoTagEntry(
  title: string,
  content: string,
): Promise<AutoTagResult> {
  const ai = getClient();

  if (!ai) {
    return heuristicAutoTag(title, content);
  }

  let raw: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: `Title: ${title}\n\nContent:\n${content.slice(0, 4000)}`,
      config: {
        systemInstruction:
          "You classify and tag developer knowledge-base entries. " +
          "Return 3-6 short lowercase kebab tags, a one-sentence summary, " +
          "the entry type, and the programming language if the content is code (else omit it).",
        responseMimeType: "application/json",
        responseSchema: autoTagResponseSchema,
      },
    });
    raw = response.text;
  } catch (err) {
    console.error("Gemini generateContent failed:", err);
    return heuristicAutoTag(title, content);
  }

  if (!raw) return heuristicAutoTag(title, content);

  try {
    const parsed = JSON.parse(raw);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      type: parsed.type ?? "note",
      language: parsed.language ?? undefined,
    };
  } catch {
    return heuristicAutoTag(title, content);
  }
}

function heuristicAutoTag(title: string, content: string): AutoTagResult {
  const looksLikeCode = /```|function |const |import |class |def |=>/.test(
    content,
  );
  const looksLikeError = /error|exception|traceback|stack trace/i.test(
    title + content,
  );
  const looksLikeLink = /^https?:\/\//.test(content.trim());

  const type: AutoTagResult["type"] = looksLikeLink
    ? "link"
    : looksLikeError
      ? "error"
      : looksLikeCode
        ? "snippet"
        : "note";

  const words = (title + " " + content)
    .toLowerCase()
    .match(/[a-z0-9-]{4,}/g);
  const tags = [...new Set(words ?? [])].slice(0, 5);

  return { tags, summary: title, type };
}
