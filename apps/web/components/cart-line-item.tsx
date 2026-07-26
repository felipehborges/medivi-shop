"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@medivi/ui/components/ui/button";
import type { CartItemDetail } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { removeCartItemAction, updateCartItemAction } from "@/lib/actions/cart";

function variantLabel(item: CartItemDetail): string {
  return item.variantAttributes?.size ? `Size: ${item.variantAttributes.size}` : item.variantName;
}

export function CartLineItem({ item }: { item: CartItemDetail }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeQuantity(next: number) {
    if (next < 1) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCartItemAction({ itemId: item.id, quantity: next });
      if (!result.ok) setError(`Only ${result.available} left in stock.`);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeCartItemAction({ itemId: item.id });
    });
  }

  return (
    <div className="flex gap-3">
      <Link
        href={`/product/${item.productSlug}`}
        className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {item.imageUrl && (
          <Image src={item.imageUrl} alt={item.productName} fill sizes="64px" className="object-cover" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/product/${item.productSlug}`} className="font-medium hover:underline">
              {item.productName}
            </Link>
            <p className="text-sm text-muted-foreground">{variantLabel(item)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            disabled={isPending}
            aria-label={`Remove ${item.productName} from cart`}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => changeQuantity(item.quantity - 1)}
              disabled={isPending || item.quantity <= 1}
              aria-label="Decrease quantity"
            >
              <MinusIcon className="size-3" />
            </Button>
            <span className="w-6 text-center text-sm" aria-live="polite">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => changeQuantity(item.quantity + 1)}
              disabled={isPending || item.quantity >= item.currentStock}
              aria-label="Increase quantity"
            >
              <PlusIcon className="size-3" />
            </Button>
          </div>
          <span className="font-medium">{formatPriceCents(item.lineTotalCents)}</span>
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
