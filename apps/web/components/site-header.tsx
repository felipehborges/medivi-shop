import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import { ThemeToggle } from "@medivi/ui/components/theme-toggle";
import { listCategoryTree } from "@medivi/db/queries";
import { db } from "@medivi/db/client";
import { getSession } from "@/lib/auth-guards";
import { UserMenu } from "./user-menu";
import { CategoryNav } from "./category-nav";
import { SearchBar } from "./search-bar";

export async function SiteHeader() {
  const [session, categories] = await Promise.all([
    getSession(),
    listCategoryTree(db),
  ]);

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-lg font-semibold">
          Medivi Shop
        </Link>

        <div className="hidden flex-1 justify-center px-8 sm:flex">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <UserMenu
              name={session.user.name}
              isAdmin={session.user.role === "admin"}
            />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-2">
        <CategoryNav categories={categories} />
      </div>
    </header>
  );
}
