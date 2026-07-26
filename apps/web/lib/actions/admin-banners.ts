"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { createBannerAdmin, deleteBannerAdmin, updateBannerAdmin, type BannerInput } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { bannerSchema } from "@/lib/schemas/banner";

function toBannerInput(parsed: z.infer<typeof bannerSchema>): BannerInput {
  return {
    title: parsed.title,
    subtitle: parsed.subtitle || null,
    imageUrl: parsed.imageUrl,
    ctaLabel: parsed.ctaLabel || null,
    ctaHref: parsed.ctaHref || null,
    placement: parsed.placement,
    isActive: parsed.isActive ?? true,
    startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
    endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    sortOrder: parsed.sortOrder ?? 0,
  };
}

export async function createBannerAction(input: z.infer<typeof bannerSchema>) {
  const admin = await requireAdmin();
  const parsed = bannerSchema.parse(input);
  await createBannerAdmin(db, admin.id, toBannerInput(parsed));
  revalidatePath("/admin/banners");
}

const updateBannerSchema = bannerSchema.extend({ id: z.string().uuid() });

export async function updateBannerAction(input: z.infer<typeof updateBannerSchema>) {
  const admin = await requireAdmin();
  const { id, ...rest } = updateBannerSchema.parse(input);
  const parsed = bannerSchema.parse(rest);
  await updateBannerAdmin(db, admin.id, id, toBannerInput(parsed));
  revalidatePath("/admin/banners");
}

const deleteBannerSchema = z.object({ id: z.string().uuid() });

export async function deleteBannerAction(input: z.infer<typeof deleteBannerSchema>) {
  const admin = await requireAdmin();
  const { id } = deleteBannerSchema.parse(input);
  await deleteBannerAdmin(db, admin.id, id);
  revalidatePath("/admin/banners");
}
