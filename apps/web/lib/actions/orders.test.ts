import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { createOrder, createPayment, fulfillPaidOrder } from "@medivi/db/queries";
import { auditLog, cart, cartItem, category, order, orderItem, payment, product, productVariant, user } from "@medivi/db/schema";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { refundOrderAction } = await import("./orders");

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
let adminId: string;
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];

async function makeOrder({ paid }: { paid: boolean }) {
  const uid = unique("user");
  const [u] = await db.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com` }).returning();
  createdUserIds.push(u!.id);

  const slug = unique("prod");
  const [p] = await db
    .insert(product)
    .values({ categoryId, name: slug, slug, basePriceCents: 1000, status: "active" })
    .returning();
  const [v] = await db
    .insert(productVariant)
    .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock: 5 })
    .returning();
  const [cartRow] = await db.insert(cart).values({ userId: u!.id }).returning();
  await db.insert(cartItem).values({ cartId: cartRow!.id, variantId: v!.id, quantity: 1, priceSnapshotCents: 1000 });

  const created = await createOrder(db, cartRow!.id, { userId: u!.id }, { shippingAddress, shippingCents: 500 });
  if (!created.ok) throw new Error("setup: expected order creation to succeed");
  await createPayment(db, {
    orderId: created.orderId,
    provider: "mock",
    providerRef: `mock_${created.orderId}`,
    amountCents: created.totalCents,
  });
  createdOrderIds.push(created.orderId);

  if (paid) {
    await fulfillPaidOrder(db, {
      eventId: unique("evt"),
      provider: "mock",
      orderId: created.orderId,
      providerRef: `mock_${created.orderId}`,
    });
  }
  return created.orderId;
}

beforeAll(async () => {
  const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  categoryId = cat!.id;
  const aid = unique("admin");
  const [admin] = await db.insert(user).values({ id: aid, name: aid, email: `${aid}@example.com`, role: "admin" }).returning();
  adminId = admin!.id;
  createdUserIds.push(adminId);
});

afterEach(() => {
  requireAdminMock.mockReset();
});

afterAll(async () => {
  for (const orderId of createdOrderIds) {
    await db.delete(payment).where(eq(payment.orderId, orderId));
    await db.delete(orderItem).where(eq(orderItem.orderId, orderId));
    await db.delete(auditLog).where(eq(auditLog.entityId, orderId));
    await db.delete(order).where(eq(order.id, orderId));
  }
  for (const id of createdUserIds) {
    await db.delete(user).where(eq(user.id, id));
  }
  await db.delete(product).where(eq(product.categoryId, categoryId));
  await db.delete(category).where(eq(category.id, categoryId));
});

describe("refundOrderAction", () => {
  it("requires an admin session", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT:/"));
    const orderId = await makeOrder({ paid: true });
    await expect(refundOrderAction({ orderId })).rejects.toThrow("REDIRECT:/");
  });

  it("refunds a paid order", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const orderId = await makeOrder({ paid: true });

    const result = await refundOrderAction({ orderId });
    expect(result).toEqual({ ok: true });

    const [orderRow] = await db.select().from(order).where(eq(order.id, orderId));
    expect(orderRow?.status).toBe("refunded");

    const [paymentRow] = await db.select().from(payment).where(eq(payment.orderId, orderId));
    expect(paymentRow?.status).toBe("refunded");
  });

  it("rejects refunding a pending (unpaid) order", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const orderId = await makeOrder({ paid: false });

    const result = await refundOrderAction({ orderId });
    expect(result).toEqual({ ok: false, reason: "invalid_state" });
  });
});
