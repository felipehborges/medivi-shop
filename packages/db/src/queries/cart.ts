import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { cart, cartItem, product, productImage, productVariant } from "../schema";

export type CartOwner = { userId: string } | { guestToken: string };

export type CartItemDetail = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  variantAttributes: Record<string, string> | null;
  imageUrl: string | null;
  quantity: number;
  priceSnapshotCents: number;
  currentStock: number;
  lineTotalCents: number;
};

export type CartDetail = {
  id: string | null;
  items: CartItemDetail[];
  subtotalCents: number;
  itemCount: number;
};

const EMPTY_CART: CartDetail = { id: null, items: [], subtotalCents: 0, itemCount: 0 };

function ownerCondition(owner: CartOwner) {
  return "userId" in owner ? eq(cart.userId, owner.userId) : eq(cart.guestToken, owner.guestToken);
}

export async function getCart(db: DbClient, owner: CartOwner): Promise<{ id: string } | null> {
  const [row] = await db.select({ id: cart.id }).from(cart).where(ownerCondition(owner)).limit(1);
  return row ?? null;
}

export async function getOrCreateCart(db: DbClient, owner: CartOwner): Promise<{ id: string }> {
  const existing = await getCart(db, owner);
  if (existing) return existing;

  const values = "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken };
  const [created] = await db
    .insert(cart)
    .values(values)
    .onConflictDoNothing({ target: "userId" in owner ? cart.userId : cart.guestToken })
    .returning({ id: cart.id });
  if (created) return created;

  // Lost a race with a concurrent request creating the same owner's cart.
  const row = await getCart(db, owner);
  if (!row) throw new Error("Failed to get or create cart");
  return row;
}

/** Full cart contents with product/variant display info and live stock, for the cart drawer/page. */
export async function getCartDetail(db: DbClient, owner: CartOwner): Promise<CartDetail> {
  const existing = await getCart(db, owner);
  if (!existing) return EMPTY_CART;

  const rows = await db
    .select({
      id: cartItem.id,
      variantId: cartItem.variantId,
      quantity: cartItem.quantity,
      priceSnapshotCents: cartItem.priceSnapshotCents,
      currentStock: productVariant.stock,
      variantName: productVariant.name,
      variantAttributes: productVariant.attributes,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      imageUrl: sql<string | null>`(
        select ${productImage.url} from ${productImage}
        where ${productImage.productId} = ${product.id}
        order by ${productImage.position} asc
        limit 1
      )`,
    })
    .from(cartItem)
    .innerJoin(productVariant, eq(productVariant.id, cartItem.variantId))
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(eq(cartItem.cartId, existing.id))
    .orderBy(asc(cartItem.createdAt));

  const items: CartItemDetail[] = rows.map((row) => ({
    ...row,
    lineTotalCents: row.priceSnapshotCents * row.quantity,
  }));

  return {
    id: existing.id,
    items,
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export type AddToCartResult =
  | { ok: true }
  | { ok: false; reason: "out_of_stock" | "insufficient_stock"; available: number };

/**
 * Adds a variant to the cart, or increments its quantity if already present.
 * Clamps to current stock — this is a UX check, not the hard concurrency
 * guarantee (that's the stock decrement at webhook fulfillment time, see
 * docs/architecture.md §4).
 */
export async function addCartItem(
  db: DbClient,
  owner: CartOwner,
  variantId: string,
  quantity: number,
): Promise<AddToCartResult> {
  const [variant] = await db
    .select({ stock: productVariant.stock, priceOverrideCents: productVariant.priceOverrideCents })
    .from(productVariant)
    .where(eq(productVariant.id, variantId))
    .limit(1);
  if (!variant) return { ok: false, reason: "out_of_stock", available: 0 };

  const cartRow = await getOrCreateCart(db, owner);
  const [existingItem] = await db
    .select({ id: cartItem.id, quantity: cartItem.quantity })
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartRow.id), eq(cartItem.variantId, variantId)))
    .limit(1);

  const requestedTotal = (existingItem?.quantity ?? 0) + quantity;
  if (variant.stock === 0) return { ok: false, reason: "out_of_stock", available: 0 };
  if (requestedTotal > variant.stock) {
    return { ok: false, reason: "insufficient_stock", available: variant.stock };
  }

  if (existingItem) {
    await db
      .update(cartItem)
      .set({ quantity: requestedTotal, updatedAt: new Date() })
      .where(eq(cartItem.id, existingItem.id));
  } else {
    const [product_] = await db
      .select({ basePriceCents: product.basePriceCents })
      .from(product)
      .innerJoin(productVariant, eq(productVariant.productId, product.id))
      .where(eq(productVariant.id, variantId))
      .limit(1);
    const priceCents = variant.priceOverrideCents ?? product_?.basePriceCents ?? 0;

    await db.insert(cartItem).values({
      cartId: cartRow.id,
      variantId,
      quantity,
      priceSnapshotCents: priceCents,
    });
  }

  return { ok: true };
}

