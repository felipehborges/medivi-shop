"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Heart, ShieldCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Button } from "@medivi/ui/components/ui/button";
import { money, type Product } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { ProductCard } from "./product-card";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const { addToCart, hydrated, state, toggleWishlist } = useDemo();
  const variant = product.variants.find((item) => item.id === variantId);
  const wished = state.wishlist.includes(product.slug);
  return <><div className="mx-auto max-w-7xl px-6 py-10"><Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground">← Back to the armory</Link><div className="mt-6 grid gap-10 lg:grid-cols-2"><div className="relative aspect-square overflow-hidden rounded-3xl border bg-muted"><Image src={product.image} alt={product.name} fill priority className="object-cover"/></div><div className="flex flex-col justify-center"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">{product.material}</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">{product.name}</h1><p className="mt-5 text-lg leading-relaxed text-muted-foreground">{product.description}</p><p className="mt-7 text-3xl font-bold">{money(variant?.priceCents ?? product.priceCents)}</p><div className="mt-7"><label className="text-sm font-semibold">Choose a variant</label><div className="mt-3 flex flex-wrap gap-2">{product.variants.map((item) => <Button key={item.id} variant={item.id === variantId ? "default" : "outline"} onClick={() => setVariantId(item.id)}>{item.name}</Button>)}</div></div><div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4 text-green-600"/> {variant?.stock ?? 0} available in demo inventory</div><div className="mt-7 flex gap-3"><Button size="lg" className="flex-1" onClick={() => addToCart(variantId)} disabled={!variant || !hydrated}><ShoppingBag/> Add to cart</Button><Button size="lg" variant="outline" disabled={!hydrated} onClick={() => toggleWishlist(product.slug)} aria-label="Toggle wishlist"><Heart className={wished ? "fill-accent text-accent" : ""}/></Button></div><div className="mt-6 flex items-start gap-3 rounded-xl bg-muted p-4 text-sm"><ShieldCheck className="size-5 shrink-0"/><p><strong>Demo interaction.</strong> This selection is stored only in your browser and cannot create a real purchase.</p></div></div></div></div><section className="bg-muted/50"><div className="mx-auto max-w-7xl px-6 py-16"><h2 className="mb-7 text-3xl font-bold">You may also seek</h2><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{related.map((item) => <ProductCard key={item.slug} product={item}/>)}</div></div></section></>;
}
