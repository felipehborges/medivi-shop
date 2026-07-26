import { eq, sql } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { isCheckViolation, isForeignKeyViolation } from "../lib/pg-errors";
import { auditLog, inventoryLog, productVariant, type InventoryChangeReason } from "../schema";

export type VariantInput = {
  name: string;
  sku: string;
  priceOverrideCents?: number | null;
  attributes?: Record<string, string> | null;
};

export type VariantRow = typeof productVariant.$inferSelect;

export async function createVariantAdmin(
  db: DbClient,
  actorId: string,
  productId: string,
  input: VariantInput,
): Promise<VariantRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productVariant)
      .values({ productId, ...input, stock: 0 })
      .returning();
    if (!row) throw new Error("Failed to create variant");

    await tx.insert(auditLog).values({
      actorId,
      action: "variant.create",
      entityType: "product_variant",
      entityId: row.id,
      diff: { to: input },
    });
    return row;
  });
}

export async function updateVariantAdmin(
  db: DbClient,
  actorId: string,
  id: string,
  input: VariantInput,
): Promise<VariantRow | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(productVariant).where(eq(productVariant.id, id)).limit(1);
    if (!before) return null;

    const [row] = await tx
      .update(productVariant)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(productVariant.id, id))
      .returning();
    await tx.insert(auditLog).values({
      actorId,
      action: "variant.update",
      entityType: "product_variant",
      entityId: id,
      diff: { from: before, to: input },
    });
    return row ?? null;
  });
}

export type DeleteVariantResult = { ok: true } | { ok: false; reason: "not_found" | "has_orders" };

/** `order_item` holds a `restrict` FK on `variantId` — a variant that has ever sold can't be hard-deleted. */
export async function deleteVariantAdmin(db: DbClient, actorId: string, id: string): Promise<DeleteVariantResult> {
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(productVariant).where(eq(productVariant.id, id)).limit(1);
      if (!before) return { ok: false, reason: "not_found" };

      await tx.delete(productVariant).where(eq(productVariant.id, id));
      await tx.insert(auditLog).values({
        actorId,
        action: "variant.delete",
        entityType: "product_variant",
        entityId: id,
        diff: { from: before },
      });
      return { ok: true };
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) return { ok: false, reason: "has_orders" };
    throw err;
  }
}

export type AdjustStockResult = { ok: true; stock: number } | { ok: false; reason: "not_found" | "would_go_negative" };

/**
 * The admin-facing counterpart to the webhook's guarded stock decrement
 * (docs/architecture.md §4) — same non-negative invariant, enforced here via
 * the same `stock >= 0` check constraint rather than duplicating the guard
 * clause, since this is a plain admin-initiated write, not a concurrent
 * fulfillment race.
 */
export async function adjustStockAdmin(
  db: DbClient,
  actorId: string,
  variantId: string,
  delta: number,
  reason: Exclude<InventoryChangeReason, "order">,
): Promise<AdjustStockResult> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(productVariant)
        .set({ stock: sql`${productVariant.stock} + ${delta}`, updatedAt: new Date() })
        .where(eq(productVariant.id, variantId))
        .returning({ stock: productVariant.stock });
      if (!row) return { ok: false, reason: "not_found" };

      await tx.insert(inventoryLog).values({ variantId, change: delta, reason });
      await tx.insert(auditLog).values({
        actorId,
        action: "variant.stock_adjust",
        entityType: "product_variant",
        entityId: variantId,
        diff: { change: delta, reason, newStock: row.stock },
      });
      return { ok: true, stock: row.stock };
    });
  } catch (err) {
    if (isCheckViolation(err, "product_variant_stock_non_negative")) {
      return { ok: false, reason: "would_go_negative" };
    }
    throw err;
  }
}
