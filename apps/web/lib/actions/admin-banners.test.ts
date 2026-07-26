import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { auditLog, banner, user } from "@medivi/db/schema";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { createBannerAction, deleteBannerAction, updateBannerAction } = await import("./admin-banners");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const baseInput = {
  title: "Autumn Sale",
  imageUrl: "https://example.com/banner.png",
  placement: "hero" as const,
  isActive: true,
};

const createdBannerIds: string[] = [];
let adminId: string;

async function makeAdmin() {
  const aid = unique("admin");
  const [admin] = await db.insert(user).values({ id: aid, name: aid, email: `${aid}@example.com`, role: "admin" }).returning();
  return admin!.id;
}

afterEach(() => {
  requireAdminMock.mockReset();
});

afterAll(async () => {
  for (const id of createdBannerIds) {
    await db.delete(auditLog).where(eq(auditLog.entityId, id));
    await db.delete(banner).where(eq(banner.id, id));
  }
  if (adminId) await db.delete(user).where(eq(user.id, adminId));
});

describe("non-admin rejection", () => {
  it("rejects every banner action for a non-admin caller", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT:/"));
    await expect(createBannerAction(baseInput)).rejects.toThrow("REDIRECT:/");
    await expect(updateBannerAction({ id: unique("id"), ...baseInput })).rejects.toThrow("REDIRECT:/");
    await expect(deleteBannerAction({ id: unique("id") })).rejects.toThrow("REDIRECT:/");
  });
});

describe("banner lifecycle for an admin caller", () => {
  it("creates, updates, and deletes a banner", async () => {
    adminId = await makeAdmin();
    requireAdminMock.mockResolvedValue({ id: adminId });

    await createBannerAction(baseInput);
    const [created] = await db.select().from(banner).where(eq(banner.title, "Autumn Sale"));
    expect(created?.isActive).toBe(true);
    createdBannerIds.push(created!.id);

    await updateBannerAction({ id: created!.id, ...baseInput, isActive: false });
    const [updated] = await db.select({ isActive: banner.isActive }).from(banner).where(eq(banner.id, created!.id));
    expect(updated?.isActive).toBe(false);

    await deleteBannerAction({ id: created!.id });
    const remaining = await db.select().from(banner).where(eq(banner.id, created!.id));
    expect(remaining).toHaveLength(0);
  });
});
