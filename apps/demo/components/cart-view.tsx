"use client";

import { useI18n } from "./locale-provider";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { findVariant } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { DemoNotice } from "./site-header";

export function CartView() {
  const { tr, formatMoney } = useI18n();
  const { state, updateQuantity, totalCents } = useDemo();
  const lines = state.cart.map((item) => ({ item, match: findVariant(item.variantId) })).filter((line) => line.match);
  if (!lines.length) return <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center"><div className="rounded-full bg-muted p-6"><ShoppingBag className="size-10"/></div><h1 className="mt-6 text-3xl font-bold">{tr("Your satchel is empty")}</h1><p className="mt-2 text-muted-foreground">{tr("The armory is stocked with everything your next quest needs.")}</p><Button className="mt-7" asChild><Link href="/catalog">{tr("Explore the catalog")}</Link></Button></div>;
  return <div className="mx-auto max-w-6xl px-6 py-12"><h1 className="text-4xl font-bold">{tr("Your cart")}</h1><p className="mt-2 text-muted-foreground">{tr("A browser-local preview of the purchase experience.")}</p><div className="mt-9 grid gap-8 lg:grid-cols-[1fr_360px]"><div className="space-y-4">{lines.map(({ item, match }) => match && <article key={item.variantId} className="flex gap-4 rounded-2xl border bg-card p-4"><div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-muted"><Image src={match.product.image} alt={tr(match.product.name)} fill className="object-cover"/></div><div className="flex min-w-0 flex-1 flex-col"><Link href={`/product/${match.product.slug}`} className="font-display text-lg font-bold">{tr(match.product.name)}</Link><p className="text-sm text-muted-foreground">{tr(match.variant.name)} · {tr(match.product.material)}</p><p className="mt-auto font-bold">{formatMoney((match.variant.priceCents ?? match.product.priceCents) * item.quantity)}</p></div><div className="flex flex-col items-end justify-between"><Button variant="ghost" size="icon" aria-label={tr("Remove item")} onClick={() => updateQuantity(item.variantId, 0)}><Trash2 className="size-4"/></Button><div className="flex items-center rounded-lg border"><Button variant="ghost" size="icon" aria-label={tr("Decrease quantity")} onClick={() => updateQuantity(item.variantId, item.quantity - 1)}><Minus className="size-4"/></Button><span className="w-8 text-center text-sm font-bold">{item.quantity}</span><Button variant="ghost" size="icon" aria-label={tr("Increase quantity")} disabled={item.quantity >= match.variant.stock} onClick={() => updateQuantity(item.variantId, item.quantity + 1)}><Plus className="size-4"/></Button></div></div></article>)}</div><aside className="h-fit space-y-5 rounded-2xl border bg-card p-6"><h2 className="text-xl font-bold">{tr("Order preview")}</h2><div className="flex justify-between text-sm"><span className="text-muted-foreground">{tr("Subtotal")}</span><strong>{formatMoney(totalCents)}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">{tr("Demo shipping")}</span><strong>{tr("Free")}</strong></div><div className="flex justify-between border-t pt-4 text-lg"><span>{tr("Total")}</span><strong>{formatMoney(totalCents)}</strong></div><Button size="lg" className="w-full" asChild><Link href="/checkout">{tr("Continue to checkout")}</Link></Button><DemoNotice compact /></aside></div></div>;
}
