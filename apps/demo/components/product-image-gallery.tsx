"use client";
import Image from "next/image";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@medivi/ui/components/ui/dialog";
import { ProductImageMagnifier } from "./product-image-magnifier";
import { useI18n } from "./locale-provider";
export function ProductImageGallery({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const { locale } = useI18n();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="gallery-zoom"
          aria-label={`${locale === "pt-BR" ? "Ampliar" : "Enlarge"} ${alt}`}
        >
          <ProductImageMagnifier src={src} alt={alt} />
        </button>
      </DialogTrigger>
      <DialogContent
        className="zoom-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle>{alt}</DialogTitle>
        <Image src={src} alt={alt} width={1200} height={1200} />
        <DialogClose asChild>
          <button className="forged forged-small zoom-close">
            {locale === "pt-BR" ? "Fechar" : "Close"} ×
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
