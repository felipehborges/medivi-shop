import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { auditLog, category, user } from "../schema";
import {
  addProductImageAdmin,
  createProductAdmin,
  deleteProductImageAdmin,
  getProductForAdmin,
  setProductStatusAdmin,
  updateProductAdmin,
} from "./admin-products";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeActorAndCategory(tx: Tx) {
  const uid = unique("admin");
  const [actor] = await tx.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com`, role: "admin" }).returning();
  const [cat] = await tx.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  return { actorId: actor!.id, categoryId: cat!.id };
}

function baseInput(categoryId: string) {
  return {
    categoryId,
    name: "Test Sword",
    slug: unique("test-sword"),
    basePriceCents: 1000,
    status: "draft" as const,
  };
}

describe("createProductAdmin", () => {
  it("creates a product with a default variant and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, categoryId } = await makeActorAndCategory(tx);
      const result = await createProductAdmin(tx, actorId, baseInput(categoryId));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const detail = await getProductForAdmin(tx, result.id);
      expect(detail?.variants).toHaveLength(1);
      expect(detail?.variants[0]?.stock).toBe(0);

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, result.id), eq(auditLog.action, "product.create")));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.actorId).toBe(actorId);
    });
  });

  it("rejects a duplicate slug", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, categoryId } = await makeActorAndCategory(tx);
      const input = baseInput(categoryId);
      const first = await createProductAdmin(tx, actorId, input);
      expect(first.ok).toBe(true);

      const second = await createProductAdmin(tx, actorId, input);
      expect(second).toEqual({ ok: false, reason: "slug_taken" });
    });
  });
});

describe("updateProductAdmin", () => {
  it("updates fields and writes an audit log row with a from/to diff", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, categoryId } = await makeActorAndCategory(tx);
      const created = await createProductAdmin(tx, actorId, baseInput(categoryId));
      if (!created.ok) throw new Error("setup failed");

      const result = await updateProductAdmin(tx, actorId, created.id, {
        ...baseInput(categoryId),
        slug: unique("updated-sword"),
        name: "Updated Sword",
      });
      expect(result.ok).toBe(true);

      const detail = await getProductForAdmin(tx, created.id);
      expect(detail?.name).toBe("Updated Sword");

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "product.update")));
      expect(logs).toHaveLength(1);
    });
  });

  it("returns not_found for a nonexistent product", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, categoryId } = await makeActorAndCategory(tx);
      const result = await updateProductAdmin(tx, actorId, "00000000-0000-0000-0000-000000000000", baseInput(categoryId));
      expect(result).toEqual({ ok: false, reason: "not_found" });
    });
  });
});

describe("setProductStatusAdmin", () => {
  it("soft-deletes by moving status to archived and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, categoryId } = await makeActorAndCategory(tx);
      const created = await createProductAdmin(tx, actorId, { ...baseInput(categoryId), status: "active" });
      if (!created.ok) throw new Error("setup failed");

      const result = await setProductStatusAdmin(tx, actorId, created.id, "archived");
      expect(result).toEqual({ ok: true });

      const detail = await getProductForAdmin(tx, created.id);
      expect(detail?.status).toBe("archived");

      const logs = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "product.status_change")));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.diff).toEqual({ from: "active", to: "archived" });
    });
  });
});

describe("product image management", () => {
  it("adds and deletes an image, writing an audit log row for each", async () => {
    await withTestTransaction(async (tx) => {
      const { actorId, categoryId } = await makeActorAndCategory(tx);
      const created = await createProductAdmin(tx, actorId, baseInput(categoryId));
      if (!created.ok) throw new Error("setup failed");

      const image = await addProductImageAdmin(tx, actorId, created.id, { url: "https://example.com/a.png", altText: "A sword" });
      const afterAdd = await getProductForAdmin(tx, created.id);
      expect(afterAdd?.images).toHaveLength(1);

      const deleted = await deleteProductImageAdmin(tx, actorId, image.id);
      expect(deleted?.url).toBe("https://example.com/a.png");
      const afterDelete = await getProductForAdmin(tx, created.id);
      expect(afterDelete?.images).toHaveLength(0);

      const logs = await tx.select().from(auditLog).where(eq(auditLog.entityId, created.id));
      expect(logs.map((l) => l.action)).toEqual(
        expect.arrayContaining(["product.create", "product.image_add", "product.image_delete"]),
      );
    });
  });
});
