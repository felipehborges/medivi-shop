import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { createOrder, createPayment } from "@medivi/db/queries";
import { cart, cartItem, category, order, orderItem, payment, product, productVariant, user } from "@medivi/db/schema";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("server-only", () => ({}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  getEmailProvider: () => ({ send: sendEmailMock }),
}));

const { approveMockPayment, declineMockPayment } = await import("./mock-checkout");

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
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];

async function makeOrder(stock: number, quantity: number) {
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
    .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock })
    .returning();
  const [cartRow] = await db.insert(cart).values({ userId: u!.id }).returning();
  await db.insert(cartItem).values({ cartId: cartRow!.id, variantId: v!.id, quantity, priceSnapshotCents: 1000 });

  const created = await createOrder(db, cartRow!.id, { userId: u!.id }, { shippingAddress, shippingCents: 500 });
  if (!created.ok) throw new Error("setup: expected order creation to succeed");
  await createPayment(db, {
    orderId: created.orderId,
    provider: "mock",
    providerRef: `mock_${created.orderId}`,
    amountCents: created.totalCents,
  });
  createdOrderIds.push(created.orderId);
  return { orderId: created.orderId, variantId: v!.id };
}

beforeAll(async () => {
  const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  categoryId = cat!.id;
});

afterEach(() => {
  redirectMock.mockClear();
  sendEmailMock.mockClear();
});

afterAll(async () => {
  for (const orderId of createdOrderIds) {
    await db.delete(payment).where(eq(payment.orderId, orderId));
    await db.delete(orderItem).where(eq(orderItem.orderId, orderId));
    await db.delete(order).where(eq(order.id, orderId));
  }
  for (const id of createdUserIds) {
    await db.delete(user).where(eq(user.id, id));
  }
  await db.delete(product).where(eq(product.categoryId, categoryId));
  await db.delete(category).where(eq(category.id, categoryId));
});

describe("approveMockPayment", () => {
  it("fulfills the order and redirects to the success url", async () => {
    const { orderId, variantId } = await makeOrder(5, 2);

    await expect(
      approveMockPayment({ orderId, redirectUrl: "http://localhost:3000/order/confirmation/" + orderId }),
    ).rejects.toThrow(/^REDIRECT:/);

    const [orderRow] = await db.select().from(order).where(eq(order.id, orderId));
    expect(orderRow?.status).toBe("paid");

    const [variantRow] = await db.select().from(productVariant).where(eq(productVariant.id, variantId));
    expect(variantRow?.stock).toBe(3);

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const sentTo = sendEmailMock.mock.calls[0]![0].to;
    const [userRow] = await db.select().from(user).where(eq(user.id, createdUserIds.at(-1)!));
    expect(sentTo).toBe(userRow?.email);
  });

  it("is a no-op (but still redirects) when the order is no longer pending", async () => {
    const { orderId } = await makeOrder(5, 1);
    await approveMockPayment({ orderId, redirectUrl: "http://localhost:3000/x" }).catch(() => {});
    sendEmailMock.mockClear();

    await expect(approveMockPayment({ orderId, redirectUrl: "http://localhost:3000/x" })).rejects.toThrow(/^REDIRECT:/);
    const [orderRow] = await db.select().from(order).where(eq(order.id, orderId));
    expect(orderRow?.status).toBe("paid");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("declineMockPayment", () => {
  it("marks the payment failed, leaves the order pending, and redirects to the cancel url", async () => {
    const { orderId } = await makeOrder(5, 1);

    await expect(
      declineMockPayment({ orderId, redirectUrl: "http://localhost:3000/checkout" }),
    ).rejects.toThrow(/^REDIRECT:/);

    const [orderRow] = await db.select().from(order).where(eq(order.id, orderId));
    expect(orderRow?.status).toBe("pending");

    const [paymentRow] = await db.select().from(payment).where(eq(payment.orderId, orderId));
    expect(paymentRow?.status).toBe("failed");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
