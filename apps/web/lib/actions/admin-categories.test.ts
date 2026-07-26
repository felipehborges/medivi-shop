import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { auditLog, category, user } from "@medivi/db/schema";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { createCategoryAction, deleteCategoryAction, updateCategoryAction } = await import("./admin-categories");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

let adminId: string;
const createdCategoryIds: string[] = [];

beforeAll(async () => {
  const aid = unique("admin");
  const [admin] = await db.insert(user).values({ id: aid, name: aid, email: `${aid}@example.com`, role: "admin" }).returning();
  adminId = admin!.id;
});

afterEach(() => {
  requireAdminMock.mockReset();
});

afterAll(async () => {
  for (const id of createdCategoryIds) {
    await db.delete(auditLog).where(eq(auditLog.entityId, id));
    await db.delete(category).where(eq(category.id, id));
  }
  await db.delete(user).where(eq(user.id, adminId));
});

describe("non-admin rejection", () => {
  it("rejects every category action for a non-admin caller", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT:/"));
    await expect(createCategoryAction({ name: "Relics", slug: unique("relics") })).rejects.toThrow("REDIRECT:/");
    await expect(updateCategoryAction({ id: unique("id"), name: "Relics", slug: unique("relics") })).rejects.toThrow(
      "REDIRECT:/",
    );
    await expect(deleteCategoryAction({ id: unique("id") })).rejects.toThrow("REDIRECT:/");
  });
});

describe("createCategoryAction / updateCategoryAction / deleteCategoryAction", () => {
  it("creates, updates, and deletes a category for an admin caller", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });

    const created = await createCategoryAction({ name: "Relics", slug: unique("relics") });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdCategoryIds.push(created.id);

    const updated = await updateCategoryAction({ id: created.id, name: "Ancient Relics", slug: unique("relics") });
    expect(updated.ok).toBe(true);

    const [row] = await db.select({ name: category.name }).from(category).where(eq(category.id, created.id));
    expect(row?.name).toBe("Ancient Relics");

    const deleted = await deleteCategoryAction({ id: created.id });
    expect(deleted).toEqual({ ok: true });
  });
});
