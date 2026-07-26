"use client";

import { useTransition } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { approveMockPayment, declineMockPayment } from "@/lib/actions/mock-checkout";

export function MockCheckoutActions({
  orderId,
  successUrl,
  cancelUrl,
}: {
  orderId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => declineMockPayment({ orderId, redirectUrl: cancelUrl }))}
      >
        Decline
      </Button>
      <Button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => approveMockPayment({ orderId, redirectUrl: successUrl }))}
      >
        Approve payment
      </Button>
    </div>
  );
}
