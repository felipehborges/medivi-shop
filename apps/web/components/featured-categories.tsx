import Image from "next/image";
import Link from "next/link";

import type { CategoryNavNode } from "@medivi/db/queries";

export function FeaturedCategories({ categories }: { categories: CategoryNavNode[] }) {
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="featured-categories-heading">
      <h2 id="featured-categories-heading" className="font-display mb-4 text-2xl">
        Shop by category
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/catalog/${category.slug}`}
            className="group flex flex-col items-center gap-2 text-center"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-full bg-muted ring-1 ring-foreground/10">
              {category.imageUrl && (
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 15vw, 30vw"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              )}
            </div>
            <span className="text-sm font-medium">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