export type UpdateQuantityResult =
  | { ok: true }
  | { ok: false; reason: "insufficient_stock"; available: number };

/** Setting quantity to 0 or less removes the item. */
export async function updateCartItemQuantity(
  db: DbClient,
  owner: CartOwner,
  itemId: string,
  quantity: number,
): Promise<UpdateQuantityResult> {
  const cartRow = await getCart(db, owner);
  if (!cartRow) return { ok: true };

  if (quantity <= 0) {
    await db.delete(cartItem).where(and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartRow.id)));
    return { ok: true };
  }

  const [row] = await db
    .select({ stock: productVariant.stock })
    .from(cartItem)
    .innerJoin(productVariant, eq(productVariant.id, cartItem.variantId))
    .where(and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartRow.id)))
    .limit(1);
  if (!row) return { ok: true };

  if (quantity > row.stock) {
    return { ok: false, reason: "insufficient_stock", available: row.stock };
  }

  await db
    .update(cartItem)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartRow.id)));
  return { ok: true };
}

export async function removeCartItem(db: DbClient, owner: CartOwner, itemId: string): Promise<void> {
  const cartRow = await getCart(db, owner);
  if (!cartRow) return;
  await db.delete(cartItem).where(and(eq(cartItem.id, itemId), eq(cartItem.cartId, cartRow.id)));
}

/**
 * On login: guest cart items merge into the user's cart (sum quantities,
 * clamp to current stock), then the guest cart row is deleted. A no-op if
 * there's no guest cart for the token.
 */
export async function mergeGuestCartIntoUserCart(
  db: DbClient,
  guestToken: string,
  userId: string,
): Promise<void> {
  const guestCart = await getCart(db, { guestToken });
  if (!guestCart) return;

  const guestItems = await db
    .select({
      variantId: cartItem.variantId,
      quantity: cartItem.quantity,
      priceSnapshotCents: cartItem.priceSnapshotCents,
    })
    .from(cartItem)
    .where(eq(cartItem.cartId, guestCart.id));

  if (guestItems.length > 0) {
    const userCart = await getOrCreateCart(db, { userId });
    const userItems = await db
      .select({ id: cartItem.id, variantId: cartItem.variantId, quantity: cartItem.quantity })
      .from(cartItem)
      .where(eq(cartItem.cartId, userCart.id));
    const userItemByVariant = new Map(userItems.map((i) => [i.variantId, i]));

    const variantIds = guestItems.map((i) => i.variantId);
    const stockRows = await db
      .select({ id: productVariant.id, stock: productVariant.stock })
      .from(productVariant)
      .where(inArray(productVariant.id, variantIds));
    const stockByVariant = new Map(stockRows.map((r) => [r.id, r.stock]));

    for (const guestItem of guestItems) {
      const stock = stockByVariant.get(guestItem.variantId) ?? 0;
      const existing = userItemByVariant.get(guestItem.variantId);
      const combinedQuantity = Math.min((existing?.quantity ?? 0) + guestItem.quantity, stock);
      if (combinedQuantity <= 0) continue;

      if (existing) {
        await db
          .update(cartItem)
          .set({ quantity: combinedQuantity, updatedAt: new Date() })
          .where(eq(cartItem.id, existing.id));
      } else {
        await db.insert(cartItem).values({
          cartId: userCart.id,
          variantId: guestItem.variantId,
          quantity: combinedQuantity,
          priceSnapshotCents: guestItem.priceSnapshotCents,
        });
      }
    }
  }

  await db.delete(cart).where(eq(cart.id, guestCart.id));
}
