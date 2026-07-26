"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import type { AdminProductImage } from "@medivi/db/queries";
import { deleteProductImageAction, uploadProductImageAction } from "@/lib/actions/admin-products";

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
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("productId", productId);
    const result = await uploadProductImageAction(formData);
    setPending(false);

    if (!result.ok) {
      setError(
        result.reason === "too_large"
          ? "Image must be 5MB or smaller."
          : result.reason === "invalid_type"
            ? "Use PNG, JPEG, WebP, or AVIF."
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
      <h2 className="font-display text-xl">Images</h2>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="flex flex-col gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                <Image src={image.url} alt={image.altText} fill className="object-cover" unoptimized />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => onDelete(image.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="file">Image file</Label>
          <Input id="file" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="altText">Alt text</Label>
          <Input id="altText" name="altText" required />
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
