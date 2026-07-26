import { z } from "zod";

import { SHIPPING_METHOD_IDS } from "@/lib/shipping";

export const shippingAddressSchema = z.object({
  fullName: z.string().min(2, "Enter a full name"),
  line1: z.string().min(1, "Enter a street address"),
  line2: z.string().optional(),
  city: z.string().min(1, "Enter a city"),
  region: z.string().min(1, "Enter a state/region"),
  postalCode: z.string().min(3, "Enter a postal code"),
  country: z.string().min(2, "Enter a country"),
});

export const checkoutSchema = z.object({
  guestEmail: z.string().email("Enter a valid email address").optional(),
  shippingAddress: shippingAddressSchema,
  shippingMethodId: z.enum(SHIPPING_METHOD_IDS),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
