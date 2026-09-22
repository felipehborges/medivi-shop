"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { findVariant } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useArmory, Mark, PageHead, Parchment } from "./armory-primitives";
import type { ArmoryKey } from "@/lib/armory";
const fields: { key: ArmoryKey; placeholder: ArmoryKey; required?: boolean }[] = [{key:"fBearer",placeholder:"fBearerP",required:true},{key:"fRoad",placeholder:"fRoadP",required:true},{key:"fTown",placeholder:"fTownP",required:true},{key:"fKingdom",placeholder:"fKingdomP",required:true},{key:"fMark",placeholder:"fMarkP"}];
const carriage = [{id:"rider",name:"carriageRider",eta:"carriageRiderEta",mark:"shield",cost:900},{id:"caravan",name:"carriageCaravan",eta:"carriageCaravanEta",mark:"knot",cost:0},{id:"raven",name:"carriageRaven",eta:"carriageRavenEta",mark:"feather",cost:2400}] as const;
export function CheckoutView() {
  const { a, tr, formatMoney } = useArmory();
  const { state, totalCents } = useDemo();
  const router = useRouter();
  const [selected,setSelected] = useState("caravan");
  const lines = state.cart.flatMap(item=>{const match=findVariant(item.variantId);return match?[{item,match}]:[]});
  const cost = carriage.find(item=>item.id===selected)?.cost ?? 0;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); sessionStorage.setItem("medivi-demo-checkout",JSON.stringify({ email:"bearer@medivi.invalid", carriage:selected, carriageCents:cost })); router.push("/payment"); }
  return <div className="arm-wrap max-w-[1188px] py-14"><Link href="/cart" className="arm-link">← {a("backToManifest")}</Link><div className="mt-6"><PageHead title={a("checkoutTitle")} sub={a("checkoutSub")}/></div>
    {!lines.length ? <div className="arm-plate p-12 text-center"><p>{a("emptyCart")}</p><Link href="/catalog" className="arm-button mt-5">{a("seeTheWares")}</Link></div> : <form onSubmit={submit} className="grid items-start gap-9 min-[1200px]:grid-cols-[1.25fr_.75fr]"><div className="arm-plate p-6 sm:p-8"><h2 className="arm-eyebrow flex items-center gap-3"><Mark name="feather" tone="bronze" size={20}/>{a("handOfBearer")}</h2><div className="mt-6 grid gap-[18px] min-[900px]:grid-cols-2">{fields.map((field,i)=><label key={field.key} className={`arm-ui block text-[12px] uppercase tracking-[.14em] text-[#8e7f5f] ${i<2 ? "sm:col-span-2" : ""}`}>{a(field.key)}<input className="arm-input mt-2" placeholder={a(field.placeholder)} required={field.required} autoComplete="off"/></label>)}</div><h2 className="arm-eyebrow mt-9 flex items-center gap-3"><Mark name="shield" tone="bronze" size={20}/>{a("mannerOfCarriage")}</h2><div className="mt-5 grid gap-3">{carriage.map(option=><button key={option.id} type="button" className="arm-choice" data-selected={selected===option.id} onClick={()=>setSelected(option.id)}><Mark name={option.mark} size={22}/><span className="flex-1"><strong className="arm-ui block text-[18px] text-[#e9dfc4]">{a(option.name)}</strong><span className="text-[13px] text-[#9a8b6a]">{a(option.eta)}</span></span><span className="arm-ui text-[17px] text-[#cbb98f]">{option.cost ? formatMoney(option.cost) : a("byTheHouse")}</span></button>)}</div><button type="submit" className="arm-button mt-8 w-full">{a("toTheSeal")} →</button></div>
      <Parchment className="p-6 min-[1200px]:sticky min-[1200px]:top-28"><h2 className="arm-display flex items-center gap-2 border-b border-[#3a2c1866] pb-4 text-[25px]"><Mark name="scroll" tone="ink" size={20}/>{a("manifestHead")}</h2><div className="arm-ui mt-5 space-y-3">{lines.map(({item,match})=><div key={item.variantId} className="flex justify-between gap-3 text-[16px]"><span>{tr(match.product.name)} ×{item.quantity}</span><span>{formatMoney((match.variant.priceCents??match.product.priceCents)*item.quantity)}</span></div>)}<div className="flex justify-between border-t border-[#3a2c1866] pt-4"><span>{a("sumOfWares")}</span><span>{formatMoney(totalCents)}</span></div><div className="flex justify-between"><span>{a("carriage")}</span><span>{cost ? formatMoney(cost) : a("byTheHouse")}</span></div><div className="flex items-end justify-between border-t border-[#3a2c1866] pt-4"><span className="text-[12px] uppercase">{a("dueAtCounter")}</span><strong className="text-[26px]">{formatMoney(totalCents+cost)}</strong></div></div></Parchment></form>}
  </div>;
}
