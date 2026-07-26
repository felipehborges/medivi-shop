import { Button, Hr, Text } from "@react-email/components";

import { EmailLayout } from "./layout";

export type OrderConfirmationEmailItem = {
  nameSnapshot: string;
  variantLabelSnapshot: string | null;
  quantity: number;
  lineTotalCents: number;
};

export type OrderConfirmationEmailProps = {
  orderNumber: string;
  items: OrderConfirmationEmailItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  orderUrl: string;
};

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function OrderConfirmationEmail({
  orderNumber,
  items,
  subtotalCents,
  shippingCents,
  totalCents,
  currency,
  orderUrl,
}: OrderConfirmationEmailProps) {
  return (
    <EmailLayout preview={`Order ${orderNumber} confirmed — thanks for your purchase!`}>
      <Text style={{ fontSize: 16 }}>Thank you for your order!</Text>
      <Text style={{ color: "#4a4a4a" }}>
        Order <strong>{orderNumber}</strong> has been confirmed.
      </Text>
      <Hr />
      {items.map((item, i) => (
        <Text key={i} style={{ margin: "4px 0" }}>
          {item.nameSnapshot}
          {item.variantLabelSnapshot ? ` — ${item.variantLabelSnapshot}` : ""} × {item.quantity} —{" "}
          {formatCents(item.lineTotalCents, currency)}
        </Text>
      ))}
      <Hr />
      <Text style={{ margin: "4px 0" }}>Subtotal: {formatCents(subtotalCents, currency)}</Text>
      <Text style={{ margin: "4px 0" }}>Shipping: {formatCents(shippingCents, currency)}</Text>
      <Text style={{ margin: "4px 0", fontWeight: "bold" }}>Total: {formatCents(totalCents, currency)}</Text>
      <Button
        href={orderUrl}
        style={{ backgroundColor: "#1a1a1a", color: "#ffffff", padding: "12px 20px", borderRadius: 6, marginTop: 16 }}
      >
        View your order
      </Button>
    </EmailLayout>
  );
}
