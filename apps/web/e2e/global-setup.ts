/**
 * Resets and reseeds the database pointed to by `DATABASE_URL` before the
 * E2E suite runs. Same convention as `packages/db/src/test/index.ts`:
 * `DATABASE_URL` must point at a disposable Postgres instance — this
 * TRUNCATEs real data, unlike vitest's rollback-only transactions, so never
 * point it at anything you'd miss (the local Docker Postgres from
 * docker/docker-compose.yml, or CI's ephemeral service, are exactly right).
 */
async function globalSetup() {
  console.log(`[e2e] seeding database at ${process.env.DATABASE_URL}`);
  const { seedE2eDatabase } = await import("./fixtures/seed");
  await seedE2eDatabase();
  console.log("[e2e] database ready");
}

export default globalSetup;
