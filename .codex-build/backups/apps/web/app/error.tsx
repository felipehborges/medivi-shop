"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import { captureException } from "@/lib/monitoring";

/**
 * Catches errors from routes outside every route group (`/` and
 * `/orders/lookup`) — `(storefront)`/`(account)`/`(admin)` each have their
 * own `error.tsx`, but a route group doesn't cover pages that sit outside it.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        We hit a snag loading this page. Give it another try, or head back to the shop.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
