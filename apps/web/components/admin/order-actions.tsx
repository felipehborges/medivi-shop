"use client";

import { LocalizedText } from "@/components/localized-text";


import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import type { OrderStatus } from "@medivi/db/schema";
import { fulfillOrderAction, refundOrderAction } from "@/lib/actions/orders";

export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFulfill() {
    setError(null);
    setPending(true);
    const result = await fulfillOrderAction({ orderId });
    setPending(false);
    if (!result.ok) {
      setError("Order is no longer in a fulfillable state.");
      return;
    }
    router.refresh();
  }

  async function onRefund() {
    setError(null);
    setPending(true);
    const result = await refundOrderAction({ orderId });
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Refund failed.");
      return;
    }
    router.refresh();
  }

  if (status !== "paid" && status !== "fulfilled") return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {status === "paid" && (
          <Button type="button" size="sm" disabled={pending} onClick={onFulfill}>
            <LocalizedText text={"Mark fulfilled "} /></Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRefund}>
          <LocalizedText text={"Refund "} /></Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
