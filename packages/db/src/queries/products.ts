import { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { category, product, productImage, productVariant, wishlist, wishlistItem } from "../schema";

export type ProductSort = "price-asc" | "price-desc" | "newest" | "featured";

export type ProductListParams = {
  categorySlug?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  material?: string;
  inStockOnly?: boolean;
  /** Full-text query, matched against name/description with a trigram fuzzy fallback. */
  query?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  basePriceCents: number;
  material: string | null;
  isFeatured: boolean;
  categoryId: string;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
};

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const TRIGRAM_SIMILARITY_THRESHOLD = 0.2;

/**
 * Matches if the Postgres full-text index hits, OR (fallback for typos/
 * partial words the tsquery parser won't match) the query is a trigram-close
 * match to some word-length window of the product name. `word_similarity`
 * (not the plain `similarity`) is what makes this workable — `similarity`
 * compares whole strings, so a short query gets diluted into a low score
 * against a multi-word name; `word_similarity` finds the best-matching
 * substring instead. Requires the pg_trgm extension — see migration 0003.
 */
function searchCondition(query: string): SQL {
  return sql`(
    ${product.searchVector} @@ websearch_to_tsquery('english', ${query})
    or word_similarity(${query}, ${product.name}) > ${TRIGRAM_SIMILARITY_THRESHOLD}
  )`;
}

function relevanceExpr(query: string): SQL {
  return sql`(
    ts_rank(${product.searchVector}, websearch_to_tsquery('english', ${query}))
    + word_similarity(${query}, ${product.name})
  )`;
}

/**
 * Built via the query builder (not a hand-written `sql` template) so its
 * column references come out table-qualified — `sql\`${product.id}\`` alone
 * renders as the bare column name, which is ambiguous once this is nested
 * inside a subquery over a table that also has an `id`/`product_id` column.
 */
function inStockSubquery(db: DbClient) {
  return db
    .select({ one: sql`1` })
    .from(productVariant)
    .where(and(eq(productVariant.productId, product.id), gt(productVariant.stock, 0)));
}

function firstImageSubquery<C extends typeof productImage.url | typeof productImage.altText>(
  db: DbClient,
  column: C,
) {
  return db
    .select({ value: column })
    .from(productImage)
    .where(eq(productImage.productId, product.id))
    .orderBy(asc(productImage.position))
    .limit(1);
}

async function resolveCategoryAndDescendantIds(
  db: DbClient,
  slug: string,
): Promise<string[]> {
  const [row] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.slug, slug))
    .limit(1);
  if (!row) return [];

  const children = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.parentId, row.id));

  return [row.id, ...children.map((c) => c.id)];
}

function buildOrderBy(sort: ProductSort | undefined, query: string | undefined): SQL[] {
  // An explicit sort always wins; otherwise an active search ranks by
  // relevance rather than the default "featured" order.
  if (!sort && query) {
    return [desc(relevanceExpr(query))];
  }
  switch (sort ?? "featured") {
    case "price-asc":
      return [asc(product.basePriceCents)];
    case "price-desc":
      return [desc(product.basePriceCents)];
    case "newest":
      return [desc(product.createdAt)];
    case "featured":
      return [desc(product.isFeatured), desc(product.createdAt)];
  }
}

/**
 * Lists active products with pagination, filters, and sort. Image and
 * in-stock fields come from correlated subqueries so the whole listing is
 * one query (plus one for the total count) regardless of page size — no
 * per-row N+1 queries.
 */
export async function listProducts(
  db: DbClient,
  params: ProductListParams = {},
): Promise<ProductListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const conditions: SQL[] = [eq(product.status, "active")];

  if (params.categorySlug) {
    const categoryIds = await resolveCategoryAndDescendantIds(db, params.categorySlug);
    if (categoryIds.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }
    conditions.push(inArray(product.categoryId, categoryIds));
  }

  if (params.minPriceCents !== undefined) {
    conditions.push(gte(product.basePriceCents, params.minPriceCents));
  }
  if (params.maxPriceCents !== undefined) {
    conditions.push(lte(product.basePriceCents, params.maxPriceCents));
  }
  if (params.material) {
    conditions.push(ilike(product.material, params.material));
  }
  if (params.inStockOnly) {
    conditions.push(sql`exists (${inStockSubquery(db)})`);
  }
  const query = params.query?.trim();
  if (query) {
    conditions.push(searchCondition(query));
  }

  const where = and(...conditions);

  const countRows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(product)
    .where(where);
  const total = countRows[0]?.total ?? 0;

  if (total === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const rows = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      basePriceCents: product.basePriceCents,
      material: product.material,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId,
      imageUrl: sql<string | null>`(${firstImageSubquery(db, productImage.url)})`,
      imageAlt: sql<string | null>`(${firstImageSubquery(db, productImage.altText)})`,
      inStock: sql<boolean>`exists (${inStockSubquery(db)})`,
    })
    .from(product)
    .where(where)
    .orderBy(...buildOrderBy(params.sort, query))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export type ProductVariantDetail = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
  attributes: Record<string, string> | null;
};

