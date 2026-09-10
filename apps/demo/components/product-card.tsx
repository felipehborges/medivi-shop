"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import { money, type Product } from "@/lib/catalog";
import { useDemo } from "./demo-provider";

export function ProductCard({ product }: { product: Product }) {
  const { state, toggleWishlist } = useDemo();
  const wished = state.wishlist.includes(product.slug);
  return <article className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
    <Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10 rounded-full" onClick={() => toggleWishlist(product.slug)} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}><Heart className={wished ? "fill-accent text-accent" : ""} /></Button>
    <Link href={`/product/${product.slug}`}>
      <div className="relative aspect-square overflow-hidden bg-muted"><Image src={product.image} alt={product.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" />{product.featured && <Badge className="absolute left-3 top-3">Featured</Badge>}</div>
      <div className="space-y-1 p-4"><p className="text-xs uppercase tracking-widest text-muted-foreground">{product.material}</p><h3 className="font-display text-lg font-semibold">{product.name}</h3><p className="pt-2 text-lg font-bold">{money(product.priceCents)}</p></div>
    </Link>
  </article>;
}
