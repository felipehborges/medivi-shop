import { LocalizedText } from "@/components/localized-text";
import type { OrderDetail } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";

export function OrderDetailCard({ order }: { order: OrderDetail }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground"><LocalizedText text={"Order number"} /></span>
        <span className="font-medium">{order.orderNumber}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground"><LocalizedText text={"Status"} /></span>
        <span className="font-medium capitalize">{order.status}</span>
      </div>

      <ul className="flex flex-col gap-2 border-t pt-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.nameSnapshot}
              {item.variantLabelSnapshot ? ` — ${item.variantLabelSnapshot}` : ""} × {item.quantity}
            </span>
            <span>{formatPriceCents(item.lineTotalCents, order.currency)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span><LocalizedText text={"Subtotal"} /></span>
          <span>{formatPriceCents(order.subtotalCents, order.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span><LocalizedText text={"Shipping"} /></span>
          <span>{formatPriceCents(order.shippingCents, order.currency)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span><LocalizedText text={"Total"} /></span>
          <span className="font-display text-lg">{formatPriceCents(order.totalCents, order.currency)}</span>
        </div>
      </div>

      <div className="border-t pt-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground"><LocalizedText text={"Shipping to"} /></p>
        <p>{order.shippingAddress.fullName}</p>
        <p>{order.shippingAddress.line1}</p>
        {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
        <p>
          {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
        </p>
        <p>{order.shippingAddress.country}</p>
      </div>
    </div>
  );
}
