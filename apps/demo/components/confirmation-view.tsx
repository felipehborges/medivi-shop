"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@medivi/ui/components/ui/button";
import { money } from "@/lib/catalog";
import { useDemo } from "./demo-provider";

export function ConfirmationView() { const { state } = useDemo(); const id = useSearchParams().get("id"); const order = state.orders.find((item) => item.id === id); if (!order) return <div className="mx-auto max-w-xl px-6 py-24 text-center"><h1 className="text-3xl font-bold">Demo order not found</h1><p className="mt-2 text-muted-foreground">Browser-local orders disappear when demo data is reset.</p><Button className="mt-6" asChild><Link href="/catalog">Return to catalog</Link></Button></div>; return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><CheckCircle2 className="mx-auto size-16 text-green-600"/><p className="mt-5 text-sm font-semibold uppercase tracking-[.25em] text-green-600">Simulation approved</p><h1 className="mt-3 text-4xl font-bold">Your quest is confirmed</h1><p className="mt-4 text-muted-foreground">No payment was made and no email was sent. This order exists only in this browser.</p><div className="mt-8 rounded-2xl border bg-card p-6 text-left"><div className="flex justify-between"><span className="text-muted-foreground">Demo order</span><strong>{order.id}</strong></div><div className="mt-3 flex justify-between"><span className="text-muted-foreground">Display email</span><strong>{order.email}</strong></div><div className="mt-3 flex justify-between border-t pt-4 text-lg"><span>Simulated total</span><strong>{money(order.totalCents)}</strong></div></div><div className="mt-8 flex justify-center gap-3"><Button asChild><Link href="/catalog">Continue exploring</Link></Button><Button variant="outline" asChild><Link href="/admin">View demo operations</Link></Button></div></div>; }
