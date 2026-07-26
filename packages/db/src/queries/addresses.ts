import { and, desc, eq } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { address } from "../schema";

export type AddressInput = {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
};

export type Address = typeof address.$inferSelect;

export async function listAddressesForUser(db: DbClient, userId: string): Promise<Address[]> {
  return db
    .select()
    .from(address)
    .where(eq(address.userId, userId))
    .orderBy(desc(address.isDefault), desc(address.createdAt));
}

/** The first address for a user is always the default, regardless of the input flag. */
export async function createAddress(db: DbClient, userId: string, input: AddressInput): Promise<Address> {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: address.id }).from(address).where(eq(address.userId, userId));
    const isDefault = input.isDefault === true || existing.length === 0;
    if (isDefault) {
      await tx.update(address).set({ isDefault: false }).where(eq(address.userId, userId));
    }

    const [row] = await tx.insert(address).values({ userId, ...input, isDefault }).returning();
    if (!row) throw new Error("Failed to create address");
    return row;
  });
}

export async function updateAddress(
  db: DbClient,
  id: string,
  userId: string,
  input: AddressInput,
): Promise<Address | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: address.id })
      .from(address)
      .where(and(eq(address.id, id), eq(address.userId, userId)));
    if (!existing) return null;

    const isDefault = input.isDefault === true;
    if (isDefault) {
      await tx.update(address).set({ isDefault: false }).where(eq(address.userId, userId));
    }

    const [row] = await tx
      .update(address)
      .set({ ...input, isDefault, updatedAt: new Date() })
      .where(eq(address.id, id))
      .returning();
    return row ?? null;
  });
}

/** Deleting the default address promotes the next-most-recent remaining one, if any. */
export async function deleteAddress(db: DbClient, id: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(address)
      .where(and(eq(address.id, id), eq(address.userId, userId)))
      .returning();
    if (!deleted?.isDefault) return;

    const [next] = await tx
      .select({ id: address.id })
      .from(address)
      .where(eq(address.userId, userId))
      .orderBy(desc(address.createdAt))
      .limit(1);
    if (next) {
      await tx.update(address).set({ isDefault: true }).where(eq(address.id, next.id));
    }
  });
}
