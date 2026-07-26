import { formatPriceCents } from "@/lib/format";

export function CartSummary({ subtotalCents }: { subtotalCents: number }) {
  return (
    <div className="flex items-center justify-between border-t pt-4">
      <span className="font-medium">Subtotal</span>
      <span className="font-display text-lg">{formatPriceCents(subtotalCents)}</span>
    </div>
  );
}
