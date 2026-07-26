import Image from "next/image";
import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import type { ActiveBanner } from "@medivi/db/queries";

export function PromoSections({ banners }: { banners: ActiveBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <section aria-label="Promotions" className="grid gap-4 sm:grid-cols-2">
      {banners.map((banner) => (
        <div key={banner.id} className="relative isolate overflow-hidden rounded-xl bg-muted">
          <div className="relative aspect-[16/9] w-full">
            <Image src={banner.imageUrl} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 p-5">
              <h3 className="font-display text-xl text-white">{banner.title}</h3>
              {banner.subtitle && <p className="text-sm text-white/90">{banner.subtitle}</p>}
              {banner.ctaLabel && banner.ctaHref && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={banner.ctaHref}>{banner.ctaLabel}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
