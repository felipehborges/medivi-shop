import { and, asc, eq, isNull, lte, or, gte, type SQL } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { banner, type BannerPlacement } from "../schema";

export type ActiveBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: string | null;
};

/** Active banners for a placement, within their scheduled date range (unscheduled bounds mean "always"). */
export async function listActiveBanners(db: DbClient, placement: BannerPlacement): Promise<ActiveBanner[]> {
  const now = new Date();
  const conditions: SQL[] = [
    eq(banner.placement, placement),
    eq(banner.isActive, true),
    or(isNull(banner.startsAt), lte(banner.startsAt, now))!,
    or(isNull(banner.endsAt), gte(banner.endsAt, now))!,
  ];

  const rows = await db
    .select({
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
    })
    .from(banner)
    .where(and(...conditions))
    .orderBy(asc(banner.sortOrder), asc(banner.createdAt));

  return rows;
}
