"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./locale-provider";
import { getLastMousePosition } from "@/lib/pointer-position";

const LENS_SIZE = 176;
const ZOOM_SCALE = 2.5;

export function ProductImageMagnifier({ src, alt }: { src: string; alt: string }) {
  const { tr } = useI18n();
  const imageRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    // Navigation can put the existing cursor over this image without firing
    // mouseenter. Check its last position once the new layout is painted.
    const frame = requestAnimationFrame(() => {
      const pointer = getLastMousePosition();
      const bounds = imageRef.current?.getBoundingClientRect();
      if (!pointer || !bounds) return;
      const inside = pointer.x >= bounds.left && pointer.x <= bounds.right
        && pointer.y >= bounds.top && pointer.y <= bounds.bottom;
      if (inside) {
        setPosition({ x: pointer.x - bounds.left, y: pointer.y - bounds.top, width: bounds.width, height: bounds.height });
        setIsHovering(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [src]);

  function updatePosition(e: React.MouseEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }

  return (
    <div
      ref={imageRef}
      aria-label={`${alt}. ${tr("Hover over the image to inspect details.")}`}
      onMouseEnter={(e) => {
        updatePosition(e);
        setIsHovering(true);
      }}
      onMouseMove={updatePosition}
      onMouseLeave={() => setIsHovering(false)}
      className="relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl border bg-muted"
    >
      <Image src={src} alt={alt} fill priority className="object-cover" />
      {isHovering && (
        <div
          aria-hidden="true"
          data-testid="product-zoom-lens"
          className="pointer-events-none absolute size-44 rounded-full border-2 border-background bg-muted shadow-xl"
          style={{
            left: position.x,
            top: position.y,
            transform: "translate(-50%, -50%)",
            backgroundImage: `url(${JSON.stringify(src)})`,
            backgroundPosition: `${-(position.x * ZOOM_SCALE - LENS_SIZE / 2)}px ${-(position.y * ZOOM_SCALE - LENS_SIZE / 2)}px`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${position.width * ZOOM_SCALE}px ${position.height * ZOOM_SCALE}px`,
          }}
        />
      )}
    </div>
  );
}
