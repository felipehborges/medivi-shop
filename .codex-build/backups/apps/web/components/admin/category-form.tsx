"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import type { AdminCategory, CategoryOption } from "@medivi/db/queries";
import { categorySchema, type CategoryFormInput } from "@/lib/schemas/category";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/admin-categories";

export function CategoryForm({
  category,
  parentOptions,
  onDone,
}: {
  category?: AdminCategory;
  parentOptions: CategoryOption[];
  onDone: () => void;
}) {
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugLocked, setSlugLocked] = useState(!!category);
  const [confirmingSlugChange, setConfirmingSlugChange] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          description: category.description ?? undefined,
          imageUrl: category.imageUrl ?? undefined,
          parentId: category.parentId ?? undefined,
        }
      : {},
  });

  async function onSubmit(values: CategoryFormInput) {
    setSlugError(null);
    const result = category
      ? await updateCategoryAction({ id: category.id, ...values })
      : await createCategoryAction(values);
    if (!result.ok) {
      setSlugError("That slug is already taken — choose another.");
      return;
    }
    onDone();
  }

  // Top-level categories can't be re-parented to themselves or their own child (data model only supports one level).
  const eligibleParents = parentOptions.filter((p) => p.id !== category?.id && !p.parentId);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cat-name">Name</Label>
          <Input id="cat-name" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && (
            <p role="alert" className="text-sm text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cat-slug">Slug</Label>
          <Input id="cat-slug" disabled={slugLocked} aria-invalid={!!errors.slug} {...register("slug")} />
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="cat-description">Description</Label>
        <Input id="cat-description" {...register("description")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cat-imageUrl">Image URL</Label>
          <Input id="cat-imageUrl" {...register("imageUrl")} />
          {errors.imageUrl && (
            <p role="alert" className="text-sm text-destructive">
              {errors.imageUrl.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cat-parentId">Parent category</Label>
          <select
            id="cat-parentId"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none dark:bg-input/30"
            {...register("parentId")}
          >
            <option value="">None (top-level)</option>
            {eligibleParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {category ? "Save changes" : "Add category"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
