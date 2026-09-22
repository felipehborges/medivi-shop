"use client";
import Link from "next/link";
import { useState } from "react";
import { type Product } from "@/lib/catalog";
import { goodFor, localizedGood, localizedDept, rarity } from "@/lib/armory";
import { useDemo } from "./demo-provider";
import { useArmory, Mark } from "./armory-primitives";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductCard } from "./product-card";
export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const { a, locale, formatMoney, tr } = useArmory();
  const { addToCart, hydrated, state, toggleWishlist } = useDemo();
  const [variantId,setVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity,setQuantity] = useState(1);
  const variant = product.variants.find(item=>item.id===variantId);
  const info = localizedGood(locale,product.slug), good = goodFor(product.slug);
  const wished = state.wishlist.includes(product.slug);
  const rows = [{label:a("recMaterial"),value:tr(product.material),mark:"anvil"},{label:a("recOrigin"),value:info?.origin,mark:"rune"},{label:a("recEra"),value:info?.era,mark:"scroll"},{label:a("recWeight"),value:info?.weight,mark:"shield"},{label:a("recStock"),value:String(variant?.stock ?? 0),mark:"coins"}].filter(row=>row.value);
  return <><div className="arm-wrap py-9"><Link href="/catalog" className="arm-link">← {a("backToFloor")}</Link><div className="mt-7 grid items-start gap-11 lg:grid-cols-[1.06fr_.94fr]"><div><div className="arm-plate p-5 sm:p-8"><ProductImageGallery src={product.image} alt={tr(product.name)}/></div><div className="arm-ui mt-6">{rows.map(row=><div key={row.label} className="grid grid-cols-[20px_108px_1fr] items-center gap-3 border-b border-[#e9dfc41a] py-3"><Mark name={row.mark} size={15} className="opacity-60"/><span className="text-[13px] uppercase tracking-[.12em] text-[#8e7f5f]">{row.label}</span><span className="text-[17px] text-[#e9dfc4]">{row.value}</span></div>)}</div></div>
    <div><p className="arm-eyebrow">{good && rarity(locale,good.rar)}{good && ` · ${localizedDept(locale,good.dept)?.name}`}</p><h1 className="arm-title mt-3">{tr(product.name)}</h1><p className="mt-5 max-w-[42ch] text-[16px] leading-[1.8] text-[#cbb98f]">{info?.description ?? tr(product.description)}</p><div className="my-7 flex items-center gap-3"><div className="arm-rule flex-1"/><Mark name="knot" tone="bronze" size={20}/></div>
    {info?.maker && <div className="flex gap-4"><Mark name="anvil" size={30}/><div><span className="arm-eyebrow text-[12px]">{a("forgedBy")}</span><p className="arm-ui text-[21px]">{info.maker}</p><p className="text-[14px] italic text-[#9a8b6a]">{info.makerNote}</p></div></div>}
    {info?.note && <div className="arm-parchment mt-7 rotate-[-.5deg] p-5"><p className="arm-ui text-[13px] uppercase tracking-widest text-[#6a5638]">{a("merchantsNote")}</p><p className="mt-2 text-[16px] italic leading-7 text-[#2a1f14]">{info.note}</p></div>}
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><span className="arm-eyebrow text-[12px]">{a("merchantsPrice")}</span><p className="arm-ui text-[44px] leading-none">{formatMoney(variant?.priceCents ?? product.priceCents)}</p></div><div className="arm-ui flex border border-[#0a0908] bg-[linear-gradient(#2a241d,#1b1610)] text-[19px]"><button className="min-h-11 min-w-11" onClick={()=>setQuantity(Math.max(1,quantity-1))} aria-label={tr("Decrease quantity")}>−</button><span className="grid min-w-10 place-items-center">{quantity}</span><button className="min-h-11 min-w-11" onClick={()=>setQuantity(Math.min(variant?.stock ?? 1,quantity+1))} aria-label={tr("Increase quantity")}>+</button></div></div>
    {product.variants.length>1 && <div className="arm-ui mt-5 flex flex-wrap gap-2">{product.variants.map(item=><button key={item.id} onClick={()=>{setVariantId(item.id);setQuantity(1)}} className="arm-choice !w-auto min-h-11 px-3 py-2 text-[15px]" data-selected={variantId===item.id}>{tr(item.name)}</button>)}</div>}
    <div className="mt-6 grid gap-3 sm:grid-cols-2"><button className="arm-button" disabled={!hydrated || !variant?.stock} onClick={()=>addToCart(variantId,quantity)}><Mark name="coins" size={19}/>{a("addToSatchel")}</button><button className="arm-button" disabled={!hydrated} onClick={()=>toggleWishlist(product.slug)}><Mark name="feather" size={18}/>{a(wished?"watching":"watch")}</button></div><p className="mt-3 text-[14px] italic text-[#9a8b6a]">{variant?.stock ?? 0} {a("stockLine")}</p><div className="arm-rule mt-6"/><p className="mt-4 text-[14px] text-[#b7a67d]">{a("demoLine")}</p></div></div></div>
    <section className="border-t border-[#0b0a08] bg-[linear-gradient(#1e170f,#171108)] py-16"><div className="arm-wrap"><h2 className="arm-title mb-8 text-[36px]">{a("sameShelf")}</h2><div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">{related.slice(0,3).map(item=><ProductCard key={item.slug} product={item} compact/>)}</div></div></section>
  </>;
}
