import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { auditLog, category, order, orderItem, product, productVariant, user } from "../schema";
import { adjustStockAdmin, createVariantAdmin, deleteVariantAdmin, updateVariantAdmin } from "./admin-variants";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeActorAndProduct(tx: Tx) {
  const uid = unique("admin");
  const [actor] = await tx.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com`, role: "admin" }).returning();
  const [cat] = await tx.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  const [prod] = await tx
    .insert(product)
    .values({ categoryId: cat!.id, name: "Test Sword", slug: unique("test-sword"), basePriceCents: 1000 })
    .returning();
  return { actorId: actor!.id, productId: prod!.id };
}

describe("createVariantAdmin", () => {
  it("creates a variant at zero stock and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, productId } = await makeActorAndProduct(tx);
      const variant = await createVariantAdmin(tx, actorId, productId, { name: "Large", sku: unique("SKU") });
      expect(variant.stock).toBe(0);

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, variant.id), eq(auditLog.action, "variant.create")));
      expect(logs).toHaveLength(1);
    });
  });
});

describe("updateVariantAdmin", () => {
  it("updates the variant and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, productId } = await makeActorAndProduct(tx);
      const variant = await createVariantAdmin(tx, actorId, productId, { name: "Large", sku: unique("SKU") });

      const updated = await updateVariantAdmin(tx, actorId, variant.id, { name: "Extra Large", sku: variant.sku });
      expect(updated?.name).toBe("Extra Large");

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, variant.id), eq(auditLog.action, "variant.update")));
      expect(logs).toHaveLength(1);
    });
  });
});

describe("adjustStockAdmin", () => {
  it("restocks and writes an inventory log and an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, productId } = await makeActorAndProduct(tx);
      const variant = await createVariantAdmin(tx, actorId, productId, { name: "Large", sku: unique("SKU") });

      const result = await adjustStockAdmin(tx, actorId, variant.id, 10, "restock");
      expect(result).toEqual({ ok: true, stock: 10 });

      const logs = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, variant.id), eq(auditLog.action, "variant.stock_adjust")));
      expect(logs).toHaveLength(1);
    });
  });

  it("rejects an adjustment that would take stock negative", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, productId } = await makeActorAndProduct(tx);
      const variant = await createVariantAdmin(tx, actorId, productId, { name: "Large", sku: unique("SKU") });
      await adjustStockAdmin(tx, actorId, variant.id, 3, "restock");

      const result = await adjustStockAdmin(tx, actorId, variant.id, -5, "adjustment");
      expect(result).toEqual({ ok: false, reason: "would_go_negative" });

      const [row] = await tx.select({ stock: productVariant.stock }).from(productVariant).where(eq(productVariant.id, variant.id));
      expect(row?.stock).toBe(3);
    });
  });
});

describe("deleteVariantAdmin", () => {
  it("deletes an unordered variant and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, productId } = await makeActorAndProduct(tx);
      const variant = await createVariantAdmin(tx, actorId, productId, { name: "Large", sku: unique("SKU") });

      const result = await deleteVariantAdmin(tx, actorId, variant.id);
      expect(result).toEqual({ ok: true });

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, variant.id), eq(auditLog.action, "variant.delete")));
      expect(logs).toHaveLength(1);
    });
  });

  it("is blocked once the variant has been ordered", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, productId } = await makeActorAndProduct(tx);
      const variant = await createVariantAdmin(tx, actorId, productId, { name: "Large", sku: unique("SKU") });

      const [orderRow] = await tx
        .insert(order)
        .values({
          orderNumber: unique("MDV"),
          guestEmail: "guest@example.com",
          status: "paid",
          subtotalCents: 1000,
          totalCents: 1000,
          shippingAddress: {
            fullName: "Test",
            line1: "1 Way",
            city: "Town",
            region: "Region",
            postalCode: "00001",
            country: "US",
          },
        })
        .returning();
      await tx.insert(orderItem).values({
        orderId: orderRow!.id,
        productId,
        variantId: variant.id,
        nameSnapshot: "Test Sword",
        unitPriceCents: 1000,
        quantity: 1,
        lineTotalCents: 1000,
      });

      const result = await deleteVariantAdmin(tx, actorId, variant.id);
      expect(result).toEqual({ ok: false, reason: "has_orders" });
    });
  });
});
