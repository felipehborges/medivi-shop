import { db } from "./client";
import { seedCatalog } from "./seed-catalog";
import { user } from "./schema";

async function main() {
  console.log("Seeding catalog...");
  await seedCatalog(db);

  console.log("Seeding admin user...");
  // Role-only row — no login credential yet, since Better Auth's password
  // hashing isn't wired until Phase 2. This lets Phase 3/4 work (which reads
  // `user`/`role` but doesn't need a real login) proceed against seed data.
  // Once Phase 2 lands, promote a real signed-up account to admin instead of
  // trying to log into this row directly (its id isn't one Better Auth
  // issued, and its email is reserved by this unique constraint either way):
  //   update "user" set role = 'admin' where email = 'you@example.com';
  await db.insert(user).values({
    id: "seed-admin",
    name: "Medivi Admin",
    email: "admin@medivi.shop",
    emailVerified: true,
    role: "admin",
  });

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
