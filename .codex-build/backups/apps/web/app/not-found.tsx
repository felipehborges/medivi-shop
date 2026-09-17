import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <h1 className="font-display text-4xl">Lost in the wilds</h1>
      <p className="max-w-md text-muted-foreground">
        This page doesn&apos;t exist — the road ends here. Head back to the catalog to keep browsing.
      </p>
      <Button asChild>
        <Link href="/catalog">Back to the catalog</Link>
      </Button>
    </div>
  );
}
