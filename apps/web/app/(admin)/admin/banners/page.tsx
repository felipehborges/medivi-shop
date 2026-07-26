import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listBannersAdmin } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { BannerManager } from "@/components/admin/banner-manager";

export const metadata: Metadata = { title: "Banners — Admin — Medivi Shop" };

export default async function AdminBannersPage() {
  await requireAdmin();
  const banners = await listBannersAdmin(db);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Banners</h1>
      <BannerManager banners={banners} />
    </div>
  );
}
