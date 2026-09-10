import { describe, expect, it } from "vitest";
import { products } from "../lib/catalog";
import { addItem, cartTotal, initialState, parseState, updateItem, visibleProducts } from "../lib/store";

describe("demo browser state", () => {
  const variant = products[0]!.variants[0]!;

  it("falls back safely for missing, malformed, or outdated state", () => {
    expect(parseState(null)).toEqual(initialState);
    expect(parseState("not-json")).toEqual(initialState);
    expect(parseState('{"version":2}')).toEqual(initialState);
  });

  it("keeps only valid persisted cart and wishlist entries", () => {
    const parsed = parseState(JSON.stringify({ version: 1, cart: [{ variantId: variant.id, quantity: 2 }, { variantId: "missing", quantity: 1 }], wishlist: [products[0]!.slug, "missing"], orders: [], hiddenProducts: [] }));
    expect(parsed.cart).toEqual([{ variantId: variant.id, quantity: 2 }]);
    expect(parsed.wishlist).toEqual([products[0]!.slug]);
  });

  it("caps additions and updates at fixture stock", () => {
    const added = addItem(initialState, variant.id, variant.stock + 10);
    expect(added.cart[0]?.quantity).toBe(variant.stock);
    expect(updateItem(added, variant.id, variant.stock + 20).cart[0]?.quantity).toBe(variant.stock);
  });

  it("removes zero quantities and calculates the cart total", () => {
    const added = addItem(initialState, variant.id, 2);
    expect(cartTotal(added)).toBe(products[0]!.priceCents * 2);
    expect(updateItem(added, variant.id, 0).cart).toHaveLength(0);
  });

  it("applies local catalog visibility overrides", () => {
    const state = { ...initialState, hiddenProducts: [products[0]!.slug] };
    expect(visibleProducts(state)).not.toContainEqual(products[0]);
    expect(visibleProducts(initialState)).toHaveLength(products.length);
  });
});
