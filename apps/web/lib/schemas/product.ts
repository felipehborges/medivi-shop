import { z } from "zod";

export const productSchema = z.object({
  categoryId: z.string().uuid("Choose a category"),
  name: z.string().min(2, "Enter a name"),
  slug: z
    .string()
    .min(2, "Enter a slug")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  longDescription: z.string().optional(),
  material: z.string().optional(),
  basePriceCents: z.number().int("Whole cents only").min(0, "Must be 0 or more"),
  status: z.enum(["draft", "active", "archived"]),
  isFeatured: z.boolean().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export type ProductFormInput = z.infer<typeof productSchema>;
