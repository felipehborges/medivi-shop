"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import {
  adjustStockAdmin,
  createVariantAdmin,
  deleteVariantAdmin,
  updateVariantAdmin,
} from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { stockAdjustmentSchema, variantSchema } from "@/lib/schemas/variant";

const createVariantSchema = variantSchema.extend({ productId: z.string().uuid() });

export async function createVariantAction(input: z.infer<typeof createVariantSchema>) {
  const admin = await requireAdmin();
  const { productId, ...rest } = createVariantSchema.parse(input);
  const parsed = variantSchema.parse(rest);
  await createVariantAdmin(db, admin.id, productId, parsed);
  revalidatePath(`/admin/products/${productId}`);
}

const updateVariantSchema = variantSchema.extend({ id: z.string().uuid(), productId: z.string().uuid() });

export async function updateVariantAction(input: z.infer<typeof updateVariantSchema>) {
  const admin = await requireAdmin();
  const { id, productId, ...rest } = updateVariantSchema.parse(input);
  const parsed = variantSchema.parse(rest);
  await updateVariantAdmin(db, admin.id, id, parsed);
  revalidatePath(`/admin/products/${productId}`);
}

const deleteVariantSchema = z.object({ id: z.string().uuid(), productId: z.string().uuid() });

export async function deleteVariantAction(input: z.infer<typeof deleteVariantSchema>) {
  const admin = await requireAdmin();
  const { id, productId } = deleteVariantSchema.parse(input);
  const result = await deleteVariantAdmin(db, admin.id, id);
  if (result.ok) revalidatePath(`/admin/products/${productId}`);
  return result;
}

const adjustStockActionSchema = stockAdjustmentSchema.extend({ productId: z.string().uuid() });

export async function adjustStockAction(input: z.infer<typeof adjustStockActionSchema>) {
  const admin = await requireAdmin();
  const { productId, ...rest } = adjustStockActionSchema.parse(input);
  const parsed = stockAdjustmentSchema.parse(rest);
  const result = await adjustStockAdmin(db, admin.id, parsed.variantId, parsed.delta, parsed.reason);
  if (result.ok) revalidatePath(`/admin/products/${productId}`);
  return result;
}
