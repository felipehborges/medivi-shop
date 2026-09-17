import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getProductBySlug, getWishlistedProductIds, listRelatedProducts } from "@medivi/db/queries";
import { getSession } from "@/lib/auth-guards";
import { env } from "@/lib/env";
import { ProductGallery } from "@/components/product-gallery";
import { ProductVariantPanel } from "@/components/product-variant-panel";
import { RelatedProducts } from "@/components/related-products";
import { WishlistButton } from "@/components/wishlist-button";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(db, slug);
  if (!product) return {};
  return {
    title: `${product.name} — Medivi Shop`,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(db, slug);
  if (!product) notFound();

  const [related, session] = await Promise.all([
    listRelatedProducts(db, { categoryId: product.categoryId, excludeProductId: product.id }),
    getSession(),
  ]);
  const wishlistedIds = session ? await getWishlistedProductIds(db, session.user.id) : null;

  const productUrl = `${env.NEXT_PUBLIC_APP_URL}/product/${product.slug}`;
  const inStock = product.variants.some((v) => v.stock > 0);
  const prices = product.variants.map((v) => v.priceCents / 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description ?? undefined,
          image: product.images.map((img) => img.url),
          url: productUrl,
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: product.currency,
            lowPrice: Math.min(...prices, product.basePriceCents / 100),
            highPrice: Math.max(...prices, product.basePriceCents / 100),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Catalog", item: `${env.NEXT_PUBLIC_APP_URL}/catalog` },
            {
              "@type": "ListItem",
              position: 2,
              name: product.categoryName,
              item: `${env.NEXT_PUBLIC_APP_URL}/catalog/${product.categorySlug}`,
            },
            { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
          ],
        }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-1 text-sm text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">
          <LocalizedText text={"Catalog "} /></Link>
        <span aria-hidden="true">/</span>
        <Link href={`/catalog/${product.categorySlug}`} className="hover:text-foreground">
          <LocalizedText text={product.categoryName} />
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page"><LocalizedText text={product.name} /></span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {product.material && (
                <p className="text-sm text-muted-foreground"><LocalizedText text={product.material} /></p>
              )}
              <h1 className="font-display text-3xl"><LocalizedText text={product.name} /></h1>
            </div>
            {wishlistedIds && (
              <WishlistButton productId={product.id} initialWishlisted={wishlistedIds.has(product.id)} />
            )}
          </div>

          <ProductVariantPanel variants={product.variants} currency={product.currency} />

          {product.description && <p className="text-muted-foreground"><LocalizedText text={product.description} /></p>}
          {product.longDescription && <p><LocalizedText text={product.longDescription} /></p>}
        </div>
      </div>

      <RelatedProducts products={related} wishlistedIds={wishlistedIds} />
    </div>
  );
}
