import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "Enter a name"),
  slug: z
    .string()
    .min(2, "Enter a slug")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  parentId: z.string().uuid().optional().or(z.literal("")),
});

export type CategoryFormInput = z.infer<typeof categorySchema>;
