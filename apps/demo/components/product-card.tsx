"use client";

import { useI18n } from "./locale-provider";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import { type Product } from "@/lib/catalog";
import { useDemo } from "./demo-provider";

export function ProductCard({ product }: { product: Product }) {
  const { tr, formatMoney } = useI18n();
  const { state, toggleWishlist } = useDemo();
  const wished = state.wishlist.includes(product.slug);
  return <article className="group relative overflow-hidden rounded-lg bg-card transition-transform duration-200 motion-safe:hover:-translate-y-0.5">
    <Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10" onClick={() => toggleWishlist(product.slug)} aria-label={tr(wished ? "Remove from wishlist" : "Add to wishlist")}><Heart className={wished ? "fill-accent text-accent" : ""} /></Button>
    <Link href={`/product/${product.slug}`}>
      <div className="relative aspect-[4/4.35] overflow-hidden bg-muted"><Image src={product.image} alt={tr(product.name)} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.035]" />{product.featured && <Badge className="absolute left-3 top-3">{tr("Featured")}</Badge>}</div>
      <div className="flex min-h-35 flex-col border-t border-border/60 p-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tr(product.material)}</p><h3 className="mt-1 font-display text-lg leading-snug font-semibold">{tr(product.name)}</h3><p className="mt-auto pt-3 font-display text-xl font-semibold tracking-wide">{formatMoney(product.priceCents)}</p></div>
    </Link>
  </article>;
}
