"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "./locale-provider";
import { ProductImageMagnifier } from "./product-image-magnifier";

export function ProductImageGallery({ src, alt }: { src: string; alt: string }) {
  const { tr } = useI18n();
  const [selected, setSelected] = useState(0);
  const photos = [src, src, src];

  return (
    <div>
      <ProductImageMagnifier src={photos[selected] ?? src} alt={`${alt} — ${tr("Photo")} ${selected + 1}`} />
      <div role="group" aria-label={tr("Product images")} className="mt-4 flex gap-3">
        {photos.map((photo, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={selected === index}
            aria-label={`${tr("Show image")} ${index + 1} ${tr("of")} ${photos.length}`}
            onClick={() => setSelected(index)}
            className={`relative size-20 shrink-0 overflow-hidden rounded-xl border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected === index ? "border-primary" : "border-border hover:border-primary/60"}`}
          >
            <Image src={photo} alt="" fill sizes="80px" className="object-cover" />
            <span className="absolute bottom-1 right-1 rounded bg-background/85 px-1.5 text-xs font-semibold">{index + 1}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tr("Photos repeat in this demo; the zoom works on every selection.")}</p>
    </div>
  );
}
