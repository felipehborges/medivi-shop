import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@medivi/db/client";
import { getProductForAdmin, listCategoryOptions } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { VariantManager } from "@/components/admin/variant-manager";

export const metadata: Metadata = { title: "Edit product — Admin — Medivi Shop" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [product, categories] = await Promise.all([getProductForAdmin(db, id), listCategoryOptions(db)]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">{product.name}</h1>
      <ProductForm
        categories={categories}
        product={{
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          slug: product.slug,
          description: product.description ?? undefined,
          longDescription: product.longDescription ?? undefined,
          material: product.material ?? undefined,
          basePriceCents: product.basePriceCents,
          status: product.status,
          isFeatured: product.isFeatured,
          seoTitle: product.seoTitle ?? undefined,
          seoDescription: product.seoDescription ?? undefined,
        }}
      />
      <ProductImageManager productId={product.id} images={product.images} />
      <VariantManager productId={product.id} variants={product.variants} />
    </div>
  );
}