export type ProductImageDetail = {
  id: string;
  url: string;
  altText: string;
  position: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  material: string | null;
  basePriceCents: number;
  currency: string;
  isFeatured: boolean;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  images: ProductImageDetail[];
  variants: ProductVariantDetail[];
};

/** Full detail for a single active product — gallery, variants, and category, for the product page. */
export async function getProductBySlug(db: DbClient, slug: string): Promise<ProductDetail | null> {
  const [row] = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      longDescription: product.longDescription,
      material: product.material,
      basePriceCents: product.basePriceCents,
      currency: product.currency,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId,
      categoryName: category.name,
      categorySlug: category.slug,
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .where(and(eq(product.slug, slug), eq(product.status, "active")))
    .limit(1);
  if (!row) return null;

  const [images, variants] = await Promise.all([
    db
      .select({
        id: productImage.id,
        url: productImage.url,
        altText: productImage.altText,
        position: productImage.position,
      })
      .from(productImage)
      .where(eq(productImage.productId, row.id))
      .orderBy(asc(productImage.position)),
    db
      .select({
        id: productVariant.id,
        name: productVariant.name,
        sku: productVariant.sku,
        priceOverrideCents: productVariant.priceOverrideCents,
        stock: productVariant.stock,
        attributes: productVariant.attributes,
      })
      .from(productVariant)
      .where(eq(productVariant.productId, row.id))
      .orderBy(asc(productVariant.name)),
  ]);

  return {
    ...row,
    images,
    variants: sortVariantsForDisplay(
      variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        priceCents: v.priceOverrideCents ?? row.basePriceCents,
        stock: v.stock,
        attributes: v.attributes,
      })),
    ),
  };
}

const SIZE_DISPLAY_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * Variant name (`Size: S`) sorts alphabetically wrong for sizes — this
 * reorders by garment-size convention (S, M, L, XL) when the variant has a
 * recognized `size` attribute, leaving anything else in its fetched order.
 */
function sortVariantsForDisplay(variants: ProductVariantDetail[]): ProductVariantDetail[] {
  return [...variants].sort((a, b) => {
    const rankA = SIZE_DISPLAY_ORDER.indexOf(a.attributes?.size ?? "");
    const rankB = SIZE_DISPLAY_ORDER.indexOf(b.attributes?.size ?? "");
    if (rankA === -1 || rankB === -1) return 0;
    return rankA - rankB;
  });
}

/** Other active products in the same category, for a product page's "related" section. */
export async function listRelatedProducts(
  db: DbClient,
  { categoryId, excludeProductId, limit = 4 }: { categoryId: string; excludeProductId: string; limit?: number },
): Promise<ProductListItem[]> {
  const rows = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      basePriceCents: product.basePriceCents,
      material: product.material,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId,
      imageUrl: sql<string | null>`(${firstImageSubquery(db, productImage.url)})`,
      imageAlt: sql<string | null>`(${firstImageSubquery(db, productImage.altText)})`,
      inStock: sql<boolean>`exists (${inStockSubquery(db)})`,
    })
    .from(product)
    .where(
      and(
        eq(product.status, "active"),
        eq(product.categoryId, categoryId),
        sql`${product.id} != ${excludeProductId}`,
      ),
    )
    .orderBy(desc(product.isFeatured), desc(product.createdAt))
    .limit(limit);

  return rows;
}

/** Distinct materials among active products, for populating a filter control. */
export async function listMaterials(db: DbClient, categorySlug?: string): Promise<string[]> {
  const conditions: SQL[] = [eq(product.status, "active"), isNotNull(product.material)];

  if (categorySlug) {
    const categoryIds = await resolveCategoryAndDescendantIds(db, categorySlug);
    if (categoryIds.length === 0) return [];
    conditions.push(inArray(product.categoryId, categoryIds));
  }

  const rows = await db
    .selectDistinct({ material: product.material })
    .from(product)
    .where(and(...conditions))
    .orderBy(asc(product.material));

  return rows.map((r) => r.material).filter((m): m is string => m !== null);
}

/** A user's wishlisted products, in the same shape as a catalog listing, for the /wishlist page. */
export async function listWishlistProducts(db: DbClient, userId: string): Promise<ProductListItem[]> {
  const rows = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      basePriceCents: product.basePriceCents,
      material: product.material,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId,
      imageUrl: sql<string | null>`(${firstImageSubquery(db, productImage.url)})`,
      imageAlt: sql<string | null>`(${firstImageSubquery(db, productImage.altText)})`,
      inStock: sql<boolean>`exists (${inStockSubquery(db)})`,
    })
    .from(wishlistItem)
    .innerJoin(wishlist, eq(wishlist.id, wishlistItem.wishlistId))
    .innerJoin(product, eq(product.id, wishlistItem.productId))
    .where(and(eq(wishlist.userId, userId), eq(product.status, "active")))
    .orderBy(desc(wishlistItem.createdAt));

  return rows;
}
