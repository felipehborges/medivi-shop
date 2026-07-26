"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@medivi/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@medivi/ui/components/ui/dropdown-menu";
import type { CategoryNavNode } from "@medivi/db/queries";

export function CategoryNav({ categories }: { categories: CategoryNavNode[] }) {
  return (
    <nav
      aria-label="Product categories"
      className="flex flex-wrap items-center gap-1 overflow-x-auto"
    >
      {categories.map((cat) =>
        cat.children.length > 0 ? (
          <DropdownMenu key={cat.id}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {cat.name}
                <ChevronDownIcon className="size-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href={`/catalog/${cat.slug}`}>All {cat.name}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {cat.children.map((child) => (
                <DropdownMenuItem key={child.id} asChild>
                  <Link href={`/catalog/${child.slug}`}>{child.name}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button key={cat.id} variant="ghost" size="sm" asChild>
            <Link href={`/catalog/${cat.slug}`}>{cat.name}</Link>
          </Button>
        ),
      )}
    </nav>
  );
}
