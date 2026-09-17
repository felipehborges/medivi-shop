import type { OrderDetail } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";

export function OrderDetailCard({ order }: { order: OrderDetail }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Order number</span>
        <span className="font-medium">{order.orderNumber}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Status</span>
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
          <span>Subtotal</span>
          <span>{formatPriceCents(order.subtotalCents, order.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{formatPriceCents(order.shippingCents, order.currency)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="font-display text-lg">{formatPriceCents(order.totalCents, order.currency)}</span>
        </div>
      </div>

      <div className="border-t pt-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Shipping to</p>
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
