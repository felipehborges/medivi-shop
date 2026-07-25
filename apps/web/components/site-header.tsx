import Link from "next/link";

import { Button } from "@medivi/ui/components/ui/button";
import { ThemeToggle } from "@medivi/ui/components/theme-toggle";
import { getSession } from "@/lib/auth-guards";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-lg font-semibold">
          Medivi Shop
        </Link>

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
    </header>
  );
}
