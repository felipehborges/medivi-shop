"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "./demo-provider";
import { useArmory, Mark, PageHead } from "./armory-primitives";
const methods = [{id:"coin",name:"payCoin",note:"payCoinNote",mark:"coins"},{id:"credit",name:"payCredit",note:"payCreditNote",mark:"scroll"},{id:"account",name:"payAccount",note:"payAccountNote",mark:"seal"}] as const;
export function PaymentView() {
  const { a, formatMoney } = useArmory();
  const { state, totalCents, finishOrder } = useDemo();
  const router = useRouter();
  const [selected,setSelected] = useState("coin");
  const [checkout] = useState<{email?:string;carriageCents?:number}>(()=>{if(typeof window==="undefined")return {};try{return JSON.parse(sessionStorage.getItem("medivi-demo-checkout")??"{}")}catch{return {}}});
  const due = totalCents + (checkout.carriageCents??0);
  function approve() { const order=finishOrder(checkout.email??"bearer@medivi.invalid",checkout.carriageCents??0); sessionStorage.removeItem("medivi-demo-checkout"); router.push(`/order/confirmation?id=${encodeURIComponent(order.id)}`); }
  return <div className="arm-wrap max-w-[1008px] py-14"><Link href="/checkout" className="arm-link">← {a("backToLedger")}</Link><div className="mt-6"><PageHead title={a("paymentTitle")} sub={a("paymentSub")}/></div>
    {!state.cart.length ? <div className="arm-plate p-12 text-center"><p>{a("emptyCart")}</p><Link href="/catalog" className="arm-button mt-5">{a("seeTheWares")}</Link></div> : <><div className="grid gap-3.5">{methods.map(method=><button key={method.id} type="button" className="arm-choice !p-5" data-selected={selected===method.id} onClick={()=>setSelected(method.id)}><Mark name={method.mark} size={28}/><span className="flex-1"><span className="arm-ui block text-[21px] text-[#efe6cc]">{a(method.name)}</span><span className="text-[14px] leading-6 text-[#9a8b6a]">{a(method.note)}</span></span><span className={`h-3 w-3 rotate-45 border border-black/60 ${selected===method.id?"bg-[#a0393e]":"bg-[#2a241d]"}`}/></button>)}</div><div className="mt-9 flex flex-wrap items-end justify-between gap-6 border-t border-[#e9dfc41f] pt-7"><div><p className="arm-eyebrow">{a("dueAtCounter")}</p><p className="arm-ui text-[42px]">{formatMoney(due)}</p><p className="text-[14px] italic text-[#9a8b6a]">{a("sealNote")}</p></div><button className="arm-ui flex min-h-[60px] items-center gap-3 border border-[#2a0c0e] bg-[radial-gradient(circle_at_30%_20%,#8a2f33,#4a1517)] px-8 text-[17px] uppercase tracking-[.1em] text-[#f6e9d2] shadow-[inset_0_1px_0_rgba(255,200,180,.22),0_14px_30px_rgba(0,0,0,.6)] hover:bg-[radial-gradient(circle_at_30%_20%,#a0393e,#5c1b1e)]" onClick={approve}><Mark name="seal" size={22}/>{a("pressTheSeal")}</button></div></>}
  </div>;
}
