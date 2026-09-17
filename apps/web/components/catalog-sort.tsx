import { LocalizedText } from "@/components/localized-text";
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
        <LocalizedText text={"Sort by "} /></label>
      <select
        id="sort"
        name="sort"
        defaultValue={searchParams.sort ?? (isSearching ? "" : "featured")}
        className="h-9 rounded-sm border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] [color-scheme:light] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:[color-scheme:dark]"
      >
        {isSearching && (
          <option className="bg-background text-foreground" value="">
            <LocalizedText text={"Relevance "} /></option>
        )}
        {SORT_OPTIONS.map((option) => (
          <option className="bg-background text-foreground" key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        <LocalizedText text={"Sort "} /></Button>
    </form>
  );
}
