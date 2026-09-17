"use client";

import { LocalizedText } from "@/components/localized-text";


import { useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@/components/translated-input";

export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false);

  if (subscribed) {
    return <p className="text-sm text-muted-foreground"><LocalizedText text={"Thanks — you're on the list."} /></p>;
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
        <LocalizedText text={"Subscribe "} /></Button>
    </form>
  );
}
