type PostgresErrorShape = { code?: string; constraint_name?: string };

/**
 * postgres.js surfaces the raw Postgres error code/constraint name directly
 * on the error it throws, but drizzle-orm wraps that in a `DrizzleQueryError`
 * whose `.cause` is the original postgres.js error — the code/constraint
 * live one level down via `.cause`, not on the error drizzle actually throws.
 */
function pgErrorOf(err: unknown): (Error & PostgresErrorShape) | null {
  if (!(err instanceof Error)) return null;
  const shaped = err as Error & PostgresErrorShape;
  if (shaped.code) return shaped;
  if (shaped.cause instanceof Error) return shaped.cause as Error & PostgresErrorShape;
  return null;
}

export function isUniqueViolation(err: unknown, constraintName?: string): boolean {
  const pgError = pgErrorOf(err);
  if (!pgError || pgError.code !== "23505") return false;
  return !constraintName || pgError.constraint_name === constraintName;
}

/** Postgres raises 23503 when a restricted foreign key would be violated (e.g. deleting a category with products). */
export function isForeignKeyViolation(err: unknown, constraintName?: string): boolean {
  const pgError = pgErrorOf(err);
  if (!pgError || pgError.code !== "23503") return false;
  return !constraintName || pgError.constraint_name === constraintName;
}

/** Postgres raises 23514 when a CHECK constraint would be violated (e.g. stock going negative). */
export function isCheckViolation(err: unknown, constraintName?: string): boolean {
  const pgError = pgErrorOf(err);
  if (!pgError || pgError.code !== "23514") return false;
  return !constraintName || pgError.constraint_name === constraintName;
}
