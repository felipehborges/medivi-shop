"use client";

import { LocalizedText } from "@/components/localized-text";


import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@/components/translated-input";
import { Label } from "@medivi/ui/components/ui/label";
import type { Address } from "@medivi/db/queries";
import { addressSchema, type AddressInput } from "@/lib/schemas/address";
import { createAddressAction, updateAddressAction } from "@/lib/actions/addresses";

export function AddressForm({ address, onDone }: { address?: Address; onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? {
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2 ?? undefined,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode,
          country: address.country,
          isDefault: address.isDefault,
        }
      : { country: "US" },
  });

  async function onSubmit(values: AddressInput) {
    if (address) {
      await updateAddressAction({ id: address.id, ...values });
    } else {
      await createAddressAction(values);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName"><LocalizedText text={"Full name"} /></Label>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
          {...register("fullName")}
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="text-sm text-destructive">
            {errors.fullName.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="line1"><LocalizedText text={"Street address"} /></Label>
        <Input
          id="line1"
          autoComplete="address-line1"
          aria-invalid={!!errors.line1}
          aria-describedby={errors.line1 ? "line1-error" : undefined}
          {...register("line1")}
        />
        {errors.line1 && (
          <p id="line1-error" role="alert" className="text-sm text-destructive">
            {errors.line1.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="line2"><LocalizedText text={"Apartment, suite, etc. (optional)"} /></Label>
        <Input id="line2" autoComplete="address-line2" {...register("line2")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="city"><LocalizedText text={"City"} /></Label>
          <Input
            id="city"
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? "city-error" : undefined}
            {...register("city")}
          />
          {errors.city && (
            <p id="city-error" role="alert" className="text-sm text-destructive">
              {errors.city.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="region"><LocalizedText text={"State / region"} /></Label>
          <Input
            id="region"
            autoComplete="address-level1"
            aria-invalid={!!errors.region}
            aria-describedby={errors.region ? "region-error" : undefined}
            {...register("region")}
          />
          {errors.region && (
            <p id="region-error" role="alert" className="text-sm text-destructive">
              {errors.region.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="postalCode"><LocalizedText text={"Postal code"} /></Label>
          <Input
            id="postalCode"
            autoComplete="postal-code"
            aria-invalid={!!errors.postalCode}
            aria-describedby={errors.postalCode ? "postalCode-error" : undefined}
            {...register("postalCode")}
          />
          {errors.postalCode && (
            <p id="postalCode-error" role="alert" className="text-sm text-destructive">
              {errors.postalCode.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="country"><LocalizedText text={"Country"} /></Label>
          <Input
            id="country"
            autoComplete="country-name"
            aria-invalid={!!errors.country}
            aria-describedby={errors.country ? "country-error" : undefined}
            {...register("country")}
          />
          {errors.country && (
            <p id="country-error" role="alert" className="text-sm text-destructive">
              {errors.country.message}
            </p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("isDefault")} />
        <LocalizedText text={"Set as default "} /></label>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          <LocalizedText text={address ? "Save changes" : "Add address"} />
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          <LocalizedText text={"Cancel "} /></Button>
      </div>
    </form>
  );
}
