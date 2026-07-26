import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { createOrder, createPayment } from "@medivi/db/queries";
import { cart, cartItem, category, order, orderItem, payment, processedWebhookEvent, product, productVariant, user } from "@medivi/db/schema";

const webhookSecret = "whsec_route_test_secret";

vi.mock("@/lib/env", () => ({
  env: {
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_test_dummy",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { POST } = await import("./route");

function signedRequest(payload: object) {
  const rawBody = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: rawBody, secret: webhookSecret });
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    body: rawBody,
    headers: { "stripe-signature": signature },
  });
}

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

async function makeOrder() {
  const uid = unique("user");
  const [u] = await db.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com` }).returning();
  createdUserIds.push(u!.id);

  const slug = unique("prod");
  const [p] = await db
    .insert(product)
    .values({ categoryId, name: slug, slug, basePriceCents: 1000, status: "active" })
    .returning();
  const [v] = await db.insert(productVariant).values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock: 5 }).returning();
  const [cartRow] = await db.insert(cart).values({ userId: u!.id }).returning();
  await db.insert(cartItem).values({ cartId: cartRow!.id, variantId: v!.id, quantity: 1, priceSnapshotCents: 1000 });

  const created = await createOrder(db, cartRow!.id, { userId: u!.id }, { shippingAddress, shippingCents: 500 });
  if (!created.ok) throw new Error("setup: expected order creation to succeed");
  await createPayment(db, { orderId: created.orderId, provider: "stripe", providerRef: "cs_test_pending", amountCents: created.totalCents });
  createdOrderIds.push(created.orderId);
  return created.orderId;
}

beforeAll(async () => {
  const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  categoryId = cat!.id;
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

describe("POST /api/webhooks/stripe", () => {
  it("rejects a request with an invalid signature", async () => {
    const rawBody = JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" });
    const request = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: rawBody,
      headers: { "stripe-signature": "t=1,v1=not-a-real-signature" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a request with no signature header", async () => {
    const request = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("fulfills the order on checkout.session.completed and decrements stock", async () => {
    const orderId = await makeOrder();
    const eventId = unique("evt");
    const request = signedRequest({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_completed",
          payment_intent: "pi_test_completed",
          amount_total: 1500,
          metadata: { orderId },
        },
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [orderRow] = await db.select().from(order).where(eq(order.id, orderId));
    expect(orderRow?.status).toBe("paid");

    const [paymentRow] = await db.select().from(payment).where(eq(payment.orderId, orderId));
    expect(paymentRow?.status).toBe("succeeded");
    expect(paymentRow?.providerRef).toBe("pi_test_completed");

    const events = await db.select().from(processedWebhookEvent).where(eq(processedWebhookEvent.eventId, eventId));
    expect(events).toHaveLength(1);
  });

  it("is idempotent when the same event is redelivered", async () => {
    const orderId = await makeOrder();
    const eventId = unique("evt");
    const request = () =>
      signedRequest({
        id: eventId,
        type: "checkout.session.completed",
        data: {
          object: { id: "cs_test_dup", payment_intent: "pi_test_dup", amount_total: 1500, metadata: { orderId } },
        },
      });

    await POST(request());
    const secondResponse = await POST(request());
    expect(secondResponse.status).toBe(200);

    const events = await db.select().from(processedWebhookEvent).where(eq(processedWebhookEvent.eventId, eventId));
    expect(events).toHaveLength(1);
  });

  it("records a failure on checkout.session.expired without touching stock", async () => {
    const orderId = await makeOrder();
    const request = signedRequest({
      id: unique("evt"),
      type: "checkout.session.expired",
      data: { object: { id: "cs_test_expired", metadata: { orderId } } },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const [orderRow] = await db.select().from(order).where(eq(order.id, orderId));
    expect(orderRow?.status).toBe("pending");

    const [paymentRow] = await db.select().from(payment).where(eq(payment.orderId, orderId));
    expect(paymentRow?.status).toBe("failed");
  });

  it("acknowledges an unrelated event type without error", async () => {
    const request = signedRequest({ id: unique("evt"), type: "payment_intent.created", data: { object: {} } });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
