"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/translated-input";
import { Button } from "@medivi/ui/components/ui/button";
import { useLocale } from "./locale-provider";

const DEBOUNCE_MS = 400;

/**
 * A real `<form method="GET" action="/search">` — search works via a plain
 * navigation with JS disabled. With JS available, typing debounces into an
 * automatic navigation instead of waiting for submit (see
 * docs/architecture.md §7).
 */
export function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const { tr } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function navigate(q: string) {
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(value);
  }

  return (
    <form role="search" method="GET" action="/search" onSubmit={handleSubmit} className="relative w-full max-w-sm">
      <Input
        type="search"
        name="q"
        value={value}
        onChange={handleChange}
        placeholder={tr("Search the shop…")}
        aria-label={tr("Search products")}
        className="pr-9"
      />
      <Button
        type="submit"
        size="icon-sm"
        variant="ghost"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        aria-label={tr("Search")}
      >
        <SearchIcon className="size-4" />
      </Button>
    </form>
  );
}
