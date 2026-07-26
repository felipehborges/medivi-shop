import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { analyticsEvent, cart, cartItem, category, product, productVariant, user } from "@medivi/db/schema";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
  requireUser: async () => {
    const session = await getSessionMock();
    if (!session) throw new Error("REDIRECT:/sign-in");
    return session.user;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));
vi.mock("server-only", () => ({}));

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

const {
  addToCartAction,
  mergeCartOnLogin,
  removeCartItemAction,
  updateCartItemAction,
} = await import("./cart");
const { readGuestCartToken } = await import("@/lib/guest-cart-cookie");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

let categoryId: string;
let lowStockVariantId: string;
let plentyVariantId: string;
const createdUserIds: string[] = [];
const createdGuestTokens: string[] = [];
const createdAnalyticsSessionIds: string[] = [];

beforeAll(async () => {
  const [cat] = await db
    .insert(category)
    .values({ name: unique("cat"), slug: unique("cat") })
    .returning();
  categoryId = cat!.id;

  const slug = unique("prod");
  const [p] = await db
    .insert(product)
    .values({ categoryId, name: slug, slug, basePriceCents: 1500, status: "active" })
    .returning();

  const [lowStock] = await db
    .insert(productVariant)
    .values({ productId: p!.id, name: "Low", sku: unique("SKU"), stock: 1 })
    .returning();
  lowStockVariantId = lowStock!.id;

  const [plenty] = await db
    .insert(productVariant)
    .values({ productId: p!.id, name: "Plenty", sku: unique("SKU"), stock: 20 })
    .returning();
  plentyVariantId = plenty!.id;
});

afterEach(async () => {
  const guestToken = await readGuestCartToken();
  if (guestToken) createdGuestTokens.push(guestToken);
  const analyticsSessionId = cookieJar.get("medivi_analytics_session");
  if (analyticsSessionId) createdAnalyticsSessionIds.push(analyticsSessionId);

  cookieJar.clear();
  getSessionMock.mockReset();
  for (const id of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, id));
  }
});

afterAll(async () => {
  for (const token of createdGuestTokens) {
    await db.delete(cart).where(eq(cart.guestToken, token));
  }
  for (const sessionId of createdAnalyticsSessionIds) {
    await db.delete(analyticsEvent).where(eq(analyticsEvent.sessionId, sessionId));
  }
  await db.delete(product).where(eq(product.categoryId, categoryId));
  await db.delete(category).where(eq(category.id, categoryId));
});

async function makeUser() {
  const id = unique("user");
  const [row] = await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com` })
    .returning();
  createdUserIds.push(row!.id);
  return row!;
}

describe("addToCartAction", () => {
  it("mints a guest cart cookie and adds the item for an anonymous visitor", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await addToCartAction({ variantId: plentyVariantId, quantity: 2 });
    expect(result).toEqual({ ok: true });

    const guestToken = await readGuestCartToken();
    expect(guestToken).not.toBeNull();

    const [cartRow] = await db.select().from(cart).where(eq(cart.guestToken, guestToken!));
    expect(cartRow).toBeTruthy();
  });

  it("adds to the signed-in user's cart when a session exists", async () => {
    const u = await makeUser();
    getSessionMock.mockResolvedValue({ user: { id: u.id } });

    const result = await addToCartAction({ variantId: plentyVariantId, quantity: 1 });
    expect(result).toEqual({ ok: true });

    const [cartRow] = await db.select().from(cart).where(eq(cart.userId, u.id));
    expect(cartRow).toBeTruthy();
  });

  it("blocks adding more than available stock", async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await addToCartAction({ variantId: lowStockVariantId, quantity: 5 });
    expect(result).toEqual({ ok: false, reason: "insufficient_stock", available: 1 });
  });

  it("rejects an invalid variant id at the Zod boundary", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(addToCartAction({ variantId: "not-a-uuid", quantity: 1 })).rejects.toThrow();
  });
});

describe("updateCartItemAction and removeCartItemAction", () => {
  it("updates then removes a guest cart item", async () => {
    getSessionMock.mockResolvedValue(null);
    await addToCartAction({ variantId: plentyVariantId, quantity: 1 });
    const guestToken = await readGuestCartToken();
    const [cartRow] = await db.select().from(cart).where(eq(cart.guestToken, guestToken!));
    const items = await db.select().from(cartItem).where(eq(cartItem.cartId, cartRow!.id));
    const itemId = items[0]!.id;

    const updateResult = await updateCartItemAction({ itemId, quantity: 3 });
    expect(updateResult).toEqual({ ok: true });

    await removeCartItemAction({ itemId });
    const remaining = await db.select().from(cartItem).where(eq(cartItem.cartId, cartRow!.id));
    expect(remaining).toHaveLength(0);
  });
});

describe("mergeCartOnLogin", () => {
  it("merges the guest cart into the user's cart and clears the guest cookie", async () => {
    getSessionMock.mockResolvedValue(null);
    await addToCartAction({ variantId: plentyVariantId, quantity: 2 });
    const guestToken = await readGuestCartToken();

    const u = await makeUser();
    getSessionMock.mockResolvedValue({ user: { id: u.id } });
    await mergeCartOnLogin();

    const [userCart] = await db.select().from(cart).where(eq(cart.userId, u.id));
    expect(userCart).toBeTruthy();

    const [guestCart] = await db.select().from(cart).where(eq(cart.guestToken, guestToken!));
    expect(guestCart).toBeUndefined();

    const afterMergeToken = await readGuestCartToken();
    expect(afterMergeToken).toBeNull();
  });
});
