import "../lib/load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import type { Tx } from "../lib/db-client";

const ROLLBACK = Symbol("test-transaction-rollback");

/**
 * Runs `fn` inside a transaction that is always rolled back, even on
 * success, so integration tests can insert/query freely against a real
 * Postgres without leaving data behind or needing a separate test database.
 *
 * Requires DATABASE_URL to point at a disposable instance (the local Docker
 * Postgres from docker/docker-compose.yml is exactly that) — never point
 * this at a shared/production database.
 */
export async function withTestTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: { onQuery?: () => void },
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(connectionString, {
    max: 1,
    debug: options?.onQuery ? () => options.onQuery!() : undefined,
  });
  const db = drizzle(client, { schema, casing: "snake_case" });

  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) {
      throw err;
    }
  } finally {
    await client.end();
  }

  return result as T;
}
