import { asc, count, eq } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { isForeignKeyViolation, isUniqueViolation } from "../lib/pg-errors";
import { auditLog, category, product } from "../schema";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  parentName: string | null;
  productCount: number;
};

/** Flat list (parent name inlined) — the admin UI renders its own indentation from `parentId`, no tree recursion needed for one level of nesting. */
export async function listCategoriesAdmin(db: DbClient): Promise<AdminCategory[]> {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      parentId: category.parentId,
      productCount: count(product.id),
    })
    .from(category)
    .leftJoin(product, eq(product.categoryId, category.id))
    .groupBy(category.id)
    .orderBy(asc(category.createdAt));

  const namesById = new Map(rows.map((r) => [r.id, r.name]));

  return rows.map((row) => ({
    ...row,
    parentName: row.parentId ? namesById.get(row.parentId) ?? null : null,
  }));
}

export type CategoryInput = {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string | null;
};

export type SaveCategoryResult = { ok: true; id: string } | { ok: false; reason: "slug_taken" | "not_found" };

export async function createCategoryAdmin(
  db: DbClient,
  actorId: string,
  input: CategoryInput,
): Promise<SaveCategoryResult> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(category)
        .values({ ...input, parentId: input.parentId ?? null })
        .returning({ id: category.id });
      if (!row) throw new Error("Failed to create category");

      await tx.insert(auditLog).values({
        actorId,
        action: "category.create",
        entityType: "category",
        entityId: row.id,
        diff: { to: input },
      });
      return { ok: true, id: row.id };
    });
  } catch (err) {
    if (isUniqueViolation(err, "category_slug_unique")) return { ok: false, reason: "slug_taken" };
    throw err;
  }
}

export async function updateCategoryAdmin(
  db: DbClient,
  actorId: string,
  id: string,
  input: CategoryInput,
): Promise<SaveCategoryResult> {
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(category).where(eq(category.id, id)).limit(1);
      if (!before) return { ok: false, reason: "not_found" };

      await tx
        .update(category)
        .set({ ...input, parentId: input.parentId ?? null, updatedAt: new Date() })
        .where(eq(category.id, id));
      await tx.insert(auditLog).values({
        actorId,
        action: "category.update",
        entityType: "category",
        entityId: id,
        diff: { from: before, to: input },
      });
      return { ok: true, id };
    });
  } catch (err) {
    if (isUniqueViolation(err, "category_slug_unique")) return { ok: false, reason: "slug_taken" };
    throw err;
  }
}

export type DeleteCategoryResult = { ok: true } | { ok: false; reason: "not_found" | "has_products" | "has_children" };

/** Blocked while any product is assigned, or while it has child categories — both are `restrict` FKs, so this pre-checks rather than letting the delete throw. */
export async function deleteCategoryAdmin(db: DbClient, actorId: string, id: string): Promise<DeleteCategoryResult> {
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(category).where(eq(category.id, id)).limit(1);
      if (!before) return { ok: false, reason: "not_found" };

      const productCountRows = await tx
        .select({ productCount: count() })
        .from(product)
        .where(eq(product.categoryId, id));
      if ((productCountRows[0]?.productCount ?? 0) > 0) return { ok: false, reason: "has_products" };

      const childCountRows = await tx
        .select({ childCount: count() })
        .from(category)
        .where(eq(category.parentId, id));
      if ((childCountRows[0]?.childCount ?? 0) > 0) return { ok: false, reason: "has_children" };

      await tx.delete(category).where(eq(category.id, id));
      await tx.insert(auditLog).values({
        actorId,
        action: "category.delete",
        entityType: "category",
        entityId: id,
        diff: { from: before },
      });
      return { ok: true };
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) return { ok: false, reason: "has_products" };
    throw err;
  }
}

export type CategoryOption = { id: string; name: string; parentId: string | null };

export async function listCategoryOptions(db: DbClient): Promise<CategoryOption[]> {
  return db
    .select({ id: category.id, name: category.name, parentId: category.parentId })
    .from(category)
    .orderBy(asc(category.name));
}
