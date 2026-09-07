import { prisma } from "@/server/db";
import { autoTagEntry, embedText } from "@/server/gemini";

export interface EntryJob {
  entryId: string;
  userId: string;
  title: string;
  content: string;
  existingTags?: string[];
  retries?: number;
}

const MAX_CONCURRENCY = 2;
const MAX_RETRIES = 3;

class EntryQueue {
  private queue: EntryJob[] = [];
  private activeCount = 0;

  public enqueue(job: EntryJob) {
    this.queue.push({ ...job, retries: job.retries ?? 0 });
    this.processNext();
  }

  private async processNext() {
    if (this.activeCount >= MAX_CONCURRENCY || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeCount++;

    try {
      await this.processJob(job);
    } catch (err) {
      console.error(`[queue] Error processing entry ${job.entryId}:`, err);
      if ((job.retries ?? 0) < MAX_RETRIES) {
        const delay = Math.pow(2, job.retries ?? 0) * 1000;
        setTimeout(() => {
          this.enqueue({ ...job, retries: (job.retries ?? 0) + 1 });
        }, delay);
      } else {
        await prisma.entry.update({
          where: { id: job.entryId },
          data: { embeddingStatus: "failed" },
        }).catch(() => {});
      }
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  private async processJob(job: EntryJob) {
    const { entryId, userId, title, content, existingTags = [] } = job;

    // 1. Run Gemini autoTagging in background
    const auto = await autoTagEntry(title, content);

    // 2. Combine and batch upsert any new tags discovered by AI
    const allTags = [
      ...new Set([...existingTags, ...auto.tags]),
    ].map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean);

    if (allTags.length > 0) {
      const tags = await Promise.all(
        allTags.map((name) =>
          prisma.tag.upsert({
            where: { userId_name: { userId, name } },
            update: { count: { increment: 1 } },
            create: { userId, name, count: 1 },
          })
        )
      );

      await Promise.all(
        tags.map((tag) =>
          prisma.entryTag.upsert({
            where: { entryId_tagId: { entryId, tagId: tag.id } },
            update: {},
            create: { entryId, tagId: tag.id },
          })
        )
      );
    }

    // 3. Update entry summary, type, language if not explicitly specified
    await prisma.entry.update({
      where: { id: entryId },
      data: {
        type: auto.type,
        ...(auto.language ? { language: auto.language } : {}),
      },
    }).catch(() => {});

    // 4. Generate and store vector embedding
    const embedding = await embedText(`${title}\n${content}`);
    if (embedding) {
      const literal = `[${embedding.join(",")}]`;
      await prisma.$executeRaw`UPDATE "entries" SET embedding = ${literal}::vector, embedding_status = 'success' WHERE id = ${entryId}`;
    } else {
      await prisma.entry.update({
        where: { id: entryId },
        data: { embeddingStatus: "failed" },
      }).catch(() => {});
    }
  }

  public getStatus() {
    return {
      pending: this.queue.length,
      active: this.activeCount,
    };
  }
}

const globalForQueue = globalThis as unknown as {
  entryQueue: EntryQueue | undefined;
};

export const entryQueue = globalForQueue.entryQueue ?? new EntryQueue();

if (process.env.NODE_ENV !== "production") {
  globalForQueue.entryQueue = entryQueue;
}
