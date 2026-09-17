"use client";

import { LocalizedText } from "@/components/localized-text";


import { useTransition } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { approveMockPayment, declineMockPayment } from "@/lib/actions/mock-checkout";

export function MockCheckoutActions({
  orderId,
  successPath,
  cancelPath,
}: {
  orderId: string;
  successPath: string;
  cancelPath: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => declineMockPayment({ orderId, redirectPath: cancelPath }))}
      >
        <LocalizedText text={"Decline "} /></Button>
      <Button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => approveMockPayment({ orderId, redirectPath: successPath }))}
      >
        <LocalizedText text={"Approve payment "} /></Button>
    </div>
  );
}
