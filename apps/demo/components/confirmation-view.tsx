"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemo } from "./demo-provider";
import { useArmory, Mark, Parchment } from "./armory-primitives";
export function ConfirmationView() {
  const { a } = useArmory();
  const { state, hydrated } = useDemo();
  const id = useSearchParams().get("id");
  const order = state.orders.find(item=>item.id===id);
  if (!hydrated) return <div className="arm-wrap py-24 text-center">{a("sealedTitle")}…</div>;
  if (!order) return <div className="arm-wrap py-24 text-center"><p className="arm-title">{a("noneFound")}</p><Link href="/catalog" className="arm-button mt-7">{a("seeTheWares")}</Link></div>;
  return <div className="arm-wrap max-w-[828px] py-[78px]"><Parchment className="px-7 py-14 text-center sm:px-12"><Mark name="seal" tone="ink" size={54} className="mx-auto"/><h1 className="arm-display mt-4 text-[44px]">{a("sealedTitle")}</h1><p className="mx-auto mt-4 max-w-[44ch] text-[16px] leading-7 text-[#4a3a24]">{a("sealedSub")}</p><div className="arm-ui mx-auto mt-8 inline-block border-y border-[#3a2c1857] px-7 py-4"><span className="block text-[12px] uppercase tracking-widest text-[#6a5638]">{a("entryNo")}</span><strong className="text-[24px]">MMXCI–{order.id.replace("MDV-","")}</strong></div><p className="mt-7 text-[14px] italic text-[#5c4a30]">{a("sealedNote")}</p><Link href="/catalog" className="arm-button mt-8">{a("backToFloor")} →</Link></Parchment></div>;
}
