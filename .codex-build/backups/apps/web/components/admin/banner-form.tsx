"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import type { AdminBanner } from "@medivi/db/queries";
import { bannerSchema, type BannerFormInput } from "@/lib/schemas/banner";
import { createBannerAction, updateBannerAction } from "@/lib/actions/admin-banners";

function toDateTimeLocal(value: Date | null): string | undefined {
  if (!value) return undefined;
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function BannerForm({ banner, onDone }: { banner?: AdminBanner; onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BannerFormInput>({
    resolver: zodResolver(bannerSchema),
    defaultValues: banner
      ? {
          title: banner.title,
          subtitle: banner.subtitle ?? undefined,
          imageUrl: banner.imageUrl,
          ctaLabel: banner.ctaLabel ?? undefined,
          ctaHref: banner.ctaHref ?? undefined,
          placement: banner.placement,
          isActive: banner.isActive,
          startsAt: toDateTimeLocal(banner.startsAt),
          endsAt: toDateTimeLocal(banner.endsAt),
          sortOrder: banner.sortOrder,
        }
      : { placement: "hero", isActive: true, sortOrder: 0 },
  });

  async function onSubmit(values: BannerFormInput) {
    if (banner) {
      await updateBannerAction({ id: banner.id, ...values });
    } else {
      await createBannerAction(values);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-title">Title</Label>
          <Input id="banner-title" aria-invalid={!!errors.title} {...register("title")} />
          {errors.title && (
            <p role="alert" className="text-sm text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-subtitle">Subtitle</Label>
          <Input id="banner-subtitle" {...register("subtitle")} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="banner-imageUrl">Image URL</Label>
        <Input id="banner-imageUrl" aria-invalid={!!errors.imageUrl} {...register("imageUrl")} />
        {errors.imageUrl && (
          <p role="alert" className="text-sm text-destructive">
            {errors.imageUrl.message}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-ctaLabel">CTA label</Label>
          <Input id="banner-ctaLabel" {...register("ctaLabel")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-ctaHref">CTA link</Label>
          <Input id="banner-ctaHref" {...register("ctaHref")} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-placement">Placement</Label>
          <select
            id="banner-placement"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none dark:bg-input/30"
            {...register("placement")}
          >
            <option value="hero">Hero</option>
            <option value="category">Category</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-sortOrder">Sort order</Label>
          <Input id="banner-sortOrder" type="number" {...register("sortOrder", { valueAsNumber: true })} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" {...register("isActive")} />
          Active
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-startsAt">Starts at</Label>
          <Input id="banner-startsAt" type="datetime-local" {...register("startsAt")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="banner-endsAt">Ends at</Label>
          <Input id="banner-endsAt" type="datetime-local" {...register("endsAt")} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {banner ? "Save changes" : "Add banner"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
