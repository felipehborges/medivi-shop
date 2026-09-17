import { LocalizedText } from "@/components/localized-text";
import Link from "next/link";

import { Button, buttonVariants } from "@medivi/ui/components/ui/button";
import { cn } from "@medivi/ui/lib/utils";

function hrefForPage(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  search.set("page", String(page));
  return `${basePath}?${search.toString()}`;
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
      {children}
    </Link>
  );
}

export function CatalogPagination({
  basePath,
  page,
  totalPages,
  searchParams,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <PaginationLink href={hrefForPage(basePath, searchParams, page - 1)} disabled={page <= 1}>
        <LocalizedText text={"Previous "} /></PaginationLink>
      <span className="text-sm text-muted-foreground">
        <LocalizedText text={"Page "} />{page} <LocalizedText text={"of"} />{totalPages}
      </span>
      <PaginationLink
        href={hrefForPage(basePath, searchParams, page + 1)}
        disabled={page >= totalPages}
      >
        <LocalizedText text={"Next "} /></PaginationLink>
    </nav>
  );
}
