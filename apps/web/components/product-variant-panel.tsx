"use client";

import { useState, useTransition } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "@medivi/ui/lib/utils";
import { Button } from "@medivi/ui/components/ui/button";
import type { ProductVariantDetail } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { addToCartAction } from "@/lib/actions/cart";
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
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  if (!selected) return null;

  const selectedVariantId = selected.id;
  const selectedStock = selected.stock;

  function selectVariant(variantId: string) {
    setSelectedId(variantId);
    setQuantity(1);
    setFeedback(null);
  }

  function handleAddToCart() {
    setFeedback(null);
    startTransition(async () => {
      const result = await addToCartAction({ variantId: selectedVariantId, quantity });
      if (result.ok) {
        setFeedback({ type: "success", message: "Added to cart." });
      } else if (result.reason === "out_of_stock") {
        setFeedback({ type: "error", message: "Sorry, that's out of stock." });
      } else {
        setFeedback({ type: "error", message: `Only ${result.available} left in stock.` });
      }
    });
  }

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
                onClick={() => selectVariant(variant.id)}
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

      {selected.stock > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <MinusIcon className="size-4" />
            </Button>
            <span className="w-6 text-center" aria-live="polite">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity((q) => Math.min(selectedStock, q + 1))}
              disabled={quantity >= selectedStock}
              aria-label="Increase quantity"
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
          <Button type="button" onClick={handleAddToCart} disabled={isPending} className="flex-1">
            {isPending ? "Adding…" : "Add to Cart"}
          </Button>
        </div>
      )}

      {feedback && (
        <p
          role="alert"
          className={cn("text-sm", feedback.type === "error" ? "text-destructive" : "text-muted-foreground")}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
