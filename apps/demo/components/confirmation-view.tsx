"use client";

import { useI18n } from "./locale-provider";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { useDemo } from "./demo-provider";

export function ConfirmationView() {
  const { tr, formatMoney } = useI18n(); const { state } = useDemo(); const id = useSearchParams().get("id"); const order = state.orders.find((item) => item.id === id); if (!order) return <div className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">{tr("Demo order not found")}</h1><p className="mt-2 text-muted-foreground">{tr("Browser-local orders disappear when demo data is reset.")}</p><Button className="mt-6" asChild><Link href="/catalog">{tr("Return to catalog")}</Link></Button></div>; return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><CheckCircle2 className="mx-auto size-16 text-green-600"/><p className="mt-5 text-sm font-semibold uppercase tracking-[.25em] text-green-600">{tr("Simulation approved")}</p><h1 className="mt-3 text-4xl font-bold">{tr("Your quest is confirmed")}</h1><p className="mt-4 text-muted-foreground">{tr("No payment was made and no email was sent. This order exists only in this browser.")}</p><div className="mt-8 rounded-2xl border bg-card p-6 text-left"><div className="flex justify-between"><span className="text-muted-foreground">{tr("Demo order")}</span><strong>{order.id}</strong></div><div className="mt-3 flex justify-between"><span className="text-muted-foreground">{tr("Display email")}</span><strong>{order.email}</strong></div><div className="mt-3 flex justify-between border-t pt-4 text-lg"><span>{tr("Simulated total")}</span><strong>{formatMoney(order.totalCents)}</strong></div></div><div className="mt-8 flex justify-center gap-3"><Button asChild><Link href="/catalog">{tr("Continue exploring")}</Link></Button><Button variant="outline" asChild><Link href="/admin">{tr("View demo operations")}</Link></Button></div></div>; }
