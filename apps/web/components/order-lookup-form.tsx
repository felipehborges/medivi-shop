"use client";

import { LocalizedText } from "@/components/localized-text";


import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@/components/translated-input";
import { Label } from "@medivi/ui/components/ui/label";
import { orderLookupSchema, type OrderLookupInput } from "@/lib/schemas/order-lookup";
import { lookupGuestOrderAction } from "@/lib/actions/order-lookup";

export function OrderLookupForm() {
  const router = useRouter();
  const [notFoundError, setNotFoundError] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderLookupInput>({ resolver: zodResolver(orderLookupSchema) });

  async function onSubmit(values: OrderLookupInput) {
    setNotFoundError(false);
    const result = await lookupGuestOrderAction(values);
    if (!result.ok) {
      setNotFoundError(true);
      return;
    }
    router.push(`/order/confirmation/${result.orderId}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="orderNumber"><LocalizedText text={"Order number"} /></Label>
        <Input
          id="orderNumber"
          placeholder="MDV-20260726-XXXXXXXX"
          aria-invalid={!!errors.orderNumber}
          aria-describedby={errors.orderNumber ? "orderNumber-error" : undefined}
          {...register("orderNumber")}
        />
        {errors.orderNumber && (
          <p id="orderNumber-error" role="alert" className="text-sm text-destructive">
            {errors.orderNumber.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email"><LocalizedText text={"Email"} /></Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {notFoundError && (
        <p role="alert" className="text-sm text-destructive">
          <LocalizedText text={"We couldn't find an order matching that number and email. "} /></p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        <LocalizedText text={"Find my order "} /></Button>
    </form>
  );
}
