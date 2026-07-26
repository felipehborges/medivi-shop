import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getProductBySlug, listRelatedProducts } from "@medivi/db/queries";
import { ProductGallery } from "@/components/product-gallery";
import { ProductVariantPanel } from "@/components/product-variant-panel";
import { RelatedProducts } from "@/components/related-products";

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

  const related = await listRelatedProducts(db, {
    categoryId: product.categoryId,
    excludeProductId: product.id,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-1 text-sm text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">
          Catalog
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/catalog/${product.categorySlug}`} className="hover:text-foreground">
          {product.categoryName}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-4">
          <div>
            {product.material && (
              <p className="text-sm text-muted-foreground">{product.material}</p>
            )}
            <h1 className="font-display text-3xl">{product.name}</h1>
          </div>

          <ProductVariantPanel variants={product.variants} currency={product.currency} />

          {product.description && <p className="text-muted-foreground">{product.description}</p>}
          {product.longDescription && <p>{product.longDescription}</p>}
        </div>
      </div>

      <RelatedProducts products={related} />
    </div>
  );
}
