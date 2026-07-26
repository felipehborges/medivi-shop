import { describe, expect, it } from "vitest";
import { withTestTransaction } from "../test";
import { category, product, productImage, productVariant, user } from "../schema";
import type { Tx } from "../lib/db-client";
import {
  addCartItem,
  getCartDetail,
  mergeGuestCartIntoUserCart,
  removeCartItem,
  updateCartItemQuantity,
} from "./cart";

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

async function makeVariant(tx: Tx, stock: number, priceOverrideCents?: number) {
  const [cat] = await tx
    .insert(category)
    .values({ name: unique("cat"), slug: unique("cat") })
    .returning();
  const slug = unique("prod");
  const [p] = await tx
    .insert(product)
    .values({ categoryId: cat!.id, name: slug, slug, basePriceCents: 1000, status: "active" })
    .returning();
  const [v] = await tx
    .insert(productVariant)
    .values({
      productId: p!.id,
      name: "Standard",
      sku: unique("SKU"),
      stock,
      priceOverrideCents,
    })
    .returning();
  return { product: p!, variant: v! };
}

describe("addCartItem", () => {
  it("adds a new item with a price snapshot from the product base price", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);

      const result = await addCartItem(tx, { userId: u.id }, variant.id, 2);
      expect(result).toEqual({ ok: true });

      const detail = await getCartDetail(tx, { userId: u.id });
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0]?.quantity).toBe(2);
      expect(detail.items[0]?.priceSnapshotCents).toBe(1000);
      expect(detail.subtotalCents).toBe(2000);
    });
  });

  it("resolves the product's first image (by position) as imageUrl", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { product: p, variant } = await makeVariant(tx, 5);
      await tx.insert(productImage).values([
        { productId: p.id, url: "https://example.com/second.jpg", altText: "second", position: 2 },
        { productId: p.id, url: "https://example.com/first.jpg", altText: "first", position: 1 },
      ]);

      await addCartItem(tx, { userId: u.id }, variant.id, 1);

      const detail = await getCartDetail(tx, { userId: u.id });
      expect(detail.items[0]?.imageUrl).toBe("https://example.com/first.jpg");
    });
  });

  it("uses the variant price override when present", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5, 2500);

      await addCartItem(tx, { userId: u.id }, variant.id, 1);

      const detail = await getCartDetail(tx, { userId: u.id });
      expect(detail.items[0]?.priceSnapshotCents).toBe(2500);
    });
  });

  it("increments quantity when adding an already-present variant", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 10);

      await addCartItem(tx, { userId: u.id }, variant.id, 2);
      await addCartItem(tx, { userId: u.id }, variant.id, 3);

      const detail = await getCartDetail(tx, { userId: u.id });
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0]?.quantity).toBe(5);
    });
  });

  it("rejects adding an out-of-stock variant", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 0);

      const result = await addCartItem(tx, { userId: u.id }, variant.id, 1);
      expect(result).toEqual({ ok: false, reason: "out_of_stock", available: 0 });

      const detail = await getCartDetail(tx, { userId: u.id });
      expect(detail.items).toHaveLength(0);
    });
  });

  it("rejects a quantity that exceeds available stock", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 3);

      const result = await addCartItem(tx, { userId: u.id }, variant.id, 5);
      expect(result).toEqual({ ok: false, reason: "insufficient_stock", available: 3 });
    });
  });

  it("rejects when the combined quantity (existing + new) exceeds stock", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 4);

      await addCartItem(tx, { userId: u.id }, variant.id, 3);
      const result = await addCartItem(tx, { userId: u.id }, variant.id, 3);

      expect(result).toEqual({ ok: false, reason: "insufficient_stock", available: 4 });
      const detail = await getCartDetail(tx, { userId: u.id });
      expect(detail.items[0]?.quantity).toBe(3);
    });
  });

  it("supports a guest cart keyed by token", async () => {
    await withTestTransaction(async (tx) => {
      const { variant } = await makeVariant(tx, 5);
      const guestToken = unique("guest");

      await addCartItem(tx, { guestToken }, variant.id, 1);

      const detail = await getCartDetail(tx, { guestToken });
      expect(detail.items).toHaveLength(1);
    });
  });
});

