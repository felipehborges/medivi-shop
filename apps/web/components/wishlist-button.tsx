"use client";

import { useState, useTransition } from "react";
import { HeartIcon } from "lucide-react";

import { Button } from "@medivi/ui/components/ui/button";
import { cn } from "@medivi/ui/lib/utils";
import { toggleWishlist } from "@/lib/actions/wishlist";

export function WishlistButton({
  productId,
  initialWishlisted,
}: {
  productId: string;
  initialWishlisted: boolean;
}) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const next = !wishlisted;
    setWishlisted(next);
    startTransition(async () => {
      try {
        await toggleWishlist({ productId, action: next ? "add" : "remove" });
      } catch {
        setWishlisted(!next);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={wishlisted}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <HeartIcon className={cn("size-4", wishlisted && "fill-current text-destructive")} />
    </Button>
  );
}
