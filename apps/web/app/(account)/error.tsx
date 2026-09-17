"use client";

import { LocalizedText } from "@/components/localized-text";


import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import { captureException } from "@/lib/monitoring";

export default function AccountError({
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
      <h1 className="font-display text-3xl"><LocalizedText text={"Something went wrong"} /></h1>
      <p className="max-w-md text-muted-foreground">
        <LocalizedText text={"We hit a snag loading your account. Give it another try, or head back to the shop. "} /></p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}><LocalizedText text={"Try again"} /></Button>
        <Button variant="outline" asChild>
          <Link href="/"><LocalizedText text={"Back home"} /></Link>
        </Button>
      </div>
    </div>
  );
}
