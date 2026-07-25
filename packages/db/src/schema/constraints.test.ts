import { describe, expect, it } from "vitest";
import { withTestTransaction } from "../test";
import { category, product, productVariant } from "./index";
import { cart } from "./cart";

async function expectConstraintViolation(
  promise: Promise<unknown>,
  constraintName: string,
) {
  let thrown: unknown;
  try {
    await promise;
  } catch (err) {
    thrown = err;
  }
  expect(thrown, "expected the insert to reject").toBeDefined();
  const cause = (thrown as { cause?: { constraint_name?: string } }).cause;
  expect(cause?.constraint_name).toBe(constraintName);
}

describe("product_variant stock >= 0 constraint", () => {
  it("rejects a negative stock value", async () => {
    await withTestTransaction(async (tx) => {
      const [cat] = await tx
        .insert(category)
        .values({ name: "Test Category", slug: `test-cat-${Date.now()}` })
        .returning();
      const [prod] = await tx
        .insert(product)
        .values({
          categoryId: cat!.id,
          name: "Test Product",
          slug: `test-product-${Date.now()}`,
          basePriceCents: 1000,
          status: "active",
        })
        .returning();

      await expectConstraintViolation(
        tx.insert(productVariant).values({
          productId: prod!.id,
          name: "Standard",
          sku: `TEST-SKU-${Date.now()}`,
          stock: -1,
        }),
        "product_variant_stock_non_negative",
      );
    });
  });
});

describe("cart owner xor constraint", () => {
  it("rejects a cart with both userId and guestToken null", async () => {
    await withTestTransaction(async (tx) => {
      await expectConstraintViolation(
        tx.insert(cart).values({ userId: null, guestToken: null }),
        "cart_owner_xor",
      );
    });
  });

  it("rejects a cart with both userId and guestToken set", async () => {
    await withTestTransaction(async (tx) => {
      await expectConstraintViolation(
        tx.insert(cart).values({
          userId: "some-user-id",
          guestToken: "some-guest-token",
        }),
        "cart_owner_xor",
      );
    });
  });

  it("allows a guest-only cart", async () => {
    await withTestTransaction(async (tx) => {
      const [row] = await tx
        .insert(cart)
        .values({ guestToken: `guest-${Date.now()}` })
        .returning();
      expect(row?.id).toBeTruthy();
    });
  });
});
