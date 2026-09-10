"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { products } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { useDemo } from "./demo-provider";

export function WishlistView() { const { state } = useDemo(); const wished = products.filter((product) => state.wishlist.includes(product.slug)); return <div className="mx-auto max-w-7xl px-6 py-12"><h1 className="text-4xl font-bold">Wishlist</h1><p className="mt-2 text-muted-foreground">Saved only on this device.</p>{wished.length ? <div className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">{wished.map((product) => <ProductCard product={product} key={product.slug}/>)}</div> : <div className="flex flex-col items-center py-24 text-center"><Heart className="size-12 text-muted-foreground"/><h2 className="mt-5 text-2xl font-bold">No favorites yet</h2><Button className="mt-6" asChild><Link href="/catalog">Find an artifact</Link></Button></div>}</div>; }
