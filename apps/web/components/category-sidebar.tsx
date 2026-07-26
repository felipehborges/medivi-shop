import Link from "next/link";

import { cn } from "@medivi/ui/lib/utils";
import type { CategoryNavNode } from "@medivi/db/queries";

export function CategorySidebar({
  categories,
  activeSlug,
}: {
  categories: CategoryNavNode[];
  activeSlug?: string;
}) {
  return (
    <nav aria-label="Browse categories" className="flex flex-col gap-4">
      {categories.map((cat) => (
        <div key={cat.id}>
          <Link
            href={`/catalog/${cat.slug}`}
            className={cn(
              "font-medium",
              activeSlug === cat.slug && "text-primary underline",
            )}
          >
            {cat.name}
          </Link>
          {cat.children.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1 border-l pl-3">
              {cat.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/catalog/${child.slug}`}
                    className={cn(
                      "text-sm text-muted-foreground hover:text-foreground",
                      activeSlug === child.slug && "text-primary underline",
                    )}
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
