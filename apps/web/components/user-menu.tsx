"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserIcon } from "lucide-react";

import { Button } from "@medivi/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@medivi/ui/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

export function UserMenu({
  name,
  isAdmin,
}: {
  name: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    // Unlike sign-in-form.tsx's push("/account"), "/" is always linked from
    // the header logo, so Next has likely already prefetched it — while
    // still signed in. push() alone would reuse that stale, signed-in
    // prefetch. refresh() must come after the push completes, so it
    // revalidates "/" as the now-current route instead of racing it.
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <UserIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">Account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders">Order history</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wishlist">Wishlist</Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">Admin dashboard</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