describe("updateCartItemQuantity", () => {
  it("updates the quantity", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 10);
      await addCartItem(tx, { userId: u.id }, variant.id, 1);
      const detail = await getCartDetail(tx, { userId: u.id });
      const itemId = detail.items[0]!.id;

      const result = await updateCartItemQuantity(tx, { userId: u.id }, itemId, 4);
      expect(result).toEqual({ ok: true });

      const updated = await getCartDetail(tx, { userId: u.id });
      expect(updated.items[0]?.quantity).toBe(4);
    });
  });

  it("removes the item when quantity is set to 0", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 10);
      await addCartItem(tx, { userId: u.id }, variant.id, 1);
      const detail = await getCartDetail(tx, { userId: u.id });
      const itemId = detail.items[0]!.id;

      await updateCartItemQuantity(tx, { userId: u.id }, itemId, 0);

      const updated = await getCartDetail(tx, { userId: u.id });
      expect(updated.items).toHaveLength(0);
    });
  });

  it("rejects a quantity above current stock", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      await addCartItem(tx, { userId: u.id }, variant.id, 1);
      const detail = await getCartDetail(tx, { userId: u.id });
      const itemId = detail.items[0]!.id;

      const result = await updateCartItemQuantity(tx, { userId: u.id }, itemId, 9);
      expect(result).toEqual({ ok: false, reason: "insufficient_stock", available: 5 });

      const unchanged = await getCartDetail(tx, { userId: u.id });
      expect(unchanged.items[0]?.quantity).toBe(1);
    });
  });
});

describe("removeCartItem", () => {
  it("removes the item from the cart", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      await addCartItem(tx, { userId: u.id }, variant.id, 1);
      const detail = await getCartDetail(tx, { userId: u.id });
      const itemId = detail.items[0]!.id;

      await removeCartItem(tx, { userId: u.id }, itemId);

      const updated = await getCartDetail(tx, { userId: u.id });
      expect(updated.items).toHaveLength(0);
    });
  });
});

describe("mergeGuestCartIntoUserCart", () => {
  it("moves guest items into a fresh user cart and deletes the guest cart", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 10);
      const guestToken = unique("guest");
      await addCartItem(tx, { guestToken }, variant.id, 2);

      await mergeGuestCartIntoUserCart(tx, guestToken, u.id);

      const userDetail = await getCartDetail(tx, { userId: u.id });
      expect(userDetail.items).toHaveLength(1);
      expect(userDetail.items[0]?.quantity).toBe(2);

      const guestDetail = await getCartDetail(tx, { guestToken });
      expect(guestDetail.id).toBeNull();
    });
  });

  it("sums quantities when the user already has the same variant", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 10);
      const guestToken = unique("guest");
      await addCartItem(tx, { userId: u.id }, variant.id, 3);
      await addCartItem(tx, { guestToken }, variant.id, 4);

      await mergeGuestCartIntoUserCart(tx, guestToken, u.id);

      const userDetail = await getCartDetail(tx, { userId: u.id });
      expect(userDetail.items).toHaveLength(1);
      expect(userDetail.items[0]?.quantity).toBe(7);
    });
  });

  it("clamps the merged quantity to current stock", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const guestToken = unique("guest");
      await addCartItem(tx, { userId: u.id }, variant.id, 3);
      await addCartItem(tx, { guestToken }, variant.id, 4);

      await mergeGuestCartIntoUserCart(tx, guestToken, u.id);

      const userDetail = await getCartDetail(tx, { userId: u.id });
      expect(userDetail.items[0]?.quantity).toBe(5);
    });
  });

  it("is a no-op when there is no guest cart for the token", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      await expect(mergeGuestCartIntoUserCart(tx, unique("no-such-token"), u.id)).resolves.not.toThrow();
      const userDetail = await getCartDetail(tx, { userId: u.id });
      expect(userDetail.items).toHaveLength(0);
    });
  });
});
