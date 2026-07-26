import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import {
  getWishlistedProductIds,
  listCategoryTree,
  listMaterials,
  listProducts,
  type ProductSort,
} from "@medivi/db/queries";
import { getSession } from "@/lib/auth-guards";
import { CategorySidebar } from "./category-sidebar";
import { CatalogFilters } from "./catalog-filters";
import { CatalogSort } from "./catalog-sort";
import { ProductCard } from "./product-card";
import { CatalogPagination } from "./catalog-pagination";
import { EmptyState } from "./empty-state";

export type CatalogSearchParams = {
  page?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  material?: string;
  inStock?: string;
  q?: string;
};

function parsePage(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseSort(raw: string | undefined): ProductSort | undefined {
  return raw === "price-asc" || raw === "price-desc" || raw === "newest" || raw === "featured"
    ? raw
    : undefined;
}

function parseDollarsToCents(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const dollars = Number(raw);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

export async function CatalogView({
  categorySlug,
  searchParams,
  basePath,
}: {
  categorySlug?: string;
  searchParams: CatalogSearchParams;
  basePath: string;
}) {
  const [categories, materials, session] = await Promise.all([
    listCategoryTree(db),
    listMaterials(db, categorySlug),
    getSession(),
  ]);
  const wishlistedIds = session ? await getWishlistedProductIds(db, session.user.id) : null;

  if (categorySlug) {
    const knownSlugs = categories.flatMap((c) => [c.slug, ...c.children.map((ch) => ch.slug)]);
    if (!knownSlugs.includes(categorySlug)) notFound();
  }

  const query = searchParams.q?.trim() || undefined;
  const page = parsePage(searchParams.page);
  const result = await listProducts(db, {
    categorySlug,
    page,
    sort: parseSort(searchParams.sort),
    minPriceCents: parseDollarsToCents(searchParams.minPrice),
    maxPriceCents: parseDollarsToCents(searchParams.maxPrice),
    material: searchParams.material || undefined,
    inStockOnly: searchParams.inStock === "true",
    query,
  });

  const carryParams = {
    sort: searchParams.sort,
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
    material: searchParams.material,
    inStock: searchParams.inStock,
    q: searchParams.q,
  };

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
      <aside className="hidden w-56 shrink-0 flex-col gap-8 md:flex">
        <CategorySidebar categories={categories} activeSlug={categorySlug} />
        <CatalogFilters basePath={basePath} searchParams={searchParams} materials={materials} />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {query ? (
              <>
                {result.total} {result.total === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
              </>
            ) : (
              <>
                {result.total} {result.total === 1 ? "product" : "products"}
              </>
            )}
          </p>
          <CatalogSort basePath={basePath} searchParams={searchParams} />
        </div>
        {result.items.length === 0 ? (
          <EmptyState
            title={query ? `No results for "${query}"` : "No products found"}
            description={
              query
                ? "Try a different search term or clear your filters."
                : "Try different filters or check back later — new stock arrives often."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showWishlistButton={!!wishlistedIds}
                  isWishlisted={wishlistedIds?.has(product.id)}
                />
              ))}
            </div>
            <div className="mt-8">
              <CatalogPagination
                basePath={basePath}
                page={result.page}
                totalPages={result.totalPages}
                searchParams={carryParams}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
