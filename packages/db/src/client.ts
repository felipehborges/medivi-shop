import "./lib/load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// `MEDIVI_DATABASE_URL` lets the hosted app use its own managed database
// without affecting a developer's local `DATABASE_URL` setup.
const connectionString = process.env.MEDIVI_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("MEDIVI_DATABASE_URL or DATABASE_URL is not set");
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;
