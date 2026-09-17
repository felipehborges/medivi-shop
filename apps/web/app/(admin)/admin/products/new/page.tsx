import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listCategoryOptions } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product — Admin — Medivi Shop" };

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await listCategoryOptions(db);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl"><LocalizedText text={"New product"} /></h1>
      <ProductForm categories={categories} />
    </div>
  );
}
