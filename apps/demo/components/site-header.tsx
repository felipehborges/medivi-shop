"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "./demo-provider";
import { useArmory, Mark } from "./armory-primitives";
import { roman } from "@/lib/armory";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader() {
  const { a } = useArmory();
  const { cartCount, state } = useDemo();
  const [open, setOpen] = useState(false);
  const links = [{ href:"/", label:a("navHome") }, { href:"/catalog", label:a("navShop") }, { href:"/#departments", label:a("navDepartments") }];
  return <>
    <div className="border-b border-[#0c0a08] bg-[linear-gradient(#3a2a1c,#2a1c12)] px-4 py-1.5 text-center text-[13px] italic text-[#c6b48a]"><span className="inline-flex items-center gap-2"><Mark name="feather" tone="bronze" size={13}/>{a("banner")}</span></div>
    <header className="sticky top-0 z-50 border-b border-[#090807] bg-[linear-gradient(#20180f,#191309)] shadow-[0_10px_26px_rgba(0,0,0,.55)]">
      <div className="arm-wrap flex min-h-[74px] flex-wrap items-center gap-5 py-3">
        <Link href="/" className="mr-auto flex items-center gap-3" aria-label="Medivi"><Mark name="swords" tone="bronze" size={30}/><span className="grid"><span className="arm-display text-[30px] leading-none tracking-[.06em]">Medivi</span><span className="arm-ui text-[12px] uppercase tracking-[.14em] text-[#9a8b6a]">{a("house")}</span></span></Link>
        <nav className="arm-ui hidden items-center gap-6 text-[17px] text-[#cbb98f] min-[900px]:flex">{links.map(link=><Link key={link.href} href={link.href} className="border-b border-transparent hover:border-[#b08a4a]">{link.label}</Link>)}</nav>
        <div className="arm-ui flex items-center gap-3 border-l border-[#e9dfc424] pl-3 text-[#cbb98f]">
          <Link href="/wishlist" className="flex min-h-11 items-center gap-1.5" aria-label={a("watchTitle")}><Mark name="feather" size={16}/>{roman(state.wishlist.length)}</Link>
          <Link href="/cart" className="flex min-h-11 items-center gap-1.5" aria-label={a("cartTitle")}><Mark name="coins" size={17}/>{roman(cartCount)}</Link>
        </div>
        <LanguageSwitcher />
        <button className="arm-ui min-h-11 min-w-11 border border-[#4a3b22] text-[#cbb98f] min-[900px]:hidden" onClick={()=>setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>☰</button>
      </div>
      {open && <nav className="arm-ui arm-wrap grid border-t border-[#4a3b22] py-3 text-[#cbb98f] min-[900px]:hidden">{links.map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)} className="py-3">{link.label}</Link>)}</nav>}
    </header>
  </>;
}

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  const { a } = useArmory();
  return <div className={`arm-plate flex items-start gap-3 ${compact ? "p-3 text-[13px]" : "p-5 text-[15px]"}`}><Mark name="seal" tone="bronze" size={20}/><p className="text-[#b7a67d]">{a("demoLine")}</p></div>;
}
