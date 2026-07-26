import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { createOrder } from "@medivi/db/queries";
import { cart, cartItem, category, order, orderItem, product, productVariant } from "@medivi/db/schema";

const { lookupGuestOrderAction } = await import("./order-lookup");

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

let categoryId: string;
const createdOrderIds: string[] = [];

afterAll(async () => {
  for (const orderId of createdOrderIds) {
    await db.delete(orderItem).where(eq(orderItem.orderId, orderId));
    await db.delete(order).where(eq(order.id, orderId));
  }
  await db.delete(product).where(eq(product.categoryId, categoryId));
  await db.delete(category).where(eq(category.id, categoryId));
});

describe("lookupGuestOrderAction", () => {
  it("finds the order when the order number and email both match", async () => {
    const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
    categoryId = cat!.id;
    const slug = unique("prod");
    const [p] = await db
      .insert(product)
      .values({ categoryId, name: slug, slug, basePriceCents: 1000, status: "active" })
      .returning();
    const [v] = await db
      .insert(productVariant)
      .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock: 5 })
      .returning();
    const guestToken = unique("guest");
    const [cartRow] = await db.insert(cart).values({ guestToken }).returning();
    await db.insert(cartItem).values({ cartId: cartRow!.id, variantId: v!.id, quantity: 1, priceSnapshotCents: 1000 });

    const created = await createOrder(
      db,
      cartRow!.id,
      { guestEmail: "lookup@example.com" },
      { shippingAddress, shippingCents: 500 },
    );
    if (!created.ok) throw new Error("setup: expected order creation to succeed");
    createdOrderIds.push(created.orderId);

    const found = await lookupGuestOrderAction({ orderNumber: created.orderNumber, email: "lookup@example.com" });
    expect(found).toEqual({ ok: true, orderId: created.orderId });

    const wrongEmail = await lookupGuestOrderAction({ orderNumber: created.orderNumber, email: "nope@example.com" });
    expect(wrongEmail).toEqual({ ok: false });
  });

  it("returns not-found for an unknown order number", async () => {
    const result = await lookupGuestOrderAction({ orderNumber: "MDV-DOES-NOT-EXIST", email: "nobody@example.com" });
    expect(result).toEqual({ ok: false });
  });
});
