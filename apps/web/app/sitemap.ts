import type { MetadataRoute } from "next";

import { db } from "@medivi/db/client";
import { listCategoryTree, listProducts } from "@medivi/db/queries";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const STATIC_ROUTES = ["", "/catalog", "/search", "/privacy", "/terms", "/shipping-returns"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;

  const [categories, products] = await Promise.all([
    listCategoryTree(db),
    listProducts(db, { pageSize: 100 }),
  ]);

  const categoryUrls = categories.flatMap((c) => [c.slug, ...c.children.map((ch) => ch.slug)]);

  return [
    ...STATIC_ROUTES.map((path) => ({ url: `${base}${path}` })),
    ...categoryUrls.map((slug) => ({ url: `${base}/catalog/${slug}` })),
    ...products.items.map((p) => ({ url: `${base}/product/${p.slug}` })),
  ];
}
