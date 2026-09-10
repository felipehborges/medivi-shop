import Link from "next/link";
import { Button } from "@medivi/ui/components/ui/button";
export default function NotFound() { return <div className="mx-auto max-w-xl px-6 py-24 text-center"><p className="text-sm font-semibold uppercase tracking-[.25em] text-accent">404 · Lost realm</p><h1 className="mt-3 text-4xl font-bold">This path is not on the map</h1><Button className="mt-7" asChild><Link href="/">Return home</Link></Button></div>; }
