import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import { redis } from "@/lib/redis";

let client: GoogleGenAI | null = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;

const memoryEmbeddingCache = new Map<string, { embedding: number[]; expires: number }>();
const CACHE_TTL_SECONDS = 86400; // 24 hours

export interface EmbedOptions {
  cache?: boolean;
}

/**
 * Returns a 1536-dim embedding, or null if no Gemini key is configured or
 * the API call fails.
 * If options.cache is true, checks and populates Redis and in-memory caches.
 */
export async function embedText(
  text: string,
  options?: EmbedOptions,
): Promise<number[] | null> {
  const shouldCache = Boolean(options?.cache);
  const normalized = text.trim().toLowerCase();
  const cacheKey = `devbrain:cache:embed:${crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex")}`;

  if (shouldCache) {
    const mem = memoryEmbeddingCache.get(cacheKey);
    if (mem && mem.expires > Date.now()) {
      return mem.embedding;
    }

    if (redis) {
      try {
        const cached = await redis.get<number[]>(cacheKey);
        if (cached && Array.isArray(cached)) {
          memoryEmbeddingCache.set(cacheKey, {
            embedding: cached,
            expires: Date.now() + CACHE_TTL_SECONDS * 1000,
          });
          return cached;
        }
      } catch (err) {
        console.warn("[gemini] Redis cache read failed:", err);
      }
    }
  }

  const ai = getClient();
  if (!ai) return null;

  try {
    const res = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.slice(0, 8000),
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });

    const values = res.embeddings?.[0]?.values ?? null;

    if (values && shouldCache) {
      memoryEmbeddingCache.set(cacheKey, {
        embedding: values,
        expires: Date.now() + CACHE_TTL_SECONDS * 1000,
      });
      if (memoryEmbeddingCache.size > 1000) {
        const firstKey = memoryEmbeddingCache.keys().next().value;
        if (firstKey) memoryEmbeddingCache.delete(firstKey);
      }

      if (redis) {
        redis.set(cacheKey, values, { ex: CACHE_TTL_SECONDS }).catch((err) => {
          console.warn("[gemini] Redis cache write failed:", err);
        });
      }
    }

    return values;
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

export function heuristicAutoTag(title: string, content: string): AutoTagResult {
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
