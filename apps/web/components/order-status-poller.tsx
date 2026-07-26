"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the order confirmation page briefly — the webhook can lag the redirect (see docs/architecture.md §4). */
export function OrderStatusPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 2000);
    const timeout = setTimeout(() => clearInterval(interval), 20000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);

  return null;
}
