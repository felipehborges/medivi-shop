import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { auditLog, category, product, productVariant, user } from "@medivi/db/schema";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { adjustStockAction, createVariantAction, deleteVariantAction, updateVariantAction } = await import(
  "./admin-variants"
);

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

let categoryId: string;
let productId: string;
let adminId: string;
const createdVariantIds: string[] = [];

beforeAll(async () => {
  const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  categoryId = cat!.id;
  const [prod] = await db
    .insert(product)
    .values({ categoryId, name: "Test Sword", slug: unique("test-sword"), basePriceCents: 1000 })
    .returning();
  productId = prod!.id;
  const aid = unique("admin");
  const [admin] = await db.insert(user).values({ id: aid, name: aid, email: `${aid}@example.com`, role: "admin" }).returning();
  adminId = admin!.id;
});

afterEach(() => {
  requireAdminMock.mockReset();
});

afterAll(async () => {
  for (const id of createdVariantIds) {
    await db.delete(auditLog).where(eq(auditLog.entityId, id));
  }
  await db.delete(product).where(eq(product.id, productId));
  await db.delete(category).where(eq(category.id, categoryId));
  await db.delete(user).where(eq(user.id, adminId));
});

describe("non-admin rejection", () => {
  it("rejects every variant action for a non-admin caller", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT:/"));
    await expect(createVariantAction({ productId, name: "Large", sku: unique("SKU") })).rejects.toThrow("REDIRECT:/");
    await expect(
      updateVariantAction({ id: unique("id"), productId, name: "Large", sku: unique("SKU") }),
    ).rejects.toThrow("REDIRECT:/");
    await expect(deleteVariantAction({ id: unique("id"), productId })).rejects.toThrow("REDIRECT:/");
    await expect(adjustStockAction({ productId, variantId: unique("id"), delta: 1, reason: "restock" })).rejects.toThrow(
      "REDIRECT:/",
    );
  });
});

describe("variant lifecycle for an admin caller", () => {
  it("creates a variant, adjusts stock, updates it, then deletes it", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });

    await createVariantAction({ productId, name: "Large", sku: unique("SKU") });
    const [variant] = await db.select().from(productVariant).where(eq(productVariant.productId, productId));
    expect(variant?.stock).toBe(0);
    createdVariantIds.push(variant!.id);

    const stockResult = await adjustStockAction({ productId, variantId: variant!.id, delta: 5, reason: "restock" });
    expect(stockResult).toEqual({ ok: true, stock: 5 });

    await updateVariantAction({ id: variant!.id, productId, name: "Extra Large", sku: variant!.sku });
    const [updated] = await db.select({ name: productVariant.name }).from(productVariant).where(eq(productVariant.id, variant!.id));
    expect(updated?.name).toBe("Extra Large");

    const deleteResult = await deleteVariantAction({ id: variant!.id, productId });
    expect(deleteResult).toEqual({ ok: true });
  });
});
