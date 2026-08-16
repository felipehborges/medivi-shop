import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import {
  auditLog,
  cart,
  cartItem,
  category,
  inventoryLog,
  processedWebhookEvent,
  product,
  productVariant,
  user,
} from "../schema";
import {
  createOrder,
  createPayment,
  fulfillPaidOrder,
  getLatestPaymentForOrder,
  getOrderById,
  getOrderForGuestLookup,
  getOrderForUser,
  listOrdersForUser,
  markOrderRefunded,
  recordPaymentFailure,
} from "./orders";

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

async function makeUser(tx: Tx) {
  const id = unique("user");
  const [row] = await tx.insert(user).values({ id, name: id, email: `${id}@example.com` }).returning();
  return row!;
}

async function makeVariant(tx: Tx, stock: number, priceOverrideCents?: number) {
  const [cat] = await tx.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  const slug = unique("prod");
  const [p] = await tx
    .insert(product)
    .values({ categoryId: cat!.id, name: slug, slug, basePriceCents: 1000, status: "active" })
    .returning();
  const [v] = await tx
    .insert(productVariant)
    .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock, priceOverrideCents })
    .returning();
  return { product: p!, variant: v! };
}

async function makeCartWithItem(
  tx: Tx,
  owner: { userId: string } | { guestToken: string },
  variantId: string,
  quantity: number,
  priceSnapshotCents: number,
) {
  const [cartRow] = await tx
    .insert(cart)
    .values("userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken })
    .returning();
  await tx.insert(cartItem).values({ cartId: cartRow!.id, variantId, quantity, priceSnapshotCents });
  return cartRow!;
}

describe("createOrder", () => {
  it("creates an order + order items and leaves the cart untouched (only a paid order clears it)", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 2, 1000);

      const result = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      expect(result).toMatchObject({ ok: true, subtotalCents: 2000, totalCents: 2500 });

      // Not cleared yet — if payment fails/is abandoned, the customer can
      // retry straight from their cart (see docs/spec.md §7).
      const remaining = await tx.select().from(cartItem).where(eq(cartItem.cartId, cartRow.id));
      expect(remaining).toHaveLength(1);

      if (!result.ok) throw new Error("expected ok");
      const detail = await getOrderById(tx, result.orderId);
      expect(detail?.status).toBe("pending");
      expect(detail?.items).toHaveLength(1);
      expect(detail?.items[0]?.lineTotalCents).toBe(2000);
    });
  });

  it("rejects an empty cart", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const [cartRow] = await tx.insert(cart).values({ userId: u.id }).returning();

      const result = await createOrder(tx, cartRow!.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      expect(result).toEqual({ ok: false, reason: "empty_cart" });
    });
  });

  it("blocks checkout when stock dropped below the cart quantity", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 1);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 3, 1000);

      const result = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (result.ok || result.reason !== "stock_or_price_changed") throw new Error("expected a stock/price failure");
      expect(result.issues).toEqual([
        expect.objectContaining({ kind: "stock", requested: 3, available: 1 }),
      ]);
    });
  });

  it("blocks checkout when the price changed since add-to-cart", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      // Snapshot stored at add-time (1000) no longer matches the live base price (1000 unchanged)
      // once we bump the product's price after the cart item was created.
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      await tx.update(product).set({ basePriceCents: 1500 }).where(eq(product.id, variant.productId));

      const result = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (result.ok || result.reason !== "stock_or_price_changed") throw new Error("expected a stock/price failure");
      expect(result.issues).toEqual([
        expect.objectContaining({ kind: "price", oldPriceCents: 1000, newPriceCents: 1500 }),
      ]);
    });
  });

  it("supports guest checkout via guestEmail", async () => {
    await withTestTransaction(async (tx) => {
      const { variant } = await makeVariant(tx, 5);
      const guestToken = unique("guest");
      const cartRow = await makeCartWithItem(tx, { guestToken }, variant.id, 1, 1000);

      const result = await createOrder(
        tx,
        cartRow.id,
        { guestEmail: "guest@example.com" },
        { shippingAddress, shippingCents: 500 },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      const detail = await getOrderById(tx, result.orderId);
      expect(detail?.guestEmail).toBe("guest@example.com");
      expect(detail?.userId).toBeNull();
    });
  });
});

