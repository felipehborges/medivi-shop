import { Button } from "@medivi/ui/components/ui/button";
import type { ProductSort } from "@medivi/db/queries";
import type { CatalogSearchParams } from "./catalog-view";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export function CatalogSort({
  basePath,
  searchParams,
}: {
  basePath: string;
  searchParams: CatalogSearchParams;
}) {
  const isSearching = !!searchParams.q;

  return (
    <form method="GET" action={basePath} className="flex items-center justify-end gap-2">
      {searchParams.minPrice && <input type="hidden" name="minPrice" value={searchParams.minPrice} />}
      {searchParams.maxPrice && <input type="hidden" name="maxPrice" value={searchParams.maxPrice} />}
      {searchParams.material && <input type="hidden" name="material" value={searchParams.material} />}
      {searchParams.inStock && <input type="hidden" name="inStock" value={searchParams.inStock} />}
      {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}

      <label htmlFor="sort" className="text-sm text-muted-foreground">
        Sort by
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={searchParams.sort ?? (isSearching ? "" : "featured")}
        className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {isSearching && <option value="">Relevance</option>}
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Sort
      </Button>
    </form>
  );
}
