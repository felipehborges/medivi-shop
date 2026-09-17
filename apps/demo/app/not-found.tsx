"use client";

import Link from "next/link";
import { Button } from "@medivi/ui/components/ui/button";
import { useI18n } from "@/components/locale-provider";
export default function NotFound() { const { tr } = useI18n(); return <div className="mx-auto max-w-xl px-6 py-24 text-center"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">{tr("404 · Lost realm")}</p><h1 className="mt-3 text-4xl font-bold">{tr("This path is not on the map")}</h1><Button className="mt-7" asChild><Link href="/">{tr("Return home")}</Link></Button></div>; }
