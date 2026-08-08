import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import { formatPriceCents } from "@/lib/format";

export function CartSummary({ subtotalCents }: { subtotalCents: number }) {
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">Subtotal</span>
        <span className="font-display text-lg">{formatPriceCents(subtotalCents)}</span>
      </div>
      <Button asChild size="lg">
        <Link href="/checkout">Proceed to checkout</Link>
      </Button>
    </div>
  );
}
