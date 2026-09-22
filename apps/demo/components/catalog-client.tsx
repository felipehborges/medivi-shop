"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEPTS, GOODS, goodFor, localizedDept, localizedGood } from "@/lib/armory";
import { visibleProducts } from "@/lib/store";
import { useDemo } from "./demo-provider";
import { useArmory, Mark, PageHead } from "./armory-primitives";
import { ProductCard } from "./product-card";
const oldCategory: Record<string,string> = { swords:"armory", shields:"bulwark", armor:"bulwark", cloaks:"wayfarer", relics:"relics", potions:"alchemist" };
export function CatalogClient() {
  const { a, locale, tr } = useArmory();
  const params = useSearchParams();
  const { state } = useDemo();
  const [query,setQuery] = useState(params.get("q") ?? "");
  const [dept,setDept] = useState(params.get("dept") ?? oldCategory[params.get("category") ?? ""] ?? "all");
  const filtered = visibleProducts(state).filter(product => (dept === "all" || goodFor(product.slug)?.dept === dept) && [product.name,tr(product.name),product.material,tr(product.material),localizedGood(locale,product.slug)?.origin].join(" ").toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>GOODS.findIndex(item=>item.slug===a.slug)-GOODS.findIndex(item=>item.slug===b.slug));
  return <div className="arm-wrap py-14"><div className="grid items-end gap-8 md:grid-cols-[1fr_.7fr]"><PageHead eyebrow={a("shopEyebrow")} title={dept==="all" ? a("allWares") : localizedDept(locale,dept)?.name ?? a("allWares")} sub={dept==="all" ? a("departmentsNote") : localizedDept(locale,dept)?.description}/><label className="arm-ui mb-9 block text-[13px] uppercase tracking-[.14em] text-[#b08a4a]">{a("askTheMerchant")}<input className="arm-input mt-2" value={query} onChange={event=>setQuery(event.target.value)} placeholder={a("searchPlaceholder")}/></label></div>
    <div className="arm-ui mb-7 flex flex-wrap gap-2">{[{slug:"all",mark:"knot",name:a("allWares")},...DEPTS.map(item=>({slug:item.slug,mark:item.mark,name:localizedDept(locale,item.slug)?.name ?? item.slug}))].map(item=><button key={item.slug} type="button" onClick={()=>setDept(item.slug)} className="arm-choice !w-auto min-h-11 !gap-2 px-4 py-2 text-[15px] text-[#cbb98f]" data-selected={dept===item.slug}><Mark name={item.mark} size={18}/>{item.name}</button>)}</div>
    <p className="arm-ui mb-5 text-[14px] text-[#9a8b6a]">{filtered.length} {a("wares")}</p>
    {filtered.length ? <div className="arm-floor">{filtered.map((product,i)=><ProductCard key={product.slug} product={product} tall={i<2}/>)}</div> : <div className="arm-plate py-20 text-center"><Mark name="rune" size={40} className="mx-auto opacity-50"/><h2 className="arm-ui mt-4 text-[26px]">{a("noneFound")}</h2><p className="arm-muted mt-2">{a("noneFoundSub")}</p></div>}
  </div>;
}
