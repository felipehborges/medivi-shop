import { z } from "zod";

export const orderLookupSchema = z.object({
  orderNumber: z.string().min(1, "Enter your order number"),
  email: z.string().email("Enter a valid email address"),
});

export type OrderLookupInput = z.infer<typeof orderLookupSchema>;
