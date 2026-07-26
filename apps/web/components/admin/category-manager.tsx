"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import type { AdminCategory } from "@medivi/db/queries";
import { deleteCategoryAction } from "@/lib/actions/admin-categories";
import { CategoryForm } from "./category-form";

const DELETE_ERROR_MESSAGE: Record<string, string> = {
  has_products: "Can't delete — products are still assigned to this category.",
  has_children: "Can't delete — it has child categories.",
  not_found: "Category not found.",
};

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  async function handleDelete(id: string) {
    setDeleteError(null);
    const result = await deleteCategoryAction({ id });
    if (!result.ok) {
      setDeleteError({ id, message: DELETE_ERROR_MESSAGE[result.reason] ?? "Could not delete category." });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.map((c) =>
        editingId === c.id ? (
          <CategoryForm
            key={c.id}
            category={c}
            parentOptions={categories}
            onDone={() => {
              setEditingId(null);
              router.refresh();
            }}
          />
        ) : (
          <div key={c.id} className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              <p className="font-medium">
                {c.parentId ? `— ${c.name}` : c.name}
                {c.productCount > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {c.productCount} product{c.productCount === 1 ? "" : "s"}
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">/{c.slug}</p>
              {deleteError?.id === c.id && (
                <p role="alert" className="text-sm text-destructive">
                  {deleteError.message}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(c.id)}>
                Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                Delete
              </Button>
            </div>
          </div>
        ),
      )}

      {editingId === "new" ? (
        <CategoryForm
          parentOptions={categories}
          onDone={() => {
            setEditingId(null);
            router.refresh();
          }}
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setEditingId("new")}>
          Add category
        </Button>
      )}
    </div>
  );
}
