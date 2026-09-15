"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gem, Shield, Sparkles } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { Badge } from "@medivi/ui/components/ui/badge";
import { categories, products } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { DemoNotice } from "@/components/site-header";
import { useI18n } from "@/components/locale-provider";

export default function Home() {
  const { t } = useI18n();
  const featured = products.filter((product) => product.featured).slice(0, 4);
  return <>
    <section className="relative min-h-[620px] overflow-hidden bg-slate-950 text-white"><Image src="/products/dragonbone-greatsword.png" alt="Dragonbone Greatsword" fill priority className="object-cover object-center opacity-65" /><div className="hero-vignette absolute inset-0" /><div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-6 py-20"><div className="max-w-2xl"><Badge className="mb-6 bg-secondary text-secondary-foreground">{t("heroBadge")}</Badge><h1 className="font-display text-5xl font-bold leading-tight sm:text-7xl">{t("heroTitle")}</h1><p className="mt-6 max-w-xl text-lg text-slate-200">{t("heroText")}</p><div className="mt-9 flex flex-wrap gap-3"><Button size="lg" asChild><Link href="/catalog">{t("enterArmory")} <ArrowRight /></Link></Button><Button size="lg" variant="secondary" asChild><Link href="/admin">{t("exploreAdmin")}</Link></Button></div></div></div></section>
    <section className="border-y bg-card"><div className="mx-auto grid max-w-7xl gap-6 px-6 py-7 sm:grid-cols-3"><div className="flex items-center gap-3"><Shield className="text-primary"/><div><strong>{t("browserOnly")}</strong><p className="text-sm text-muted-foreground">{t("noBackend")}</p></div></div><div className="flex items-center gap-3"><Sparkles className="text-primary"/><div><strong>{t("interactive")}</strong><p className="text-sm text-muted-foreground">{t("interactiveText")}</p></div></div><div className="flex items-center gap-3"><Gem className="text-primary"/><div><strong>{t("portfolio")}</strong><p className="text-sm text-muted-foreground">{t("portfolioText")}</p></div></div></div></section>
    <section className="mx-auto max-w-7xl px-6 py-20"><div className="mb-9 flex items-end justify-between"><div><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">{t("choosePath")}</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t("shopCollection")}</h2></div><Link className="hidden text-sm font-semibold sm:block" href="/catalog">{t("viewAll")}</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <Link href={`/catalog?category=${category.slug}`} key={category.slug} className="group relative aspect-[16/9] overflow-hidden rounded-2xl"><Image src={category.image} alt={category.name} fill className="object-cover transition duration-500 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-5 text-white"><h3 className="text-2xl font-bold">{category.name}</h3><p className="text-sm text-white/75">{category.description}</p></div></Link>)}</div></section>
    <section className="demo-grid bg-muted/50"><div className="mx-auto max-w-7xl px-6 py-20"><div className="mb-9"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">{t("masterwork")}</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t("featured")}</h2></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{featured.map((product) => <ProductCard product={product} key={product.slug}/>)}</div></div></section>
    <section className="mx-auto max-w-4xl px-6 py-16"><DemoNotice /></section>
  </>;
}
