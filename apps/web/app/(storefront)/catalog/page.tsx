import type { Metadata } from "next";

import { CatalogView, type CatalogSearchParams } from "@/components/catalog-view";

export const metadata: Metadata = {
  title: "Catalog — Medivi Shop",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return <CatalogView basePath="/catalog" searchParams={params} />;
}
