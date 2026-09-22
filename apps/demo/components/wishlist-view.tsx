"use client";
import Link from "next/link";
import { products } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useArmory, Mark, PageHead, ProductFrame } from "./armory-primitives";
export function WishlistView() {
  const { a, tr, formatMoney } = useArmory();
  const { state, addToCart, toggleWishlist } = useDemo();
  const wished = products.filter(product=>state.wishlist.includes(product.slug));
  return <div className="arm-wrap py-14"><PageHead title={a("watchTitle")} sub={a("watchSub")}/>{wished.length ? <div className="grid gap-[18px] min-[900px]:grid-cols-2 min-[1200px]:grid-cols-3">{wished.map(product=><article key={product.slug} className="arm-card"><Link href={`/product/${product.slug}`}><ProductFrame src={product.image} alt={tr(product.name)} className="h-[250px]"/></Link><div className="p-5"><div className="arm-ui flex flex-wrap items-end justify-between gap-2"><Link href={`/product/${product.slug}`} className="text-[23px]">{tr(product.name)}</Link><span className="text-[20px]">{formatMoney(product.priceCents)}</span></div><div className="mt-5 flex flex-wrap items-center gap-4"><button className="arm-button !min-h-11 !px-4 !text-[14px]" onClick={()=>addToCart(product.variants[0]?.id??"")}><Mark name="coins" size={16}/>{a("addToSatchel")}</button><button className="arm-ui min-h-11 text-[15px] text-[#9a8b6a] hover:text-[#c98f92]" onClick={()=>toggleWishlist(product.slug)}>{a("stopWatching")}</button></div></div></article>)}</div> : <div className="arm-plate py-20 text-center"><Mark name="feather" size={38} className="mx-auto opacity-50"/><p className="arm-ui mt-5 text-[21px]">{a("emptyWatch")}</p><Link href="/catalog" className="arm-button mt-7">{a("seeTheWares")}</Link></div>}</div>;
}
