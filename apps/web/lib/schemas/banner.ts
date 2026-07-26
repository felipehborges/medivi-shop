import { z } from "zod";

export const bannerSchema = z.object({
  title: z.string().min(2, "Enter a title"),
  subtitle: z.string().optional(),
  imageUrl: z.string().url("Enter a valid image URL"),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  placement: z.enum(["hero", "category"]),
  isActive: z.boolean().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export type BannerFormInput = z.infer<typeof bannerSchema>;
