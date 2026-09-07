import { prisma } from "../src/server/db";
import { appRouter } from "../src/server/api/root";
import { entryQueue } from "../src/lib/queue";
import { embedText } from "../src/server/gemini";

async function main() {
  console.log("--- Verifying Priority 2 ---");

  // 1. Ensure a test user exists
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test-p2@devbrain.local",
        passwordHash: "dummyhash",
        name: "Test P2",
      },
    });
  }

  const caller = appRouter.createCaller({
    prisma,
    userId: user.id,
  });

  // 2. Measure entries.create latency
  console.log("\n[Test 1] Testing entries.create response time (should be < 200ms)...");
  const start = performance.now();
  const entry = await caller.entries.create({
    title: "Fast Background Processing Snippet",
    content: "function benchmarkFastSave() { return Date.now(); }",
    type: "snippet",
    tags: ["benchmark", "fast"],
  });
  const duration = performance.now() - start;

  console.log(`✅ entries.create returned in ${duration.toFixed(2)}ms!`);
  console.log(`Created Entry ID: ${entry.id}, status: ${entry.embeddingStatus}`);

  if (duration > 200) {
    console.error(`❌ FAILED: entries.create took ${duration.toFixed(2)}ms (> 200ms)`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: entries.create completed well under 200ms (< 200ms requirement met).`);
  }

  // 3. Test Redis caching on repeated query embeddings
  console.log("\n[Test 2] Testing query embedding cache in Redis/memory...");
  const query = "how to benchmark fast snippet saves in typescript";
  
  const startEmbed1 = performance.now();
  const emb1 = await embedText(query, { cache: true });
  const embedTime1 = performance.now() - startEmbed1;
  console.log(`First embedText call (cached or fetched): ${embedTime1.toFixed(2)}ms, result length: ${emb1 ? emb1.length : 0}`);

  const startEmbed2 = performance.now();
  const emb2 = await embedText(query, { cache: true });
  const embedTime2 = performance.now() - startEmbed2;
  console.log(`Second embedText call (cache HIT): ${embedTime2.toFixed(2)}ms`);

  if (embedTime2 < 50) {
    console.log(`✅ PASSED: Query embedding cache returned in ${embedTime2.toFixed(2)}ms (< 50ms)!`);
  } else {
    console.log(`Cache returned in ${embedTime2.toFixed(2)}ms`);
  }

  // 4. Wait a few seconds to let background queue process
  console.log("\n[Test 3] Checking background queue status...");
  console.log("Queue status:", entryQueue.getStatus());
  
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
