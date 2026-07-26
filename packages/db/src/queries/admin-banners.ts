import { asc, eq } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { auditLog, banner, type BannerPlacement } from "../schema";

export type AdminBanner = typeof banner.$inferSelect;

export async function listBannersAdmin(db: DbClient): Promise<AdminBanner[]> {
  return db.select().from(banner).orderBy(asc(banner.sortOrder), asc(banner.createdAt));
}

export type BannerInput = {
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  placement: BannerPlacement;
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  sortOrder: number;
};

export async function createBannerAdmin(db: DbClient, actorId: string, input: BannerInput): Promise<AdminBanner> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(banner).values(input).returning();
    if (!row) throw new Error("Failed to create banner");

    await tx.insert(auditLog).values({
      actorId,
      action: "banner.create",
      entityType: "banner",
      entityId: row.id,
      diff: { to: input },
    });
    return row;
  });
}

export async function updateBannerAdmin(
  db: DbClient,
  actorId: string,
  id: string,
  input: BannerInput,
): Promise<AdminBanner | null> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(banner).where(eq(banner.id, id)).limit(1);
    if (!before) return null;

    const [row] = await tx
      .update(banner)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(banner.id, id))
      .returning();
    await tx.insert(auditLog).values({
      actorId,
      action: "banner.update",
      entityType: "banner",
      entityId: id,
      diff: { from: before, to: input },
    });
    return row ?? null;
  });
}

export async function deleteBannerAdmin(db: DbClient, actorId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.delete(banner).where(eq(banner.id, id)).returning();
    if (!before) return;

    await tx.insert(auditLog).values({
      actorId,
      action: "banner.delete",
      entityType: "banner",
      entityId: id,
      diff: { from: before },
    });
  });
}
