import { customType } from "drizzle-orm/pg-core";

/**
 * drizzle-orm's pg-core doesn't have a built-in `tsvector` type (only the
 * pgvector `vector` family) as of 0.45 — this is a thin wrapper so schema
 * files can still declare a generated tsvector column.
 */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});
