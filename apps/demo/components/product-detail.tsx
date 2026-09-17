"use client";

import { useI18n } from "./locale-provider";

import Link from "next/link";
import { Check, Heart, ShieldCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Button } from "@medivi/ui/components/ui/button";
import { type Product } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { ProductCard } from "./product-card";
import { ProductImageMagnifier } from "./product-image-magnifier";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const { tr, formatMoney } = useI18n();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const { addToCart, hydrated, state, toggleWishlist } = useDemo();
  const variant = product.variants.find((item) => item.id === variantId);
  const wished = state.wishlist.includes(product.slug);
  return <><div className="mx-auto max-w-7xl px-6 py-10"><Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground">← {tr("Back to the armory")}</Link><div className="mt-6 grid gap-10 lg:grid-cols-2"><ProductImageMagnifier src={product.image} alt={tr(product.name)} /><div className="flex flex-col justify-center"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">{tr(product.material)}</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">{tr(product.name)}</h1><p className="mt-5 text-lg leading-relaxed text-muted-foreground">{tr(product.description)}</p><p className="mt-7 text-3xl font-bold">{formatMoney(variant?.priceCents ?? product.priceCents)}</p><div className="mt-7"><label className="text-sm font-semibold">{tr("Choose a variant")}</label><div className="mt-3 flex flex-wrap gap-2">{product.variants.map((item) => <Button key={item.id} variant={item.id === variantId ? "default" : "outline"} onClick={() => setVariantId(item.id)}>{tr(item.name)}</Button>)}</div></div><div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4 text-green-600"/> {variant?.stock ?? 0} {tr("available in demo inventory")}</div><div className="mt-7 flex gap-3"><Button size="lg" className="flex-1" onClick={() => addToCart(variantId)} disabled={!variant || !hydrated}><ShoppingBag/> {tr("Add to cart")}</Button><Button size="lg" variant="outline" disabled={!hydrated} onClick={() => toggleWishlist(product.slug)} aria-label={tr("Toggle wishlist")}><Heart className={wished ? "fill-accent text-accent" : ""}/></Button></div><div className="mt-6 flex items-start gap-3 rounded-xl bg-muted p-4 text-sm"><ShieldCheck className="size-5 shrink-0"/><p><strong>{tr("Demo interaction.")}</strong> {tr("This selection is stored only in your browser and cannot create a real purchase.")}</p></div></div></div></div><section className="bg-muted/50"><div className="mx-auto max-w-7xl px-6 py-16"><h2 className="mb-7 text-3xl font-bold">{tr("You may also seek")}</h2><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{related.map((item) => <ProductCard key={item.slug} product={item}/>)}</div></div></section></>;
}
