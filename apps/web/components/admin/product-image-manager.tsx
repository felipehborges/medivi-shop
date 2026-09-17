"use client";

import { LocalizedText } from "@/components/localized-text";


import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@/components/translated-input";
import { Label } from "@medivi/ui/components/ui/label";
import type { AdminProductImage } from "@medivi/db/queries";
import { deleteProductImageAction, uploadProductImageAction } from "@/lib/actions/admin-products";

// Mirrors the server-side bounds in lib/actions/admin-products.ts — this
// check is UX only (an instant error instead of a round trip for the common
// case), the server re-validates and is the actual authority (see CLAUDE.md).
const MIN_IMAGE_DIMENSION = 200;
const MAX_IMAGE_DIMENSION = 4000;

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

export function ProductImageManager({
  productId,
  images,
}: {
  productId: string;
  images: AdminProductImage[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      try {
        const { width, height } = await readImageDimensions(file);
        if (
          width < MIN_IMAGE_DIMENSION ||
          height < MIN_IMAGE_DIMENSION ||
          width > MAX_IMAGE_DIMENSION ||
          height > MAX_IMAGE_DIMENSION
        ) {
          setError(`Image must be between ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixels.`);
          return;
        }
      } catch {
        setError("Choose a valid image file.");
        return;
      }
    }

    setPending(true);
    formData.set("productId", productId);
    const result = await uploadProductImageAction(formData);
    setPending(false);

    if (!result.ok) {
      setError(
        result.reason === "too_large"
          ? "Image must be 5MB or smaller."
          : result.reason === "invalid_type"
            ? "Use PNG, JPEG, WebP, or AVIF."
            : result.reason === "invalid_dimensions"
              ? `Image must be between ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixels.`
              : result.reason === "not_found"
                ? "Product not found."
                : "Choose an image file.",
      );
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  async function onDelete(imageId: string) {
    await deleteProductImageAction({ imageId, productId });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <h2 className="font-display text-xl"><LocalizedText text={"Images"} /></h2>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="flex flex-col gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                <Image src={image.url} alt={image.altText} fill className="object-cover" unoptimized />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => onDelete(image.id)}>
                <LocalizedText text={"Remove "} /></Button>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="file"><LocalizedText text={"Image file"} /></Label>
          <Input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="altText"><LocalizedText text={"Alt text"} /></Label>
          <Input id="altText" name="altText" placeholder="Defaults to the product name" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
