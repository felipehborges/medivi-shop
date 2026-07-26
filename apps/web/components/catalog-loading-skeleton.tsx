import { Skeleton } from "@medivi/ui/components/ui/skeleton";

export function CatalogLoadingSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
      <aside className="hidden w-48 shrink-0 md:block">
        <Skeleton className="h-64 w-full" />
      </aside>
      <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
