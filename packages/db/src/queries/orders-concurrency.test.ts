import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "../client";
import { cart, cartItem, category, order, orderItem, payment, product, productVariant, user } from "../schema";
import { createOrder, createPayment, fulfillPaidOrder } from "./orders";

/**
 * Unlike orders.test.ts (which runs on withTestTransaction's single
 * connection), this test needs two genuinely concurrent connections for
 * Postgres's row-level locking to actually serialize the two `UPDATE`s —
 * that's the real behavior under test, not just the application logic. So
 * it uses the real `db` pool directly and cleans up manually afterward,
 * same pattern as apps/web's action tests.
 */

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const shippingAddress = {
  fullName: "Adventurer Test",
  line1: "1 Guild Hall Way",
  city: "Millhaven",
  region: "Riverlands",
  postalCode: "00001",
  country: "US",
};

const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];
const createdCategoryIds: string[] = [];

afterAll(async () => {
  for (const orderId of createdOrderIds) {
    await db.delete(payment).where(eq(payment.orderId, orderId));
    await db.delete(orderItem).where(eq(orderItem.orderId, orderId));
    await db.delete(order).where(eq(order.id, orderId));
  }
  for (const id of createdUserIds) {
    await db.delete(user).where(eq(user.id, id));
  }
  for (const id of createdCategoryIds) {
    await db.delete(product).where(eq(product.categoryId, id));
    await db.delete(category).where(eq(category.id, id));
  }
});

describe("fulfillPaidOrder concurrency", () => {
  it("lets exactly one of two concurrent fulfillments win the last unit of stock", async () => {
    const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
    createdCategoryIds.push(cat!.id);
    const slug = unique("prod");
    const [p] = await db
      .insert(product)
      .values({ categoryId: cat!.id, name: slug, slug, basePriceCents: 1000, status: "active" })
      .returning();
    const [variant] = await db
      .insert(productVariant)
      .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock: 1 })
      .returning();

    const uidA = unique("user");
    const [userA] = await db.insert(user).values({ id: uidA, name: uidA, email: `${uidA}@example.com` }).returning();
    createdUserIds.push(userA!.id);
    const uidB = unique("user");
    const [userB] = await db.insert(user).values({ id: uidB, name: uidB, email: `${uidB}@example.com` }).returning();
    createdUserIds.push(userB!.id);

    const [cartA] = await db.insert(cart).values({ userId: userA!.id }).returning();
    await db.insert(cartItem).values({ cartId: cartA!.id, variantId: variant!.id, quantity: 1, priceSnapshotCents: 1000 });
    const [cartB] = await db.insert(cart).values({ userId: userB!.id }).returning();
    await db.insert(cartItem).values({ cartId: cartB!.id, variantId: variant!.id, quantity: 1, priceSnapshotCents: 1000 });

    const orderA = await createOrder(db, cartA!.id, { userId: userA!.id }, { shippingAddress, shippingCents: 500 });
    const orderB = await createOrder(db, cartB!.id, { userId: userB!.id }, { shippingAddress, shippingCents: 500 });
    if (!orderA.ok || !orderB.ok) throw new Error("setup: expected both orders to be created");
    createdOrderIds.push(orderA.orderId, orderB.orderId);

    await createPayment(db, { orderId: orderA.orderId, provider: "mock", providerRef: `mock_${orderA.orderId}`, amountCents: orderA.totalCents });
    await createPayment(db, { orderId: orderB.orderId, provider: "mock", providerRef: `mock_${orderB.orderId}`, amountCents: orderB.totalCents });

    // Fired concurrently on separate pooled connections — Postgres's row
    // lock on the guarded UPDATE is what actually serializes these two.
    const [outcomeA, outcomeB] = await Promise.all([
      fulfillPaidOrder(db, { eventId: unique("evt"), provider: "mock", orderId: orderA.orderId, providerRef: `mock_${orderA.orderId}` }),
      fulfillPaidOrder(db, { eventId: unique("evt"), provider: "mock", orderId: orderB.orderId, providerRef: `mock_${orderB.orderId}` }),
    ]);

    const outcomes = [outcomeA.outcome, outcomeB.outcome].sort();
    expect(outcomes).toEqual(["oversold", "paid"]);

    const [variantRow] = await db.select().from(productVariant).where(eq(productVariant.id, variant!.id));
    expect(variantRow?.stock).toBe(0);

    const statuses = await Promise.all(
      [orderA.orderId, orderB.orderId].map(async (id) => {
        const [row] = await db.select({ status: order.status }).from(order).where(eq(order.id, id));
        return row!.status;
      }),
    );
    expect(statuses.sort()).toEqual(["paid", "pending"]);
  });
});
