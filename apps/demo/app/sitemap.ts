import type { MetadataRoute } from "next";
import { products } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/catalog", "/admin"].map((path) => ({ url: `${siteUrl}${path}` }))
    .concat(products.map((product) => ({ url: `${siteUrl}/product/${product.slug}` })));
}
