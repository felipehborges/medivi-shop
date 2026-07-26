"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import type { AdminBanner } from "@medivi/db/queries";
import { deleteBannerAction } from "@/lib/actions/admin-banners";
import { BannerForm } from "./banner-form";

export function BannerManager({ banners }: { banners: AdminBanner[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  async function handleDelete(id: string) {
    await deleteBannerAction({ id });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {banners.map((b) =>
        editingId === b.id ? (
          <BannerForm
            key={b.id}
            banner={b}
            onDone={() => {
              setEditingId(null);
              router.refresh();
            }}
          />
        ) : (
          <div key={b.id} className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              <p className="font-medium">
                {b.title}{" "}
                <Badge variant={b.isActive ? "default" : "secondary"} className="ml-1">
                  {b.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline" className="ml-1 capitalize">
                  {b.placement}
                </Badge>
              </p>
              {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
              <p className="text-xs text-muted-foreground">
                {b.startsAt ? b.startsAt.toLocaleDateString() : "No start"} —{" "}
                {b.endsAt ? b.endsAt.toLocaleDateString() : "No end"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(b.id)}>
                Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(b.id)}>
                Delete
              </Button>
            </div>
          </div>
        ),
      )}

      {editingId === "new" ? (
        <BannerForm
          onDone={() => {
            setEditingId(null);
            router.refresh();
          }}
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setEditingId("new")}>
          Add banner
        </Button>
      )}
    </div>
  );
}
