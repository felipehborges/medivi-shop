"use client";

import { useI18n } from "./locale-provider";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@medivi/ui/components/ui/input";
import { Button } from "@medivi/ui/components/ui/button";
import { categories } from "@/lib/catalog";
import { visibleProducts } from "@/lib/store";
import { ProductCard } from "./product-card";
import { useDemo } from "./demo-provider";

export function CatalogClient() {
  const { tr } = useI18n();
  const params = useSearchParams();
  const { state } = useDemo();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [sort, setSort] = useState("featured");
  const filtered = visibleProducts(state).filter((product) => (category === "all" || product.category === category) && `${product.name} ${tr(product.name)} ${product.material} ${tr(product.material)}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "low" ? a.priceCents - b.priceCents : sort === "high" ? b.priceCents - a.priceCents : Number(!!b.featured) - Number(!!a.featured));
  return <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">{tr("The complete collection")}</p><h1 className="mt-2 text-4xl font-bold">{tr("Adventure awaits")}</h1><p className="mt-3 text-muted-foreground">{tr("Search and filter the catalog. All inventory is demonstration data.")}</p></div><div className="mt-9 grid gap-8 lg:grid-cols-[240px_1fr]"><aside className="grid gap-6 border-l-2 border-primary/45 bg-secondary/20 p-4 sm:grid-cols-2 lg:block lg:space-y-6"><div><label className="mb-2 flex items-center gap-2 text-sm font-semibold" htmlFor="search"><Search className="size-4"/> {tr("Search")}</label><Input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Sword, mithril...")}/></div><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4"/> {tr("Collection")}</div><div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1"><Button className="justify-start" variant={category === "all" ? "secondary" : "ghost"} onClick={() => setCategory("all")}>{tr("All items")}</Button>{categories.map((item) => <Button key={item.slug} className="justify-start" variant={category === item.slug ? "secondary" : "ghost"} onClick={() => setCategory(item.slug)}>{tr(item.name)}</Button>)}</div></div></aside><div><div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{filtered.length} {tr("artifacts")}</p><select aria-label={tr("Sort products")} value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-sm border border-input bg-background px-3 py-2 text-sm"><option value="featured">{tr("Featured first")}</option><option value="low">{tr("Price: low to high")}</option><option value="high">{tr("Price: high to low")}</option></select></div>{filtered.length ? <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{filtered.map((product) => <ProductCard product={product} key={product.slug}/>)}</div> : <div className="rounded-2xl border border-dashed p-14 text-center"><h2 className="text-xl font-bold">{tr("No artifacts found")}</h2><p className="mt-2 text-muted-foreground">{tr("Try another search or collection.")}</p></div>}</div></div></div>;
}
