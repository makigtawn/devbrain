async function main() {
  console.log("--- Verifying Priority 4: Auth IP Rate Limiting ---");
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const url = "http://localhost:3005/api/auth/login";

  console.log(`Sending 20 rapid sequential requests (burst delay 50ms) from IP: ${testIp}...`);

  const results: { attempt: number; status: number; durationMs: number }[] = [];

  for (let i = 1; i <= 20; i++) {
    const t0 = performance.now();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": testIp,
      },
      body: JSON.stringify({
        email: "burst-test@devbrain.local",
        password: "wrongpassword123",
      }),
    });
    const durationMs = Math.round(performance.now() - t0);
    results.push({ attempt: i, status: res.status, durationMs });
    console.log(`Request #${i}: Status ${res.status} (${durationMs}ms)`);
  }

  const allowed = results.filter((r) => r.status !== 429);
  const rateLimited = results.filter((r) => r.status === 429);

  console.log(`\nSummary:`);
  console.log(`- Allowed requests: ${allowed.length} (target: 5)`);
  console.log(`- Rate limited (HTTP 429): ${rateLimited.length} (target: 15)`);

  const allAfter5Blocked = results.slice(5).every((r) => r.status === 429);
  const first5Allowed = results.slice(0, 5).every((r) => r.status === 401);

  if (first5Allowed && allAfter5Blocked) {
    console.log("\n✅ PASSED: Requests 1-5 were processed; requests 6-20 were blocked with HTTP 429!");
    process.exit(0);
  } else {
    console.error(`\n❌ FAILED: Unexpected distribution`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
