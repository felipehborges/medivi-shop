"use client";

import Link from "next/link";
import { Heart, Menu, ShieldCheck, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@medivi/ui/components/theme-toggle";
import { Button } from "@medivi/ui/components/ui/button";
import { useDemo } from "./demo-provider";

const links = [{ href: "/catalog", label: "Armory" }, { href: "/catalog?category=relics", label: "Relics" }, { href: "/catalog?category=potions", label: "Potions" }, { href: "/admin", label: "Admin demo" }];

export function SiteHeader() {
  const { cartCount, state } = useDemo();
  const [open, setOpen] = useState(false);
  return <>
    <div className="bg-primary px-4 py-2 text-center text-xs font-semibold tracking-wide text-primary-foreground">INTERACTIVE PORTFOLIO DEMO · NO REAL PURCHASES OR PAYMENTS</div>
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="mr-auto font-display text-xl font-bold tracking-widest">MEDIVI</Link>
        <nav className="hidden items-center gap-7 md:flex">{links.map((link) => <Link className="text-sm font-medium text-muted-foreground transition hover:text-foreground" href={link.href} key={link.href}>{link.label}</Link>)}</nav>
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild aria-label="Wishlist"><Link href="/wishlist" className="relative"><Heart /><span className="absolute -right-1 -top-1 text-[10px] font-bold">{state.wishlist.length || ""}</span></Link></Button>
        <Button variant="ghost" size="icon" asChild aria-label="Cart"><Link href="/cart" className="relative"><ShoppingBag /><span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{cartCount || ""}</span></Link></Button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</Button>
      </div>
      {open && <nav className="grid border-t p-4 md:hidden">{links.map((link) => <Link className="py-3" href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}</nav>}
    </header>
  </>;
}

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return <div className={`flex gap-3 rounded-xl border border-secondary/50 bg-secondary/15 ${compact ? "p-3 text-sm" : "p-4"}`}><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><strong>Safe interactive demonstration</strong><p className="text-muted-foreground">Everything stays in this browser. No account is created, no data is sent, and no payment can occur.</p></div></div>;
}
