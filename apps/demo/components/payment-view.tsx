"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, CreditCard, XCircle } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { money } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { DemoNotice } from "./site-header";

export function PaymentView() {
  const { state, totalCents, finishOrder } = useDemo(); const router = useRouter(); const [declined, setDeclined] = useState(false);
  function approve() { const raw = sessionStorage.getItem("medivi-demo-checkout"); const email = raw ? (JSON.parse(raw) as { email?: string }).email ?? "adventurer@example.com" : "adventurer@example.com"; const order = finishOrder(email); sessionStorage.removeItem("medivi-demo-checkout"); router.push(`/order/confirmation?id=${encodeURIComponent(order.id)}`); }
  if (!state.cart.length) return <div className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">No pending demo checkout</h1><Button className="mt-6" asChild><Link href="/catalog">Browse catalog</Link></Button></div>;
  return <div className="mx-auto max-w-2xl px-6 py-12"><h1 className="text-center text-4xl font-bold">Simulated payment</h1><p className="mt-3 text-center text-muted-foreground">Choose an outcome to preview the storefront response.</p><div className="mt-7"><DemoNotice /></div><div className="mt-7 rounded-3xl border bg-card p-7 shadow-xl"><div className="flex items-center justify-between border-b pb-5"><div className="flex items-center gap-3"><div className="rounded-full bg-muted p-3"><CreditCard/></div><div><p className="text-sm text-muted-foreground">Demo total</p><strong className="text-2xl">{money(totalCents)}</strong></div></div><span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600">NO CHARGE</span></div>{declined && <div className="mt-5 flex gap-3 rounded-xl bg-destructive/10 p-4 text-destructive"><XCircle className="shrink-0"/><p><strong>Payment simulation declined.</strong><br/><span className="text-sm">Your cart was preserved. Choose approval to continue.</span></p></div>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><Button size="lg" variant="outline" onClick={() => setDeclined(true)}><XCircle/> Simulate decline</Button><Button size="lg" onClick={approve}><CheckCircle2/> Simulate approval</Button></div><p className="mt-5 text-center text-xs text-muted-foreground">This interface intentionally collects no card number, security code, or billing credential.</p></div></div>;
}
