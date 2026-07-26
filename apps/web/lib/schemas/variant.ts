import { z } from "zod";

export const variantSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  sku: z.string().min(1, "Enter a SKU"),
  priceOverrideCents: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
});

export type VariantFormInput = z.infer<typeof variantSchema>;

export const stockAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero amount"),
  reason: z.enum(["restock", "adjustment"]),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
