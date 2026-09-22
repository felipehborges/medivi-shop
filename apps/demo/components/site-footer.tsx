"use client";
import Link from "next/link";
import { DEPTS, localizedDept } from "@/lib/armory";
import { useArmory, Mark } from "./armory-primitives";
export function SiteFooter() {
  const { a, locale } = useArmory();
  return <footer className="mt-auto border-t border-[#0a0908] bg-[linear-gradient(#1b1409,#120d07)] py-14">
    <div className="arm-wrap grid gap-10 md:grid-cols-[1.2fr_.8fr_1fr]">
      <div><Link href="/" className="arm-display text-[30px]">Medivi</Link><p className="arm-ui text-[12px] uppercase tracking-[.14em] text-[#9a8b6a]">{a("house")}</p><p className="mt-5 max-w-[36ch] text-[14px] leading-7 text-[#9a8b6a]">{a("footerText")}</p></div>
      <div><h2 className="arm-eyebrow">{a("footerShop")}</h2><div className="arm-ui mt-4 grid gap-2 text-[16px] text-[#cbb98f]"><Link href="/catalog">{a("allWares")}</Link>{DEPTS.map(dept=><Link key={dept.slug} href={`/catalog?dept=${dept.slug}`}>{localizedDept(locale,dept.slug)?.name}</Link>)}<Link href="/wishlist">{a("watchTitle")}</Link></div></div>
      <div><h2 className="arm-eyebrow">{a("footerHouse")}</h2><p className="mt-4 max-w-[38ch] text-[14px] leading-7 text-[#9a8b6a]">{a("footerHouseText")}</p><Link href="/admin" className="arm-link mt-4 inline-flex items-center gap-2"><Mark name="coins" tone="bronze" size={17}/>{a("adminTitle")}</Link><p className="mt-8 text-[13px] leading-6 text-[#9a8b6a]">Icons: Lorc, Delapouite, Carl Olsen, Viscious Speed and Lucas (lucasms), via game-icons.net · CC BY 3.0.</p></div>
    </div>
  </footer>;
}
