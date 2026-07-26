"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { setUserRoleAdmin } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";

const setUserRoleSchema = z.object({ userId: z.string(), role: z.enum(["customer", "admin"]) });

export type SetUserRoleActionResult = { ok: true } | { ok: false; reason: "not_found" | "self" };

/**
 * Admin-only; also blocks an admin from changing their own role — without
 * this, the last admin could demote themselves out of `/admin` with no way
 * back in short of a direct DB edit.
 */
export async function setUserRoleAction(
  input: z.infer<typeof setUserRoleSchema>,
): Promise<SetUserRoleActionResult> {
  const admin = await requireAdmin();
  const { userId, role } = setUserRoleSchema.parse(input);
  if (userId === admin.id) return { ok: false, reason: "self" };

  const result = await setUserRoleAdmin(db, admin.id, userId, role);
  if (result.ok) revalidatePath("/admin/users");
  return result;
}
