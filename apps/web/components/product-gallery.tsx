"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "@medivi/ui/lib/utils";
import type { ProductImageDetail } from "@medivi/db/queries";

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImageDetail[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const active = images[index];

  useEffect(() => {
    if (!zoomed) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomed(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomed]);

  function showPrevious() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }

  function showNext() {
    setIndex((i) => (i + 1) % images.length);
  }

  function handleGalleryKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") showPrevious();
    if (e.key === "ArrowRight") showNext();
  }

  if (!active) {
    return <div className="aspect-square w-full rounded-xl bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-roledescription="image gallery"
        aria-label={`${productName} images`}
        tabIndex={0}
        onKeyDown={handleGalleryKeyDown}
        className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`Zoom in on ${active.altText}`}
          className="relative block h-full w-full cursor-zoom-in"
        >
          <Image
            src={active.url}
            alt={active.altText}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </button>
      </div>

      {images.length > 1 && (
        <div role="tablist" aria-label="Product images" className="flex gap-2 overflow-x-auto">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md ring-2 transition-shadow",
                i === index ? "ring-primary" : "ring-transparent",
              )}
            >
              <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} zoomed image`}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
        >
          <Image
            src={active.url}
            alt={active.altText}
            width={1200}
            height={1200}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
