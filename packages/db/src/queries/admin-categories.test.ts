import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { auditLog, category, product, user } from "../schema";
import { createCategoryAdmin, deleteCategoryAdmin, updateCategoryAdmin } from "./admin-categories";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeActor(tx: Tx) {
  const uid = unique("admin");
  const [actor] = await tx.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com`, role: "admin" }).returning();
  return actor!.id;
}

describe("createCategoryAdmin", () => {
  it("creates a category and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const result = await createCategoryAdmin(tx, actorId, { name: "Relics", slug: unique("relics") });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, result.id), eq(auditLog.action, "category.create")));
      expect(logs).toHaveLength(1);
    });
  });

  it("rejects a duplicate slug", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const slug = unique("relics");
      const first = await createCategoryAdmin(tx, actorId, { name: "Relics", slug });
      expect(first.ok).toBe(true);
      const second = await createCategoryAdmin(tx, actorId, { name: "Relics Again", slug });
      expect(second).toEqual({ ok: false, reason: "slug_taken" });
    });
  });
});

describe("updateCategoryAdmin", () => {
  it("updates the category and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const created = await createCategoryAdmin(tx, actorId, { name: "Relics", slug: unique("relics") });
      if (!created.ok) throw new Error("setup failed");

      const result = await updateCategoryAdmin(tx, actorId, created.id, { name: "Ancient Relics", slug: unique("relics") });
      expect(result.ok).toBe(true);

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "category.update")));
      expect(logs).toHaveLength(1);
    });
  });
});

describe("deleteCategoryAdmin", () => {
  it("is blocked while a product is assigned", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const created = await createCategoryAdmin(tx, actorId, { name: "Relics", slug: unique("relics") });
      if (!created.ok) throw new Error("setup failed");
      await tx.insert(product).values({ categoryId: created.id, name: "Relic", slug: unique("relic"), basePriceCents: 100 });

      const result = await deleteCategoryAdmin(tx, actorId, created.id);
      expect(result).toEqual({ ok: false, reason: "has_products" });
    });
  });

  it("is blocked while it has a child category", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const parent = await createCategoryAdmin(tx, actorId, { name: "Armor", slug: unique("armor") });
      if (!parent.ok) throw new Error("setup failed");
      await createCategoryAdmin(tx, actorId, { name: "Helmets", slug: unique("helmets"), parentId: parent.id });

      const result = await deleteCategoryAdmin(tx, actorId, parent.id);
      expect(result).toEqual({ ok: false, reason: "has_children" });
    });
  });

  it("deletes an empty leaf category and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const created = await createCategoryAdmin(tx, actorId, { name: "Relics", slug: unique("relics") });
      if (!created.ok) throw new Error("setup failed");

      const result = await deleteCategoryAdmin(tx, actorId, created.id);
      expect(result).toEqual({ ok: true });

      const [row] = await tx.select().from(category).where(eq(category.id, created.id));
      expect(row).toBeUndefined();

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "category.delete")));
      expect(logs).toHaveLength(1);
    });
  });
});
