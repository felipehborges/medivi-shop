import { Suspense } from "react";
import { CatalogClient } from "@/components/catalog-client";
import { LoadingCopy } from "@/components/loading-copy";

export const metadata = { title: "Catalog" };
export default function CatalogPage() { return <Suspense fallback={<LoadingCopy text="Opening the armory…" className="mx-auto max-w-7xl p-12" />}><CatalogClient /></Suspense>; }
