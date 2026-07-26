"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** `/checkout` is the one route that also marks a named funnel milestone, not just a generic page view. */
function eventTypeForPath(pathname: string): "page_view" | "checkout_started" {
  return pathname === "/checkout" ? "checkout_started" : "page_view";
}

/**
 * Fires on every client-side navigation. A Server Component can't set the
 * analytics session cookie during render (Next only allows cookie writes
 * from Server Actions/Route Handlers), so this beacons to a Route Handler
 * instead — same pattern a real third-party analytics snippet would use.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: eventTypeForPath(pathname), path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
