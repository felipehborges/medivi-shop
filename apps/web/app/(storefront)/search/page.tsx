import type { Metadata } from "next";

import { CatalogView, type CatalogSearchParams } from "@/components/catalog-view";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `“${q}” — Medivi Shop` : "Search — Medivi Shop" };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return <CatalogView basePath="/search" searchParams={params} />;
}