describe("fulfillPaidOrder", () => {
  async function makeOrderWithItem(tx: Tx, stock: number, quantity: number) {
    const u = await makeUser(tx);
    const { variant } = await makeVariant(tx, stock);
    const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, quantity, 1000);
    const result = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
    if (!result.ok) throw new Error("setup: expected order creation to succeed");
    await createPayment(tx, {
      orderId: result.orderId,
      provider: "mock",
      providerRef: `mock_${result.orderId}`,
      amountCents: result.totalCents,
    });
    return { orderId: result.orderId, variantId: variant.id, userId: u.id };
  }

  it("marks the order paid, decrements stock, and writes an inventory log row", async () => {
    await withTestTransaction(async (tx) => {
      const { orderId, variantId } = await makeOrderWithItem(tx, 5, 2);

      const outcome = await fulfillPaidOrder(tx, {
        eventId: unique("evt"),
        provider: "mock",
        orderId,
        providerRef: `mock_${orderId}`,
      });
      expect(outcome).toEqual({ outcome: "paid" });

      const detail = await getOrderById(tx, orderId);
      expect(detail?.status).toBe("paid");
      expect(detail?.latestPaymentStatus).toBe("succeeded");

      const [variantRow] = await tx.select().from(productVariant).where(eq(productVariant.id, variantId));
      expect(variantRow?.stock).toBe(3);

      const logs = await tx.select().from(inventoryLog).where(eq(inventoryLog.variantId, variantId));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.change).toBe(-2);
      expect(logs[0]?.reason).toBe("order");
    });
  });

  it("clears the buyer's cart on success", async () => {
    await withTestTransaction(async (tx) => {
      const { orderId, userId } = await makeOrderWithItem(tx, 5, 1);
      // Add a second, unrelated item back into the (now-empty) cart to prove clearing targets the right cart.
      const { variant: otherVariant } = await makeVariant(tx, 5);
      const [cartRow] = await tx.select().from(cart).where(eq(cart.userId, userId));
      await tx.insert(cartItem).values({ cartId: cartRow!.id, variantId: otherVariant.id, quantity: 1, priceSnapshotCents: 1000 });

      await fulfillPaidOrder(tx, { eventId: unique("evt"), provider: "mock", orderId, providerRef: `mock_${orderId}` });

      const remaining = await tx.select().from(cartItem).where(eq(cartItem.cartId, cartRow!.id));
      expect(remaining).toHaveLength(0);
    });
  });

  it("clears a guest cart on success too (identified via order.cartId, not userId)", async () => {
    await withTestTransaction(async (tx) => {
      const { variant } = await makeVariant(tx, 5);
      const guestToken = unique("guest");
      const cartRow = await makeCartWithItem(tx, { guestToken }, variant.id, 1, 1000);
      const created = await createOrder(
        tx,
        cartRow.id,
        { guestEmail: "guest@example.com" },
        { shippingAddress, shippingCents: 500 },
      );
      if (!created.ok) throw new Error("expected ok");
      await createPayment(tx, { orderId: created.orderId, provider: "mock", providerRef: `mock_${created.orderId}`, amountCents: created.totalCents });

      await fulfillPaidOrder(tx, { eventId: unique("evt"), provider: "mock", orderId: created.orderId, providerRef: `mock_${created.orderId}` });

      const remaining = await tx.select().from(cartItem).where(eq(cartItem.cartId, cartRow.id));
      expect(remaining).toHaveLength(0);
    });
  });

  it("is idempotent on eventId", async () => {
    await withTestTransaction(async (tx) => {
      const { orderId, variantId } = await makeOrderWithItem(tx, 5, 2);
      const eventId = unique("evt");

      await fulfillPaidOrder(tx, { eventId, provider: "mock", orderId, providerRef: `mock_${orderId}` });
      const second = await fulfillPaidOrder(tx, { eventId, provider: "mock", orderId, providerRef: `mock_${orderId}` });

      expect(second).toEqual({ outcome: "duplicate" });
      const [variantRow] = await tx.select().from(productVariant).where(eq(productVariant.id, variantId));
      expect(variantRow?.stock).toBe(3);

      const events = await tx.select().from(processedWebhookEvent).where(eq(processedWebhookEvent.eventId, eventId));
      expect(events).toHaveLength(1);
    });
  });

  it("reports oversold and fails the payment when a second order already consumed the last unit", async () => {
    await withTestTransaction(async (tx) => {
      const { variant } = await makeVariant(tx, 1);
      const uA = await makeUser(tx);
      const uB = await makeUser(tx);
      const cartA = await makeCartWithItem(tx, { userId: uA.id }, variant.id, 1, 1000);
      const cartB = await makeCartWithItem(tx, { userId: uB.id }, variant.id, 1, 1000);

      // Both orders are created "pending" while stock is still 1 — the add-to-cart/
      // checkout stock check is a soft clamp, not the hard guarantee (see
      // docs/architecture.md §4). The real backstop is the guarded decrement below.
      const orderA = await createOrder(tx, cartA.id, { userId: uA.id }, { shippingAddress, shippingCents: 500 });
      const orderB = await createOrder(tx, cartB.id, { userId: uB.id }, { shippingAddress, shippingCents: 500 });
      if (!orderA.ok || !orderB.ok) throw new Error("expected both orders to be created");
      await createPayment(tx, { orderId: orderA.orderId, provider: "mock", providerRef: `mock_${orderA.orderId}`, amountCents: orderA.totalCents });
      await createPayment(tx, { orderId: orderB.orderId, provider: "mock", providerRef: `mock_${orderB.orderId}`, amountCents: orderB.totalCents });

      const outcomeA = await fulfillPaidOrder(tx, { eventId: unique("evt"), provider: "mock", orderId: orderA.orderId, providerRef: `mock_${orderA.orderId}` });
      const outcomeB = await fulfillPaidOrder(tx, { eventId: unique("evt"), provider: "mock", orderId: orderB.orderId, providerRef: `mock_${orderB.orderId}` });

      expect(outcomeA).toEqual({ outcome: "paid" });
      expect(outcomeB).toEqual({ outcome: "oversold", unavailableVariantIds: [variant.id] });

      const detailB = await getOrderById(tx, orderB.orderId);
      expect(detailB?.status).toBe("pending");
      expect(detailB?.latestPaymentStatus).toBe("failed");

      const [variantRow] = await tx.select().from(productVariant).where(eq(productVariant.id, variant.id));
      expect(variantRow?.stock).toBe(0);
    });
    });
  });

  it("does not decrement any stock when one line in a multi-item order is oversold", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant: availableVariant } = await makeVariant(tx, 5);
      const { variant: unavailableVariant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, availableVariant.id, 1, 1000);
      await tx.insert(cartItem).values({
        cartId: cartRow.id,
        variantId: unavailableVariant.id,
        quantity: 1,
        priceSnapshotCents: 1000,
      });

      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected order creation to succeed");
      await createPayment(tx, {
        orderId: created.orderId,
        provider: "mock",
        providerRef: `mock_${created.orderId}`,
        amountCents: created.totalCents,
      });
      await tx.update(productVariant).set({ stock: 0 }).where(eq(productVariant.id, unavailableVariant.id));

      const outcome = await fulfillPaidOrder(tx, {
        eventId: unique("evt"),
        provider: "mock",
        orderId: created.orderId,
        providerRef: `mock_${created.orderId}`,
      });
      expect(outcome).toEqual({ outcome: "oversold", unavailableVariantIds: [unavailableVariant.id] });

      const variants = await tx
        .select({ id: productVariant.id, stock: productVariant.stock })
        .from(productVariant)
        .where(inArray(productVariant.id, [availableVariant.id, unavailableVariant.id]));
      expect(variants).toEqual(
        expect.arrayContaining([
          { id: availableVariant.id, stock: 5 },
          { id: unavailableVariant.id, stock: 0 },
        ]),
      );

      const logs = await tx
        .select()
        .from(inventoryLog)
        .where(inArray(inventoryLog.variantId, [availableVariant.id, unavailableVariant.id]));
      expect(logs).toHaveLength(0);
    });
  });

  it("rejects a fulfillment event from a provider that does not own the payment", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected order creation to succeed");
      await createPayment(tx, {
        orderId: created.orderId,
        provider: "mock",
        providerRef: `mock_${created.orderId}`,
        amountCents: created.totalCents,
      });

      const outcome = await fulfillPaidOrder(tx, {
        eventId: unique("evt"),
        provider: "stripe",
        orderId: created.orderId,
        providerRef: "pi_unrelated",
      });
      expect(outcome).toEqual({ outcome: "invalid" });

      const [variantRow] = await tx.select().from(productVariant).where(eq(productVariant.id, variant.id));
      expect(variantRow?.stock).toBe(5);
    });
  });

  describe("recordPaymentFailure", () => {
  it("marks the payment failed, leaves the order pending, and leaves the cart intact for a retry", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");
      await createPayment(tx, { orderId: created.orderId, provider: "mock", providerRef: `mock_${created.orderId}`, amountCents: created.totalCents });

      const outcome = await recordPaymentFailure(tx, { eventId: unique("evt"), provider: "mock", orderId: created.orderId });
      expect(outcome).toEqual({ outcome: "recorded" });

      const detail = await getOrderById(tx, created.orderId);
      expect(detail?.status).toBe("pending");
      expect(detail?.latestPaymentStatus).toBe("failed");

      const remaining = await tx.select().from(cartItem).where(eq(cartItem.cartId, cartRow.id));
      expect(remaining).toHaveLength(1);
    });
  });

  it("is idempotent on eventId", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");
      await createPayment(tx, { orderId: created.orderId, provider: "mock", providerRef: `mock_${created.orderId}`, amountCents: created.totalCents });
      const eventId = unique("evt");

      await recordPaymentFailure(tx, { eventId, provider: "mock", orderId: created.orderId });
      const second = await recordPaymentFailure(tx, { eventId, provider: "mock", orderId: created.orderId });
      expect(second).toEqual({ outcome: "duplicate" });
    });
  });
});

