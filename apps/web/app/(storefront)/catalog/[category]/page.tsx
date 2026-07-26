import type { Metadata } from "next";

import { CatalogView, type CatalogSearchParams } from "@/components/catalog-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  return { title: `${category} — Medivi Shop` };
}

export default async function CategoryCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const [{ category }, search] = await Promise.all([params, searchParams]);
  return (
    <CatalogView
      categorySlug={category}
      basePath={`/catalog/${category}`}
      searchParams={search}
    />
  );
}
