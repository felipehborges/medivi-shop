"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@medivi/ui/lib/utils";
import type { ProductImageDetail } from "@medivi/db/queries";

const LENS_SIZE = 176;
const ZOOM_SCALE = 2.5;

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImageDetail[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const active = images[index];

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

  function updateZoomPosition(e: React.MouseEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    setZoomPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }

  if (!active) {
    return <div className="aspect-square w-full rounded-xl bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-roledescription="image gallery"
        aria-label={`${productName} images. Hover over the image to inspect details.`}
        tabIndex={0}
        onKeyDown={handleGalleryKeyDown}
        onMouseEnter={(e) => {
          updateZoomPosition(e);
          setIsHoveringImage(true);
        }}
        onMouseMove={updateZoomPosition}
        onMouseLeave={() => {
          setIsHoveringImage(false);
          setZoomPosition({ x: 0, y: 0, width: 0, height: 0 });
        }}
        className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image
          src={active.url}
          alt={active.altText}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
        {isHoveringImage && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute size-44 rounded-full border-2 border-background bg-muted shadow-xl"
            style={{
              left: zoomPosition.x,
              top: zoomPosition.y,
              transform: "translate(-50%, -50%)",
              backgroundImage: `url(${JSON.stringify(active.url)})`,
              backgroundPosition: `${-(zoomPosition.x * ZOOM_SCALE - LENS_SIZE / 2)}px ${-(zoomPosition.y * ZOOM_SCALE - LENS_SIZE / 2)}px`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${zoomPosition.width * ZOOM_SCALE}px ${zoomPosition.height * ZOOM_SCALE}px`,
            }}
          />
        )}
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
    </div>
  );
}
