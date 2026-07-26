import { Skeleton } from "@medivi/ui/components/ui/skeleton";

export function ProductLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}
