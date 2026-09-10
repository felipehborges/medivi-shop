import type { MetadataRoute } from "next";
import { products } from "@/lib/catalog";
const base = "https://medivi-shop.vercel.app";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap { return ["", "/catalog", "/cart", "/wishlist", "/admin"].map((path) => ({ url: `${base}${path}` })).concat(products.map((product) => ({ url: `${base}/product/${product.slug}` }))); }
