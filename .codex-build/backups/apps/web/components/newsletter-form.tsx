"use client";

import { useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";

export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) {
    return <p className="text-sm text-muted-foreground">Thanks — you&apos;re on the list.</p>;
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setSubscribed(true);
      }}
    >
      <Input
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        className="max-w-56"
      />
      <Button type="submit" variant="secondary">
        Subscribe
      </Button>
    </form>
  );
}
