import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import type { CatalogSearchParams } from "./catalog-view";

/**
 * A native GET form — filters apply via a real page navigation, no client
 * JS required, consistent with the project's progressive-enhancement
 * approach to catalog controls (see docs/architecture.md §7).
 */
export function CatalogFilters({
  basePath,
  searchParams,
  materials,
}: {
  basePath: string;
  searchParams: CatalogSearchParams;
  materials: string[];
}) {
  return (
    <form method="GET" action={basePath} className="flex flex-col gap-4 rounded-xl border p-4">
      {searchParams.sort && <input type="hidden" name="sort" value={searchParams.sort} />}
      {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Price range</legend>
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="minPrice" className="text-xs text-muted-foreground">
              Min
            </Label>
            <Input
              id="minPrice"
              name="minPrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="$0"
              defaultValue={searchParams.minPrice}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="maxPrice" className="text-xs text-muted-foreground">
              Max
            </Label>
            <Input
              id="maxPrice"
              name="maxPrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Any"
              defaultValue={searchParams.maxPrice}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor="material">Material</Label>
        <select
          id="material"
          name="material"
          defaultValue={searchParams.material ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground shadow-xs outline-none [color-scheme:light] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:[color-scheme:dark]"
        >
          <option className="bg-background text-foreground" value="">
            All materials
          </option>
          {materials.map((material) => (
            <option className="bg-background text-foreground" key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="inStock"
          value="true"
          defaultChecked={searchParams.inStock === "true"}
          className="size-4 rounded border border-input"
        />
        In stock only
      </label>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Clear</Link>
        </Button>
      </div>
    </form>
  );
}
