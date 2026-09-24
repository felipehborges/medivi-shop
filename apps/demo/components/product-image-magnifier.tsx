"use client";

import { ProductFrame } from "./armory";
import { useEffect, useRef, useState } from "react";
import { getLastMousePosition } from "@/lib/pointer-position";

const LENS_SIZE = 176;
const ZOOM_SCALE = 2.5;

type Lens = {
  left: number;
  top: number;
  width: number;
  height: number;
  x: number;
  y: number;
};
function locateLens(
  root: HTMLDivElement | null,
  clientX: number,
  clientY: number,
): Lens | null {
  const photo = root?.querySelector(".product-photo");
  const image = photo?.querySelector("img");
  if (!root || !photo || !image?.naturalWidth) return null;
  const bounds = photo.getBoundingClientRect();
  const outer = root.getBoundingClientRect();
  const x = clientX - bounds.left;
  const y = clientY - bounds.top;
  if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return null;
  // Match object-fit:cover, including its centered crop and the frame padding.
  const scale = Math.max(
    bounds.width / image.naturalWidth,
    bounds.height / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  return {
    left: clientX - outer.left,
    top: clientY - outer.top,
    width: width * ZOOM_SCALE,
    height: height * ZOOM_SCALE,
    x: -((x + (width - bounds.width) / 2) * ZOOM_SCALE - LENS_SIZE / 2),
    y: -((y + (height - bounds.height) / 2) * ZOOM_SCALE - LENS_SIZE / 2),
  };
}

export function ProductImageMagnifier({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const imageRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<Lens | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const pointer = getLastMousePosition();
      if (pointer && matchMedia("(hover:hover)").matches)
        setLens(locateLens(imageRef.current, pointer.x, pointer.y));
    });
    return () => cancelAnimationFrame(frame);
  }, [src]);
  return (
    <div
      ref={imageRef}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse")
          setLens(locateLens(imageRef.current, event.clientX, event.clientY));
      }}
      onPointerLeave={() => setLens(null)}
      className="relative cursor-zoom-in overflow-hidden"
    >
      <ProductFrame src={src} alt={alt} variant="detail" priority />
      {lens && (
        <div
          aria-hidden="true"
          data-testid="product-zoom-lens"
          className="pointer-events-none absolute z-10 size-44 border-2 border-ring bg-muted shadow-xl"
          style={{
            left: lens.left,
            top: lens.top,
            transform: "translate(-50%, -50%)",
            backgroundImage: `url(${JSON.stringify(src)})`,
            backgroundPosition: `${lens.x}px ${lens.y}px`,
            backgroundSize: `${lens.width}px ${lens.height}px`,
            backgroundRepeat: "no-repeat",
            filter:
              "sepia(.4) saturate(1.3) hue-rotate(-12deg) contrast(1.07) brightness(.93)",
          }}
        />
      )}
    </div>
  );
}
