"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import type { CartDetail } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas/checkout";
import { SHIPPING_METHODS } from "@/lib/shipping";
import { checkoutAction } from "@/lib/actions/checkout";

export function CheckoutForm({ cart, userEmail }: { cart: CartDetail; userEmail: string | null }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isGuest = !userEmail;

  const resolverSchema = useMemo(
    () =>
      isGuest
        ? checkoutSchema.extend({ guestEmail: z.string().email("Enter a valid email address") })
        : checkoutSchema,
    [isGuest],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(resolverSchema),
    defaultValues: { shippingMethodId: "standard" },
  });

  const shippingMethodId = watch("shippingMethodId") ?? "standard";
  const shippingCents = SHIPPING_METHODS.find((m) => m.id === shippingMethodId)?.cents ?? 0;
  const totalCents = cart.subtotalCents + shippingCents;

  async function onSubmit(values: CheckoutInput) {
    setServerError(null);
    const result = await checkoutAction(values);
    // checkoutAction redirects on success — it only returns on failure.
    if (result.reason === "empty_cart") {
      setServerError("Your cart is empty.");
    } else if (result.reason === "guest_email_required") {
      setServerError("Enter an email address to check out as a guest.");
    } else if (result.reason === "rate_limited") {
      setServerError("Too many checkout attempts — please wait a moment and try again.");
    } else if (result.reason === "stock_or_price_changed") {
      const messages = result.issues.map((issue) =>
        issue.kind === "stock"
          ? `${issue.productName}: only ${issue.available} left in stock (you have ${issue.requested} in your cart).`
          : `${issue.productName}: the price changed to ${formatPriceCents(issue.newPriceCents)}.`,
      );
      setServerError(`Your cart changed since you added these items — review before continuing:\n${messages.join("\n")}`);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        {isGuest && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="guestEmail">Email</Label>
            <Input
              id="guestEmail"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.guestEmail}
              aria-describedby={errors.guestEmail ? "guestEmail-error" : undefined}
              {...register("guestEmail")}
            />
            {errors.guestEmail && (
              <p id="guestEmail-error" role="alert" className="text-sm text-destructive">
                {errors.guestEmail.message}
              </p>
            )}
          </div>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-display text-lg">Shipping address</legend>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              aria-invalid={!!errors.shippingAddress?.fullName}
              aria-describedby={errors.shippingAddress?.fullName ? "fullName-error" : undefined}
              {...register("shippingAddress.fullName")}
            />
            {errors.shippingAddress?.fullName && (
              <p id="fullName-error" role="alert" className="text-sm text-destructive">
                {errors.shippingAddress.fullName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="line1">Street address</Label>
            <Input
              id="line1"
              autoComplete="address-line1"
              aria-invalid={!!errors.shippingAddress?.line1}
              aria-describedby={errors.shippingAddress?.line1 ? "line1-error" : undefined}
              {...register("shippingAddress.line1")}
            />
            {errors.shippingAddress?.line1 && (
              <p id="line1-error" role="alert" className="text-sm text-destructive">
                {errors.shippingAddress.line1.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="line2">Apartment, suite, etc. (optional)</Label>
            <Input id="line2" autoComplete="address-line2" {...register("shippingAddress.line2")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                autoComplete="address-level2"
                aria-invalid={!!errors.shippingAddress?.city}
                aria-describedby={errors.shippingAddress?.city ? "city-error" : undefined}
                {...register("shippingAddress.city")}
              />
              {errors.shippingAddress?.city && (
                <p id="city-error" role="alert" className="text-sm text-destructive">
                  {errors.shippingAddress.city.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="region">State / region</Label>
              <Input
                id="region"
                autoComplete="address-level1"
                aria-invalid={!!errors.shippingAddress?.region}
                aria-describedby={errors.shippingAddress?.region ? "region-error" : undefined}
                {...register("shippingAddress.region")}
              />
              {errors.shippingAddress?.region && (
                <p id="region-error" role="alert" className="text-sm text-destructive">
                  {errors.shippingAddress.region.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input
                id="postalCode"
                autoComplete="postal-code"
                aria-invalid={!!errors.shippingAddress?.postalCode}
                aria-describedby={errors.shippingAddress?.postalCode ? "postalCode-error" : undefined}
                {...register("shippingAddress.postalCode")}
              />
              {errors.shippingAddress?.postalCode && (
                <p id="postalCode-error" role="alert" className="text-sm text-destructive">
                  {errors.shippingAddress.postalCode.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                autoComplete="country-name"
                defaultValue="US"
                aria-invalid={!!errors.shippingAddress?.country}
                aria-describedby={errors.shippingAddress?.country ? "country-error" : undefined}
                {...register("shippingAddress.country")}
              />
              {errors.shippingAddress?.country && (
                <p id="country-error" role="alert" className="text-sm text-destructive">
                  {errors.shippingAddress.country.message}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-display text-lg">Shipping method</legend>
          {SHIPPING_METHODS.map((method) => (
            <label
              key={method.id}
              className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <span className="flex items-center gap-2">
                <input type="radio" value={method.id} {...register("shippingMethodId")} />
                {method.label}
              </span>
              <span>{formatPriceCents(method.cents)}</span>
            </label>
          ))}
        </fieldset>

        {serverError && (
          <p role="alert" className="whitespace-pre-line text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Placing order…" : `Pay ${formatPriceCents(totalCents)}`}
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-lg">Order summary</h2>
        <ul className="flex flex-col gap-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>{formatPriceCents(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPriceCents(cart.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{formatPriceCents(shippingCents)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span className="font-display text-lg">{formatPriceCents(totalCents)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
