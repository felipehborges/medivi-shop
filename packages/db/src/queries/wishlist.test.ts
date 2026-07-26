import { describe, expect, it } from "vitest";
import { withTestTransaction } from "../test";
import { category, product, productVariant, user } from "../schema";
import type { Tx } from "../lib/db-client";
import { addToWishlist, getWishlistedProductIds, removeFromWishlist } from "./wishlist";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeUser(tx: Tx) {
  const id = unique("user");
  const [row] = await tx
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com` })
    .returning();
  return row!;
}

async function makeProduct(tx: Tx) {
  const [cat] = await tx
    .insert(category)
    .values({ name: unique("cat"), slug: unique("cat") })
    .returning();
  const slug = unique("prod");
  const [row] = await tx
    .insert(product)
    .values({
      categoryId: cat!.id,
      name: slug,
      slug,
      basePriceCents: 1000,
      status: "active",
    })
    .returning();
  await tx.insert(productVariant).values({
    productId: row!.id,
    name: "Standard",
    sku: unique("SKU"),
    stock: 5,
  });
  return row!;
}

describe("wishlist", () => {
  it("adds a product to a new wishlist, creating it on first use", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const p = await makeProduct(tx);

      await addToWishlist(tx, u.id, p.id);

      const ids = await getWishlistedProductIds(tx, u.id);
      expect(ids.has(p.id)).toBe(true);
    });
  });

  it("is idempotent — adding the same product twice does not error or duplicate", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const p = await makeProduct(tx);

      await addToWishlist(tx, u.id, p.id);
      await addToWishlist(tx, u.id, p.id);

      const ids = await getWishlistedProductIds(tx, u.id);
      expect(ids.size).toBe(1);
    });
  });

  it("removes a product from the wishlist", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const p = await makeProduct(tx);
      await addToWishlist(tx, u.id, p.id);

      await removeFromWishlist(tx, u.id, p.id);

      const ids = await getWishlistedProductIds(tx, u.id);
      expect(ids.has(p.id)).toBe(false);
    });
  });

  it("removing from a wishlist that doesn't exist yet is a no-op", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const p = await makeProduct(tx);

      await expect(removeFromWishlist(tx, u.id, p.id)).resolves.not.toThrow();
    });
  });

  it("keeps wishlists separate per user", async () => {
    await withTestTransaction(async (tx) => {
      const userA = await makeUser(tx);
      const userB = await makeUser(tx);
      const p = await makeProduct(tx);

      await addToWishlist(tx, userA.id, p.id);

      expect((await getWishlistedProductIds(tx, userA.id)).has(p.id)).toBe(true);
      expect((await getWishlistedProductIds(tx, userB.id)).has(p.id)).toBe(false);
    });
  });
});
