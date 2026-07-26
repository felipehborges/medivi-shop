"use client";

import { useState } from "react";

import { cn } from "@medivi/ui/lib/utils";
import type { ProductVariantDetail } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { StockBadge } from "./stock-badge";

function variantLabel(variant: ProductVariantDetail): string {
  return variant.attributes?.size ?? variant.name;
}

export function ProductVariantPanel({
  variants,
  currency,
}: {
  variants: ProductVariantDetail[];
  currency: string;
}) {
  const firstInStock = variants.find((v) => v.stock > 0);
  const [selectedId, setSelectedId] = useState((firstInStock ?? variants[0])?.id);
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-4">
      <span className="font-display text-2xl">{formatPriceCents(selected.priceCents, currency)}</span>

      {variants.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            {variants[0]?.attributes?.size ? "Size" : "Variant"}
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                disabled={variant.stock === 0}
                aria-pressed={variant.id === selected.id}
                onClick={() => setSelectedId(variant.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  variant.id === selected.id
                    ? "border-primary bg-primary/10"
                    : "border-input hover:bg-muted",
                  variant.stock === 0 && "cursor-not-allowed line-through opacity-40",
                )}
              >
                {variantLabel(variant)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <StockBadge stock={selected.stock} />
    </div>
  );
}
