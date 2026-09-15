"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Menu, ShieldCheck, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@medivi/ui/components/theme-toggle";
import { Button } from "@medivi/ui/components/ui/button";
import { useDemo } from "./demo-provider";
import brandMark from "@/app/icon.png";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./locale-provider";

export function SiteHeader() {
  const { t } = useI18n();
  const links = [{ href: "/catalog", label: t("armory") }, { href: "/catalog?category=relics", label: t("relics") }, { href: "/catalog?category=potions", label: t("potions") }, { href: "/admin", label: t("admin") }];
  const { cartCount, state } = useDemo();
  const [open, setOpen] = useState(false);
  return <>
    <div className="bg-primary px-4 py-2 text-center text-xs font-semibold tracking-wide text-primary-foreground">{t("demoBanner")}</div>
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 font-display text-xl font-bold tracking-widest" aria-label="Medivi home"><Image src={brandMark} alt="" width={38} height={38} priority /><span>MEDIVI</span></Link>
        <nav className="hidden items-center gap-7 md:flex">{links.map((link) => <Link className="text-sm font-medium text-muted-foreground transition hover:text-foreground" href={link.href} key={link.href}>{link.label}</Link>)}</nav>
        <LanguageSwitcher /><ThemeToggle />
        <Button variant="ghost" size="icon" asChild aria-label={t("wishlist")}><Link href="/wishlist" className="relative"><Heart /><span className="absolute -right-1 -top-1 text-[10px] font-bold">{state.wishlist.length || ""}</span></Link></Button>
        <Button variant="ghost" size="icon" asChild aria-label={t("cart")}><Link href="/cart" className="relative"><ShoppingBag /><span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{cartCount || ""}</span></Link></Button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label={t("menu")}>{open ? <X /> : <Menu />}</Button>
      </div>
      {open && <nav className="grid border-t p-4 md:hidden">{links.map((link) => <Link className="py-3" href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}</nav>}
    </header>
  </>;
}

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return <div className={`flex gap-3 rounded-xl border border-secondary/50 bg-secondary/15 ${compact ? "p-3 text-sm" : "p-4"}`}><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><strong>{t("safeDemo")}</strong><p className="text-muted-foreground">{t("safeDemoText")}</p></div></div>;
}
