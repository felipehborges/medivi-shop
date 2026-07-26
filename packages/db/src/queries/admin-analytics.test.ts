import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { analyticsEvent, category, order, orderItem, product, productVariant } from "../schema";
import { conversionFunnel, lowStockAlerts, revenueOverTime, topProductsByRevenue } from "./admin-analytics";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const shippingAddress = {
  fullName: "Test",
  line1: "1 Way",
  city: "Town",
  region: "Region",
  postalCode: "00001",
  country: "US",
};

async function makeProduct(tx: Tx, opts: { stock: number; status?: "draft" | "active" | "archived" } = { stock: 10 }) {
  const [cat] = await tx.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  const [p] = await tx
    .insert(product)
    .values({
      categoryId: cat!.id,
      name: "Test Sword",
      slug: unique("test-sword"),
      basePriceCents: 1000,
      status: opts.status ?? "active",
    })
    .returning();
  const [v] = await tx
    .insert(productVariant)
    .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock: opts.stock })
    .returning();
  return { productId: p!.id, variantId: v!.id };
}

async function makeOrder(tx: Tx, productId: string, variantId: string, status: "paid" | "fulfilled" | "pending") {
  const [orderRow] = await tx
    .insert(order)
    .values({
      orderNumber: unique("MDV"),
      guestEmail: "guest@example.com",
      status,
      subtotalCents: 2000,
      totalCents: 2000,
      shippingAddress,
    })
    .returning();
  await tx.insert(orderItem).values({
    orderId: orderRow!.id,
    productId,
    variantId,
    nameSnapshot: "Test Sword",
    unitPriceCents: 1000,
    quantity: 2,
    lineTotalCents: 2000,
  });
  return orderRow!.id;
}

describe("revenueOverTime", () => {
  it("buckets paid/fulfilled revenue and order count by day, excluding pending", async () => {
    // Asserts a *delta*, not an absolute total — this is a shared dev
    // database, and `revenueOverTime` deliberately has no per-test scoping
    // (it's a business-wide aggregate), so other committed orders within the
    // 30-day window are expected to already be present.
    await withTestTransaction(async (tx) => {
      const sum = (points: Awaited<ReturnType<typeof revenueOverTime>>) => ({
        revenueCents: points.reduce((sum, p) => sum + p.revenueCents, 0),
        orderCount: points.reduce((sum, p) => sum + p.orderCount, 0),
      });
      const before = sum(await revenueOverTime(tx, 30));

      const { productId, variantId } = await makeProduct(tx);
      await makeOrder(tx, productId, variantId, "paid");
      await makeOrder(tx, productId, variantId, "fulfilled");
      await makeOrder(tx, productId, variantId, "pending");

      const after = sum(await revenueOverTime(tx, 30));

      expect(after.revenueCents - before.revenueCents).toBe(4000);
      expect(after.orderCount - before.orderCount).toBe(2);
    });
  });
});

describe("topProductsByRevenue", () => {
  it("ranks products by revenue from paid/fulfilled orders only", async () => {
    await withTestTransaction(async (tx) => {
      const { productId, variantId } = await makeProduct(tx);
      await makeOrder(tx, productId, variantId, "paid");
      await makeOrder(tx, productId, variantId, "pending");

      const top = await topProductsByRevenue(tx, 5);
      const entry = top.find((t) => t.productId === productId);
      expect(entry?.revenueCents).toBe(2000);
      expect(entry?.unitsSold).toBe(2);
    });
  });
});

describe("lowStockAlerts", () => {
  it("only surfaces active products at or below the threshold", async () => {
    await withTestTransaction(async (tx) => {
      const low = await makeProduct(tx, { stock: 2, status: "active" });
      const plenty = await makeProduct(tx, { stock: 50, status: "active" });
      const draftLow = await makeProduct(tx, { stock: 1, status: "draft" });

      const alerts = await lowStockAlerts(tx, 5);
      const variantIds = alerts.map((a) => a.variantId);
      expect(variantIds).toContain(low.variantId);
      expect(variantIds).not.toContain(plenty.variantId);
      expect(variantIds).not.toContain(draftLow.variantId);
    });
  });
});

describe("conversionFunnel", () => {
  it("counts distinct sessions per funnel step, not raw events", async () => {
    // Delta-based, same reasoning as revenueOverTime above — other sessions
    // committed within the window (e.g. from manual browser verification)
    // are expected, not a leak this test needs to guard against.
    await withTestTransaction(async (tx) => {
      const before = await conversionFunnel(tx, 30);

      const sessionA = unique("sess");
      const sessionB = unique("sess");

      // Session A: views twice, adds to cart, never checks out.
      await tx.insert(analyticsEvent).values([
        { sessionId: sessionA, type: "page_view", path: "/catalog" },
        { sessionId: sessionA, type: "page_view", path: "/product/sword" },
        { sessionId: sessionA, type: "add_to_cart" },
      ]);
      // Session B: full funnel through completion.
      await tx.insert(analyticsEvent).values([
        { sessionId: sessionB, type: "page_view", path: "/catalog" },
        { sessionId: sessionB, type: "add_to_cart" },
        { sessionId: sessionB, type: "checkout_started" },
        { sessionId: sessionB, type: "checkout_completed" },
      ]);

      const after = await conversionFunnel(tx, 30);
      expect({
        pageViews: after.pageViews - before.pageViews,
        addToCart: after.addToCart - before.addToCart,
        checkoutStarted: after.checkoutStarted - before.checkoutStarted,
        checkoutCompleted: after.checkoutCompleted - before.checkoutCompleted,
      }).toEqual({
        pageViews: 2,
        addToCart: 2,
        checkoutStarted: 1,
        checkoutCompleted: 1,
      });
    });
  });
});
