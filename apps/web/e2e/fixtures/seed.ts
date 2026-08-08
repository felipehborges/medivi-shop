import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { seedCatalog } from "@medivi/db/seed-catalog";
import { account, user } from "@medivi/db/schema";

export const E2E_ADMIN_EMAIL = "e2e-admin@medivi.shop";
export const E2E_CUSTOMER_EMAIL = "e2e-customer@medivi.shop";
export const E2E_PASSWORD = "Password123!";

async function createCredentialUser(opts: {
  id: string;
  name: string;
  email: string;
  role: "admin" | "customer";
}) {
  await db.insert(user).values({
    id: opts.id,
    name: opts.name,
    email: opts.email,
    emailVerified: true,
    role: opts.role,
  });
  await db.insert(account).values({
    id: `${opts.id}-credential`,
    accountId: opts.id,
    providerId: "credential",
    userId: opts.id,
    password: await hashPassword(E2E_PASSWORD),
  });
}

/**
 * Resets the database to a known state for a fresh E2E run: wipes all
 * app tables (CASCADE sweeps everything that FKs into `user`/`category`/
 * the other roots below), then seeds the catalog plus two credentialed,
 * pre-verified accounts so tests can sign in directly instead of working
 * around `requireEmailVerification` (see CLAUDE.md's Better Auth notes).
 */
export async function seedE2eDatabase(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      "user", "category", "banner", "feature_flag",
      "analytics_event", "processed_webhook_event"
    CASCADE
  `);

  await seedCatalog(db);

  await createCredentialUser({
    id: "e2e-admin",
    name: "E2E Admin",
    email: E2E_ADMIN_EMAIL,
    role: "admin",
  });
  await createCredentialUser({
    id: "e2e-customer",
    name: "E2E Customer",
    email: E2E_CUSTOMER_EMAIL,
    role: "customer",
  });
}
