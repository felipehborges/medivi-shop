import { z } from "zod";

export const addressSchema = z.object({
  fullName: z.string().min(2, "Enter a full name"),
  line1: z.string().min(1, "Enter a street address"),
  line2: z.string().optional(),
  city: z.string().min(1, "Enter a city"),
  region: z.string().min(1, "Enter a state/region"),
  postalCode: z.string().min(3, "Enter a postal code"),
  country: z.string().min(2, "Enter a country"),
  isDefault: z.boolean().optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;
