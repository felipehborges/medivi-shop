"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { createAddress, deleteAddress, updateAddress } from "@medivi/db/queries";
import { requireUser } from "@/lib/auth-guards";
import { addressSchema } from "@/lib/schemas/address";

export async function createAddressAction(input: z.infer<typeof addressSchema>) {
  const user = await requireUser();
  const parsed = addressSchema.parse(input);
  await createAddress(db, user.id, parsed);
  revalidatePath("/account/addresses");
}

const updateAddressSchema = addressSchema.extend({ id: z.string().uuid() });

export async function updateAddressAction(input: z.infer<typeof updateAddressSchema>) {
  const user = await requireUser();
  const { id, ...parsed } = updateAddressSchema.parse(input);
  await updateAddress(db, id, user.id, parsed);
  revalidatePath("/account/addresses");
}

const deleteAddressSchema = z.object({ id: z.string().uuid() });

export async function deleteAddressAction(input: z.infer<typeof deleteAddressSchema>) {
  const user = await requireUser();
  const { id } = deleteAddressSchema.parse(input);
  await deleteAddress(db, id, user.id);
  revalidatePath("/account/addresses");
}
