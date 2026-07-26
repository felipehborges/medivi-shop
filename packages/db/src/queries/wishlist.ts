import { and, eq } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { wishlist, wishlistItem } from "../schema";

async function getOrCreateWishlistId(db: DbClient, userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: wishlist.id })
    .from(wishlist)
    .where(eq(wishlist.userId, userId))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(wishlist)
    .values({ userId })
    .onConflictDoNothing({ target: wishlist.userId })
    .returning({ id: wishlist.id });
  if (created) return created.id;

  // Lost a race with a concurrent request creating the same user's
  // wishlist between the select above and this insert.
  const [row] = await db
    .select({ id: wishlist.id })
    .from(wishlist)
    .where(eq(wishlist.userId, userId))
    .limit(1);
  if (!row) throw new Error(`Failed to get or create wishlist for user ${userId}`);
  return row.id;
}

export async function addToWishlist(db: DbClient, userId: string, productId: string): Promise<void> {
  const wishlistId = await getOrCreateWishlistId(db, userId);
  await db
    .insert(wishlistItem)
    .values({ wishlistId, productId })
    .onConflictDoNothing({ target: [wishlistItem.wishlistId, wishlistItem.productId] });
}

export async function removeFromWishlist(db: DbClient, userId: string, productId: string): Promise<void> {
  const [w] = await db.select({ id: wishlist.id }).from(wishlist).where(eq(wishlist.userId, userId)).limit(1);
  if (!w) return;

  await db
    .delete(wishlistItem)
    .where(and(eq(wishlistItem.wishlistId, w.id), eq(wishlistItem.productId, productId)));
}

/** Product ids the user has wishlisted, for a single batch membership check across a listing page. */
export async function getWishlistedProductIds(db: DbClient, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ productId: wishlistItem.productId })
    .from(wishlistItem)
    .innerJoin(wishlist, eq(wishlist.id, wishlistItem.wishlistId))
    .where(eq(wishlist.userId, userId));

  return new Set(rows.map((r) => r.productId));
}
