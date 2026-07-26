"use client";

import { useEffect, useRef } from "react";

/**
 * Fires once the confirmation page renders a `paid`/`fulfilled` order — not
 * from the webhook, since that boundary has no cookies to attach a session
 * id to (see docs/architecture.md §4 on the webhook/redirect split). Purchase
 * completion events are commonly fired from the client-rendered "thank you"
 * page for exactly this reason.
 */
export function CheckoutCompletedBeacon({ orderId }: { orderId: string }) {
  // A ref guard, not just the effect dependency array — React Strict Mode's
  // dev-only mount→cleanup→mount would otherwise double-fire this exact
  // effect, over-counting a "fire once" purchase event.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout_completed", path: `/order/confirmation/${orderId}` }),
      keepalive: true,
    }).catch(() => {});
  }, [orderId]);

  return null;
}
