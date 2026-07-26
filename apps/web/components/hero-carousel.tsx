"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@medivi/ui/components/ui/button";
import type { ActiveBanner } from "@medivi/db/queries";

const ROTATE_INTERVAL_MS = 6000;

export function HeroCarousel({ banners }: { banners: ActiveBanner[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const current = banners[index]!;

  return (
    <section
      aria-label="Featured promotions"
      className="relative isolate overflow-hidden rounded-xl bg-muted"
    >
      <div className="relative aspect-[16/7] w-full min-h-64">
        <Image
          key={current.id}
          src={current.imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-6 sm:p-10">
          <h1 className="font-display max-w-xl text-3xl text-white sm:text-4xl">{current.title}</h1>
          {current.subtitle && <p className="max-w-lg text-white/90">{current.subtitle}</p>}
          {current.ctaLabel && current.ctaHref && (
            <Button asChild>
              <Link href={current.ctaHref}>{current.ctaLabel}</Link>
            </Button>
          )}
        </div>
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous promotion"
            onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next promotion"
            onClick={() => setIndex((i) => (i + 1) % banners.length)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Go to promotion ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`size-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