describe("markOrderRefunded", () => {
  it("refunds a paid order and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");
      await createPayment(tx, { orderId: created.orderId, provider: "mock", providerRef: `mock_${created.orderId}`, amountCents: created.totalCents });
      await fulfillPaidOrder(tx, { eventId: unique("evt"), provider: "mock", orderId: created.orderId, providerRef: `mock_${created.orderId}` });

      const admin = await makeUser(tx);
      const outcome = await markOrderRefunded(tx, created.orderId, admin.id);
      expect(outcome).toEqual({ ok: true });

      const detail = await getOrderById(tx, created.orderId);
      expect(detail?.status).toBe("refunded");
      expect(detail?.latestPaymentStatus).toBe("refunded");

      const logs = await tx.select().from(auditLog).where(eq(auditLog.entityId, created.orderId));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.action).toBe("order.refund");
      expect(logs[0]?.actorId).toBe(admin.id);
    });
  });

  it("rejects refunding a pending order", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");

      const outcome = await markOrderRefunded(tx, created.orderId, u.id);
      expect(outcome).toEqual({ ok: false, reason: "invalid_state" });
    });
  });
});

describe("getLatestPaymentForOrder", () => {
  it("returns the payment for an order", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");
      await createPayment(tx, { orderId: created.orderId, provider: "stripe", providerRef: "cs_test_1", amountCents: created.totalCents });

      const latest = await getLatestPaymentForOrder(tx, created.orderId);
      expect(latest).toMatchObject({ provider: "stripe", providerRef: "cs_test_1", status: "requires_payment" });
    });
  });
});

