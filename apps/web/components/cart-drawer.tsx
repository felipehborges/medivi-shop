"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";

import { Button } from "@medivi/ui/components/ui/button";
import { Badge } from "@medivi/ui/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@medivi/ui/components/ui/sheet";
import type { CartDetail } from "@medivi/db/queries";
import { CartLineItem } from "./cart-line-item";
import { CartSummary } from "./cart-summary";
import { EmptyState } from "./empty-state";

export function CartDrawer({ cart }: { cart: CartDetail }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Cart, ${cart.itemCount} items`} className="relative">
          <ShoppingBagIcon className="size-4" />
          {cart.itemCount > 0 && (
            <Badge className="absolute top-0.5 right-0.5 size-4 justify-center rounded-full p-0 text-[10px]">
              {cart.itemCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {cart.items.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              description="Add something from the catalog to get started."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {cart.items.map((item) => (
                <CartLineItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
        {cart.items.length > 0 && (
          <SheetFooter>
            <CartSummary subtotalCents={cart.subtotalCents} />
            <Button asChild>
              <Link href="/cart">View cart</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
