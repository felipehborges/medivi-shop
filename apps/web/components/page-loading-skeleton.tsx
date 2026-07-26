import { Skeleton } from "@medivi/ui/components/ui/skeleton";

export function PageLoadingSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
