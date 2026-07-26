"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import {
  createCategoryAdmin,
  deleteCategoryAdmin,
  updateCategoryAdmin,
  type CategoryInput,
  type DeleteCategoryResult,
  type SaveCategoryResult,
} from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { categorySchema } from "@/lib/schemas/category";

function toCategoryInput(parsed: z.infer<typeof categorySchema>): CategoryInput {
  return {
    name: parsed.name,
    slug: parsed.slug,
    description: parsed.description || undefined,
    imageUrl: parsed.imageUrl || undefined,
    parentId: parsed.parentId || null,
  };
}

export async function createCategoryAction(input: z.infer<typeof categorySchema>): Promise<SaveCategoryResult> {
  const admin = await requireAdmin();
  const parsed = categorySchema.parse(input);
  const result = await createCategoryAdmin(db, admin.id, toCategoryInput(parsed));
  if (result.ok) revalidatePath("/admin/categories");
  return result;
}

const updateCategorySchema = categorySchema.extend({ id: z.string().uuid() });

export async function updateCategoryAction(input: z.infer<typeof updateCategorySchema>): Promise<SaveCategoryResult> {
  const admin = await requireAdmin();
  const { id, ...rest } = updateCategorySchema.parse(input);
  const parsed = categorySchema.parse(rest);
  const result = await updateCategoryAdmin(db, admin.id, id, toCategoryInput(parsed));
  if (result.ok) revalidatePath("/admin/categories");
  return result;
}

const deleteCategorySchema = z.object({ id: z.string().uuid() });

export async function deleteCategoryAction(input: z.infer<typeof deleteCategorySchema>): Promise<DeleteCategoryResult> {
  const admin = await requireAdmin();
  const { id } = deleteCategorySchema.parse(input);
  const result = await deleteCategoryAdmin(db, admin.id, id);
  if (result.ok) revalidatePath("/admin/categories");
  return result;
}
