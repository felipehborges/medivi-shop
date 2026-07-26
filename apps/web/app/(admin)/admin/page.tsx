import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Admin — Medivi Shop",
};

export default async function AdminOverviewPage() {
  const user = await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl">Admin Dashboard</h1>
        <p className="text-muted-foreground">Signed in as {user.name} ({user.email})</p>
      </div>
    </div>
  );
}
