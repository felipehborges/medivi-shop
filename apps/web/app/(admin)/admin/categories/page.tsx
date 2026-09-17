import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listCategoriesAdmin } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories — Admin — Medivi Shop" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await listCategoriesAdmin(db);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl"><LocalizedText text={"Categories"} /></h1>
      <CategoryManager categories={categories} />
    </div>
  );
}
