"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@medivi/ui/components/ui/input";
import { Button } from "@medivi/ui/components/ui/button";
import { categories } from "@/lib/catalog";
import { visibleProducts } from "@/lib/store";
import { ProductCard } from "./product-card";
import { useDemo } from "./demo-provider";

export function CatalogClient() {
  const params = useSearchParams();
  const { state } = useDemo();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [sort, setSort] = useState("featured");
  const filtered = useMemo(() => visibleProducts(state).filter((product) => (category === "all" || product.category === category) && `${product.name} ${product.material}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "low" ? a.priceCents - b.priceCents : sort === "high" ? b.priceCents - a.priceCents : Number(!!b.featured) - Number(!!a.featured)), [state, category, query, sort]);
  return <div className="mx-auto max-w-7xl px-6 py-12"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">The complete collection</p><h1 className="mt-2 text-4xl font-bold">Adventure awaits</h1><p className="mt-3 text-muted-foreground">Search and filter the catalog. All inventory is demonstration data.</p></div><div className="mt-9 grid gap-8 lg:grid-cols-[240px_1fr]"><aside className="space-y-6"><div><label className="mb-2 flex items-center gap-2 text-sm font-semibold" htmlFor="search"><Search className="size-4"/> Search</label><Input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sword, mithril..."/></div><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4"/> Collection</div><div className="grid gap-1"><Button className="justify-start" variant={category === "all" ? "secondary" : "ghost"} onClick={() => setCategory("all")}>All items</Button>{categories.map((item) => <Button key={item.slug} className="justify-start" variant={category === item.slug ? "secondary" : "ghost"} onClick={() => setCategory(item.slug)}>{item.name}</Button>)}</div></div></aside><div><div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{filtered.length} artifacts</p><select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="featured">Featured first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>{filtered.length ? <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{filtered.map((product) => <ProductCard product={product} key={product.slug}/>)}</div> : <div className="rounded-2xl border border-dashed p-14 text-center"><h2 className="text-xl font-bold">No artifacts found</h2><p className="mt-2 text-muted-foreground">Try another search or collection.</p></div>}</div></div></div>;
}