describe("getOrderForUser", () => {
  it("returns the order for its owner", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: u.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");

      const detail = await getOrderForUser(tx, created.orderId, u.id);
      expect(detail?.id).toBe(created.orderId);
    });
  });

  it("returns null when the order belongs to a different user", async () => {
    await withTestTransaction(async (tx) => {
      const owner = await makeUser(tx);
      const other = await makeUser(tx);
      const { variant } = await makeVariant(tx, 5);
      const cartRow = await makeCartWithItem(tx, { userId: owner.id }, variant.id, 1, 1000);
      const created = await createOrder(tx, cartRow.id, { userId: owner.id }, { shippingAddress, shippingCents: 500 });
      if (!created.ok) throw new Error("expected ok");

      const detail = await getOrderForUser(tx, created.orderId, other.id);
      expect(detail).toBeNull();
    });
  });
});

describe("getOrderForGuestLookup", () => {
  it("matches on order number + guest email", async () => {
    await withTestTransaction(async (tx) => {
      const { variant } = await makeVariant(tx, 5);
      const guestToken = unique("guest");
      const cartRow = await makeCartWithItem(tx, { guestToken }, variant.id, 1, 1000);
      const created = await createOrder(
        tx,
        cartRow.id,
        { guestEmail: "guest@example.com" },
        { shippingAddress, shippingCents: 500 },
      );
      if (!created.ok) throw new Error("expected ok");

      const detail = await getOrderForGuestLookup(tx, created.orderNumber, "guest@example.com");
      expect(detail?.id).toBe(created.orderId);
    });
  });

  it("returns null when the email doesn't match", async () => {
    await withTestTransaction(async (tx) => {
      const { variant } = await makeVariant(tx, 5);
      const guestToken = unique("guest");
      const cartRow = await makeCartWithItem(tx, { guestToken }, variant.id, 1, 1000);
      const created = await createOrder(
        tx,
        cartRow.id,
        { guestEmail: "guest@example.com" },
        { shippingAddress, shippingCents: 500 },
      );
      if (!created.ok) throw new Error("expected ok");

      const detail = await getOrderForGuestLookup(tx, created.orderNumber, "wrong@example.com");
      expect(detail).toBeNull();
    });
  });

  it("returns null for an unknown order number", async () => {
    await withTestTransaction(async (tx) => {
      const detail = await getOrderForGuestLookup(tx, "MDV-DOES-NOT-EXIST", "guest@example.com");
      expect(detail).toBeNull();
    });
  });
});

describe("listOrdersForUser", () => {
  it("lists only the user's own orders, newest first, with item counts", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const other = await makeUser(tx);
      const { variant } = await makeVariant(tx, 10);

      const cartA = await makeCartWithItem(tx, { userId: u.id }, variant.id, 2, 1000);
      const orderA = await createOrder(tx, cartA.id, { userId: u.id }, { shippingAddress, shippingCents: 500 });
      if (!orderA.ok) throw new Error("expected ok");

      const cartOther = await makeCartWithItem(tx, { userId: other.id }, variant.id, 1, 1000);
      const orderOther = await createOrder(tx, cartOther.id, { userId: other.id }, { shippingAddress, shippingCents: 500 });
      if (!orderOther.ok) throw new Error("expected ok");

      const list = await listOrdersForUser(tx, u.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(orderA.orderId);
      expect(list[0]?.itemCount).toBe(2);
    });
  });
});
