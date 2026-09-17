import { LocalizedText } from "@/components/localized-text";
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
    <article className="store-product-card group relative flex flex-col overflow-hidden rounded-lg bg-card transition-[transform,background-color] duration-200 motion-safe:hover:-translate-y-0.5">
      {showWishlistButton && (
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={product.id} initialWishlisted={!!isWishlisted} />
        </div>
      )}
      <Link href={`/product/${product.slug}`} className="contents">
        <div className="relative aspect-[4/4.35] w-full overflow-hidden bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="store-product-image object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.035]"
            />
          ) : null}
          {!product.inStock && (
            <Badge variant="destructive" className="absolute top-2 left-2">
              <LocalizedText text={"Out of stock "} /></Badge>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 border-t border-border/60 p-4">
          {product.isFeatured && (
            <Badge variant="secondary" className="w-fit">
              <LocalizedText text={"Featured "} /></Badge>
          )}
          <span className="font-display text-base leading-snug font-semibold"><LocalizedText text={product.name} /></span>
          {product.material && (
            <span className="order-first text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase"><LocalizedText text={product.material} /></span>
          )}
          <span className="mt-auto pt-3 font-display text-xl font-semibold tracking-wide text-foreground">{formatPriceCents(product.basePriceCents)}</span>
        </div>
      </Link>
    </article>
  );
}
