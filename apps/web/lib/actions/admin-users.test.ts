import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { auditLog, user } from "@medivi/db/schema";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { setUserRoleAction } = await import("./admin-users");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

let adminId: string;
let customerId: string;

beforeAll(async () => {
  const aid = unique("admin");
  const [admin] = await db.insert(user).values({ id: aid, name: aid, email: `${aid}@example.com`, role: "admin" }).returning();
  adminId = admin!.id;
  const cid = unique("customer");
  const [customer] = await db.insert(user).values({ id: cid, name: cid, email: `${cid}@example.com` }).returning();
  customerId = customer!.id;
});

afterEach(() => {
  requireAdminMock.mockReset();
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.entityId, customerId));
  await db.delete(user).where(eq(user.id, adminId));
  await db.delete(user).where(eq(user.id, customerId));
});

describe("non-admin rejection", () => {
  it("rejects for a non-admin caller", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT:/"));
    await expect(setUserRoleAction({ userId: customerId, role: "admin" })).rejects.toThrow("REDIRECT:/");
  });
});

describe("setUserRoleAction", () => {
  it("promotes another user to admin", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const result = await setUserRoleAction({ userId: customerId, role: "admin" });
    expect(result).toEqual({ ok: true });

    const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, customerId));
    expect(row?.role).toBe("admin");

    await setUserRoleAction({ userId: customerId, role: "customer" });
  });

  it("blocks an admin from changing their own role", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const result = await setUserRoleAction({ userId: adminId, role: "customer" });
    expect(result).toEqual({ ok: false, reason: "self" });

    const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, adminId));
    expect(row?.role).toBe("admin");
  });
});
