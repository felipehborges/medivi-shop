import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { isUniqueViolation } from "../lib/pg-errors";
import { auditLog, category, product, productImage, productVariant, type ProductStatus } from "../schema";

const DEFAULT_PAGE_SIZE = 20;

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  basePriceCents: number;
  status: ProductStatus;
  isFeatured: boolean;
  categoryName: string;
  imageUrl: string | null;
  totalStock: number;
};

export type AdminProductListParams = {
  search?: string;
  status?: ProductStatus;
  page?: number;
  pageSize?: number;
};

export type AdminProductListResult = {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function firstImageSubquery(db: DbClient) {
  return db
    .select({ value: productImage.url })
    .from(productImage)
    .where(eq(productImage.productId, product.id))
    .orderBy(asc(productImage.position))
    .limit(1);
}

function totalStockSubquery(db: DbClient) {
  return db
    .select({ value: sql<number>`coalesce(sum(${productVariant.stock}), 0)` })
    .from(productVariant)
    .where(eq(productVariant.productId, product.id));
}

/** Unlike the storefront's `listProducts`, this includes every status (draft/active/archived) — the admin needs to see and manage all of it. */
export async function listProductsAdmin(
  db: DbClient,
  params: AdminProductListParams = {},
): Promise<AdminProductListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const conditions = [];
  if (params.status) conditions.push(eq(product.status, params.status));
  if (params.search) conditions.push(ilike(product.name, `%${params.search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(product).where(where);
  const total = totalRow?.total ?? 0;

  const items = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      basePriceCents: product.basePriceCents,
      status: product.status,
      isFeatured: product.isFeatured,
      categoryName: category.name,
      imageUrl: sql<string | null>`(${firstImageSubquery(db)})`,
      totalStock: sql<number>`(${totalStockSubquery(db)})`.mapWith(Number),
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .where(where)
    .orderBy(desc(product.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type AdminProductImage = { id: string; url: string; altText: string; position: number };
export type AdminProductVariant = {
  id: string;
  name: string;
  sku: string;
  priceOverrideCents: number | null;
  stock: number;
  attributes: Record<string, string> | null;
};

export type AdminProductDetail = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  material: string | null;
  basePriceCents: number;
  currency: string;
  status: ProductStatus;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  images: AdminProductImage[];
  variants: AdminProductVariant[];
};

/** Lightweight lookup for callers that only need the name (e.g. the image upload alt-text fallback), not the full detail join. */
export async function getProductName(db: DbClient, id: string): Promise<string | null> {
  const [row] = await db.select({ name: product.name }).from(product).where(eq(product.id, id)).limit(1);
  return row?.name ?? null;
}

export async function getProductForAdmin(db: DbClient, id: string): Promise<AdminProductDetail | null> {
  const [row] = await db.select().from(product).where(eq(product.id, id)).limit(1);
  if (!row) return null;

  const images = await db
    .select({ id: productImage.id, url: productImage.url, altText: productImage.altText, position: productImage.position })
    .from(productImage)
    .where(eq(productImage.productId, id))
    .orderBy(asc(productImage.position));

  const variants = await db
    .select({
      id: productVariant.id,
      name: productVariant.name,
      sku: productVariant.sku,
      priceOverrideCents: productVariant.priceOverrideCents,
      stock: productVariant.stock,
      attributes: productVariant.attributes,
    })
    .from(productVariant)
    .where(eq(productVariant.productId, id))
    .orderBy(asc(productVariant.createdAt));

  return { ...row, images, variants };
}

export type ProductInput = {
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  longDescription?: string;
  material?: string;
  basePriceCents: number;
  status: ProductStatus;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export type SaveProductResult = { ok: true; id: string } | { ok: false; reason: "slug_taken" | "not_found" };

/** Every product gets an implicit default variant at creation time (see docs/architecture.md §3). */
export async function createProductAdmin(
  db: DbClient,
  actorId: string,
  input: ProductInput,
): Promise<SaveProductResult> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(product).values(input).returning({ id: product.id });
      if (!row) throw new Error("Failed to create product");

      await tx.insert(productVariant).values({
        productId: row.id,
        name: "Default",
        sku: `SKU-${row.id.slice(0, 8).toUpperCase()}`,
        stock: 0,
      });
      await tx.insert(auditLog).values({
        actorId,
        action: "product.create",
        entityType: "product",
        entityId: row.id,
        diff: { to: input },
      });
      return { ok: true, id: row.id };
    });
  } catch (err) {
    if (isUniqueViolation(err, "product_slug_unique")) return { ok: false, reason: "slug_taken" };
    throw err;
  }
}

export async function updateProductAdmin(
  db: DbClient,
  actorId: string,
  id: string,
  input: ProductInput,
): Promise<SaveProductResult> {
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(product).where(eq(product.id, id)).limit(1);
      if (!before) return { ok: false, reason: "not_found" };

      await tx.update(product).set({ ...input, updatedAt: new Date() }).where(eq(product.id, id));
      await tx.insert(auditLog).values({
        actorId,
        action: "product.update",
        entityType: "product",
        entityId: id,
        diff: { from: before, to: input },
      });
      return { ok: true, id };
    });
  } catch (err) {
    if (isUniqueViolation(err, "product_slug_unique")) return { ok: false, reason: "slug_taken" };
    throw err;
  }
}

/** Soft-delete/restore: `status` moves to/from `archived` rather than removing the row — order items hold a `restrict` FK to products anyway, so a hard delete would fail once a product has ever sold. */
export async function setProductStatusAdmin(
  db: DbClient,
  actorId: string,
  id: string,
  status: ProductStatus,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ status: product.status }).from(product).where(eq(product.id, id)).limit(1);
    if (!before) return { ok: false, reason: "not_found" };

    await tx.update(product).set({ status, updatedAt: new Date() }).where(eq(product.id, id));
    await tx.insert(auditLog).values({
      actorId,
      action: "product.status_change",
      entityType: "product",
      entityId: id,
      diff: { from: before.status, to: status },
    });
    return { ok: true };
  });
}

export type ProductImageRow = typeof productImage.$inferSelect;

export async function addProductImageAdmin(
  db: DbClient,
  actorId: string,
  productId: string,
  input: { url: string; altText: string; position?: number },
): Promise<ProductImageRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productImage)
      .values({ productId, url: input.url, altText: input.altText, position: input.position ?? 0 })
      .returning();
    if (!row) throw new Error("Failed to add product image");

    await tx.insert(auditLog).values({
      actorId,
      action: "product.image_add",
      entityType: "product",
      entityId: productId,
      diff: { imageId: row.id, url: row.url },
    });
    return row;
  });
}

/** Returns the deleted row (with its URL) so the caller can also remove the file from the StorageProvider. */
export async function deleteProductImageAdmin(
  db: DbClient,
  actorId: string,
  imageId: string,
): Promise<ProductImageRow | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx.delete(productImage).where(eq(productImage.id, imageId)).returning();
    if (!row) return null;

    await tx.insert(auditLog).values({
      actorId,
      action: "product.image_delete",
      entityType: "product",
      entityId: row.productId,
      diff: { imageId: row.id, url: row.url },
    });
    return row;
  });
}
