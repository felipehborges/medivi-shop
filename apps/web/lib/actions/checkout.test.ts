import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { cart, cartItem, category, order, orderItem, payment, product, productVariant, user } from "@medivi/db/schema";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const { checkoutAction } = await import("./checkout");
const { addToCartAction } = await import("./cart");
const { readGuestCartToken } = await import("@/lib/guest-cart-cookie");

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
let variantId: string;
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];
const createdGuestTokens: string[] = [];

beforeAll(async () => {
  const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  categoryId = cat!.id;
  const slug = unique("prod");
  const [p] = await db
    .insert(product)
    .values({ categoryId, name: slug, slug, basePriceCents: 1200, status: "active" })
    .returning();
  const [v] = await db
    .insert(productVariant)
    .values({ productId: p!.id, name: "Standard", sku: unique("SKU"), stock: 10 })
    .returning();
  variantId = v!.id;
});

afterEach(async () => {
  const guestToken = await readGuestCartToken();
  if (guestToken) createdGuestTokens.push(guestToken);

  cookieJar.clear();
  getSessionMock.mockReset();
  redirectMock.mockClear();
  for (const id of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, id));
  }
});

afterAll(async () => {
  for (const orderId of createdOrderIds) {
    await db.delete(payment).where(eq(payment.orderId, orderId));
    await db.delete(orderItem).where(eq(orderItem.orderId, orderId));
    await db.delete(order).where(eq(order.id, orderId));
  }
  for (const token of createdGuestTokens) {
    await db.delete(cart).where(eq(cart.guestToken, token));
  }
  await db.delete(product).where(eq(product.categoryId, categoryId));
  await db.delete(category).where(eq(category.id, categoryId));
});

async function makeUser() {
  const id = unique("user");
  const [row] = await db.insert(user).values({ id, name: id, email: `${id}@example.com` }).returning();
  createdUserIds.push(row!.id);
  return row!;
}

async function findOrderByGuestEmail(guestEmail: string) {
  const [row] = await db.select().from(order).where(eq(order.guestEmail, guestEmail));
  return row;
}

describe("checkoutAction", () => {
  it("requires a guest email when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await checkoutAction({
      shippingAddress,
      shippingMethodId: "standard",
    } as never);
    expect(result).toEqual({ ok: false, reason: "guest_email_required" });
  });

  it("rejects checkout with an empty cart", async () => {
    const u = await makeUser();
    getSessionMock.mockResolvedValue({ user: { id: u.id, email: u.email } });

    const result = await checkoutAction({ shippingAddress, shippingMethodId: "standard" });
    expect(result).toEqual({ ok: false, reason: "empty_cart" });
  });

  it("creates a pending order + payment and redirects to the mock checkout page", async () => {
    getSessionMock.mockResolvedValue(null);
    await addToCartAction({ variantId, quantity: 2 });

    await expect(
      checkoutAction({
        guestEmail: "guest@example.com",
        shippingAddress,
        shippingMethodId: "standard",
      }),
    ).rejects.toThrow(/^REDIRECT:/);

    expect(redirectMock).toHaveBeenCalledTimes(1);
    const redirectUrl = redirectMock.mock.calls[0]![0] as string;
    expect(redirectUrl).toContain("/checkout/mock/");

    const createdOrder = await findOrderByGuestEmail("guest@example.com");
    createdOrderIds.push(createdOrder!.id);
    expect(createdOrder!.subtotalCents).toBe(2400);
    expect(createdOrder!.shippingCents).toBe(500);
    expect(createdOrder!.totalCents).toBe(2900);
    expect(createdOrder!.status).toBe("pending");
    expect(createdOrder!.guestEmail).toBe("guest@example.com");

    const payments = await db.select().from(payment).where(eq(payment.orderId, createdOrder!.id));
    expect(payments).toHaveLength(1);
    expect(payments[0]?.amountCents).toBe(2900);
    expect(payments[0]?.status).toBe("requires_payment");
  });

  it("blocks checkout when the cart price drifted from the live price", async () => {
    const u = await makeUser();
    getSessionMock.mockResolvedValue({ user: { id: u.id, email: u.email } });
    await addToCartAction({ variantId, quantity: 1 });
    await db.update(product).set({ basePriceCents: 5000 }).where(eq(product.categoryId, categoryId));

    const result = await checkoutAction({ shippingAddress, shippingMethodId: "standard" });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "stock_or_price_changed") throw new Error("expected a price-changed failure");
    expect(result.issues[0]).toMatchObject({ kind: "price" });

    // Reset for later tests in this file.
    await db.update(product).set({ basePriceCents: 1200 }).where(eq(product.categoryId, categoryId));
    const [cartRow] = await db.select().from(cart).where(eq(cart.userId, u.id));
    if (cartRow) await db.delete(cartItem).where(eq(cartItem.cartId, cartRow.id));
  });
});
