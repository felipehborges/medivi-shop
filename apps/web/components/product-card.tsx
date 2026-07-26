import Image from "next/image";
import Link from "next/link";

import { Badge } from "@medivi/ui/components/ui/badge";
import type { ProductListItem } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({
  product,
  isWishlisted,
  showWishlistButton = false,
}: {
  product: ProductListItem;
  isWishlisted?: boolean;
  showWishlistButton?: boolean;
}) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
      {showWishlistButton && (
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={product.id} initialWishlisted={!!isWishlisted} />
        </div>
      )}
      <Link href={`/product/${product.slug}`} className="contents">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : null}
          {!product.inStock && (
            <Badge variant="destructive" className="absolute top-2 left-2">
              Out of stock
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          {product.isFeatured && (
            <Badge variant="secondary" className="w-fit">
              Featured
            </Badge>
          )}
          <span className="font-medium">{product.name}</span>
          {product.material && (
            <span className="text-sm text-muted-foreground">{product.material}</span>
          )}
          <span className="font-display text-lg">{formatPriceCents(product.basePriceCents)}</span>
        </div>
      </Link>
    </article>
  );
}
