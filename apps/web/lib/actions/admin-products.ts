"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import {
  addProductImageAdmin,
  createProductAdmin,
  deleteProductImageAdmin,
  setProductStatusAdmin,
  updateProductAdmin,
  type SaveProductResult,
} from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { getStorageProvider } from "@/lib/storage";
import { productSchema } from "@/lib/schemas/product";

export async function createProductAction(input: z.infer<typeof productSchema>): Promise<SaveProductResult> {
  const admin = await requireAdmin();
  const parsed = productSchema.parse(input);
  const result = await createProductAdmin(db, admin.id, parsed);
  if (result.ok) {
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${result.id}`);
  }
  return result;
}

const updateProductSchema = productSchema.extend({ id: z.string().uuid() });

export async function updateProductAction(input: z.infer<typeof updateProductSchema>): Promise<SaveProductResult> {
  const admin = await requireAdmin();
  const { id, ...rest } = updateProductSchema.parse(input);
  const parsed = productSchema.parse(rest);
  const result = await updateProductAdmin(db, admin.id, id, parsed);
  if (result.ok) {
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
  }
  return result;
}

const setProductStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]),
});

export async function setProductStatusAction(input: z.infer<typeof setProductStatusSchema>) {
  const admin = await requireAdmin();
  const { id, status } = setProductStatusSchema.parse(input);
  const result = await setProductStatusAdmin(db, admin.id, id, status);
  if (result.ok) {
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
  }
  return result;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

export type UploadProductImageResult =
  | { ok: true }
  | { ok: false; reason: "invalid_file" | "too_large" | "invalid_type" };

/** Takes `FormData` directly (not a Zod-parsed object) since it carries a `File`, not JSON. */
export async function uploadProductImageAction(formData: FormData): Promise<UploadProductImageResult> {
  const admin = await requireAdmin();
  const productId = z.string().uuid().parse(formData.get("productId"));
  const altText = z.string().min(1).parse(formData.get("altText"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "invalid_file" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return { ok: false, reason: "invalid_type" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await getStorageProvider().upload({ buffer, filename: file.name, contentType: file.type });

  await addProductImageAdmin(db, admin.id, productId, { url, altText });
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}

const deleteProductImageSchema = z.object({ imageId: z.string().uuid(), productId: z.string().uuid() });

export async function deleteProductImageAction(input: z.infer<typeof deleteProductImageSchema>) {
  const admin = await requireAdmin();
  const { imageId, productId } = deleteProductImageSchema.parse(input);
  const deleted = await deleteProductImageAdmin(db, admin.id, imageId);
  if (deleted) {
    await getStorageProvider().delete(deleted.url);
    revalidatePath(`/admin/products/${productId}`);
  }
}
