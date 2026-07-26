import { asc } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { category } from "../schema";

export type CategoryNavChild = {
  id: string;
  name: string;
  slug: string;
};

export type CategoryNavNode = CategoryNavChild & {
  children: CategoryNavChild[];
};

/**
 * Returns the full category tree (one level of nesting, per the data model)
 * as a single query — small, static-ish table, no pagination needed.
 */
export async function listCategoryTree(db: DbClient): Promise<CategoryNavNode[]> {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
    })
    .from(category)
    .orderBy(asc(category.createdAt));

  const childrenByParentId = new Map<string, CategoryNavChild[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const siblings = childrenByParentId.get(row.parentId) ?? [];
    siblings.push({ id: row.id, name: row.name, slug: row.slug });
    childrenByParentId.set(row.parentId, siblings);
  }

  return rows
    .filter((row) => !row.parentId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      children: childrenByParentId.get(row.id) ?? [],
    }));
}
