"use client";

import { useI18n } from "./locale-provider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import { useDemo } from "./demo-provider";
import { DemoNotice } from "./site-header";

export function CheckoutView() {
  const { tr, formatMoney } = useI18n();
  const { state, totalCents } = useDemo(); const router = useRouter(); const [email, setEmail] = useState("adventurer@example.com");
  if (!state.cart.length) return <div className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">{tr("Your cart is empty")}</h1><Button className="mt-6" asChild><Link href="/catalog">{tr("Return to catalog")}</Link></Button></div>;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); sessionStorage.setItem("medivi-demo-checkout", JSON.stringify({ email })); router.push("/payment"); }
  return <div className="mx-auto max-w-5xl px-6 py-12"><h1 className="text-4xl font-bold">{tr("Demonstration checkout")}</h1><div className="mt-5"><DemoNotice /></div><form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]"><div className="space-y-6 rounded-2xl border bg-card p-6"><div><h2 className="text-xl font-bold">{tr("Contact")}</h2><p className="text-sm text-muted-foreground">{tr("Use fictional information. It never leaves your browser.")}</p></div><div className="space-y-2"><Label htmlFor="email">{tr("Email")}</Label><Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="name">{tr("Full name")}</Label><Input id="name" required defaultValue="Aria Stormborn"/></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="address">{tr("Address")}</Label><Input id="address" required defaultValue="42 Guildhall Road"/></div><div className="space-y-2"><Label htmlFor="city">{tr("City")}</Label><Input id="city" required defaultValue="Neverwinter"/></div><div className="space-y-2"><Label htmlFor="postal">{tr("Postal code")}</Label><Input id="postal" required defaultValue="00000"/></div></div></div><aside className="h-fit rounded-2xl border bg-card p-6"><h2 className="text-xl font-bold">{tr("Summary")}</h2><div className="mt-5 flex justify-between"><span>{state.cart.reduce((sum, item) => sum + item.quantity, 0)} {tr("items")}</span><strong>{formatMoney(totalCents)}</strong></div><div className="mt-4 flex justify-between border-t pt-4 text-lg"><span>{tr("Total")}</span><strong>{formatMoney(totalCents)}</strong></div><Button type="submit" size="lg" className="mt-6 w-full"><LockKeyhole/> {tr("Continue to simulation")}</Button><p className="mt-3 text-center text-xs text-muted-foreground">{tr("No card details will be requested.")}</p></aside></form></div>;
}
