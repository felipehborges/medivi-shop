import { Suspense } from "react";
import { CatalogClient } from "@/components/catalog-client";

export const metadata = { title: "Catalog" };
export default function CatalogPage() { return <Suspense fallback={<div className="mx-auto max-w-7xl p-12">Opening the armory…</div>}><CatalogClient /></Suspense>; }
