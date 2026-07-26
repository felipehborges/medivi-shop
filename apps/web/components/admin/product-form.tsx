"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import type { CategoryOption } from "@medivi/db/queries";
import { productSchema, type ProductFormInput } from "@/lib/schemas/product";
import { createProductAction, updateProductAction } from "@/lib/actions/admin-products";

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ProductForm({
  categories,
  product,
}: {
  categories: CategoryOption[];
  product?: ProductFormInput & { id: string };
}) {
  const router = useRouter();
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugLocked, setSlugLocked] = useState(!!product);
  const [confirmingSlugChange, setConfirmingSlugChange] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product ?? { status: "draft", basePriceCents: 0 },
  });

  async function onSubmit(values: ProductFormInput) {
    setSlugError(null);
    const result = product
      ? await updateProductAction({ id: product.id, ...values })
      : await createProductAction(values);

    if (!result.ok) {
      setSlugError("That slug is already taken — choose another.");
      return;
    }
    router.push(`/admin/products/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 rounded-xl border p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && (
            <p role="alert" className="text-sm text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" disabled={slugLocked} aria-invalid={!!errors.slug} {...register("slug")} />
          {slugLocked && !confirmingSlugChange && (
            <button
              type="button"
              className="self-start text-xs text-muted-foreground underline"
              onClick={() => setConfirmingSlugChange(true)}
            >
              Change slug…
            </button>
          )}
          {confirmingSlugChange && (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
              <p>
                Changing the slug can break existing links (bookmarks, shared URLs) — this won&apos;t redirect the
                old one.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSlugLocked(false);
                    setConfirmingSlugChange(false);
                  }}
                >
                  Yes, unlock it
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingSlugChange(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {(errors.slug || slugError) && (
            <p role="alert" className="text-sm text-destructive">
              {errors.slug?.message ?? slugError}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">Category</Label>
          <select id="categoryId" className={selectClassName} {...register("categoryId")}>
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p role="alert" className="text-sm text-destructive">
              {errors.categoryId.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="material">Material</Label>
          <Input id="material" {...register("material")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Short description</Label>
        <textarea
          id="description"
          rows={2}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("description")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="longDescription">Long description</Label>
        <textarea
          id="longDescription"
          rows={5}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("longDescription")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="basePriceCents">Base price (cents)</Label>
          <Input
            id="basePriceCents"
            type="number"
            inputMode="numeric"
            min={0}
            aria-invalid={!!errors.basePriceCents}
            {...register("basePriceCents", { valueAsNumber: true })}
          />
          {errors.basePriceCents && (
            <p role="alert" className="text-sm text-destructive">
              {errors.basePriceCents.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" className={selectClassName} {...register("status")}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" {...register("isFeatured")} />
          Featured
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="seoTitle">SEO title</Label>
          <Input id="seoTitle" {...register("seoTitle")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="seoDescription">SEO description</Label>
          <Input id="seoDescription" {...register("seoDescription")} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {product ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
