import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { getProductForAdmin } from "@medivi/db/queries";
import { auditLog, category, product, user } from "@medivi/db/schema";

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const uploadMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorageProvider: () => ({ upload: uploadMock, delete: deleteMock }),
}));

const {
  createProductAction,
  deleteProductImageAction,
  setProductStatusAction,
  updateProductAction,
  uploadProductImageAction,
} = await import("./admin-products");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * `image-size` only reads the PNG signature + IHDR chunk's declared
 * width/height — it never decodes pixel data or checks chunk CRCs — so a
 * structurally-minimal buffer with the right header bytes is enough to
 * exercise the real dimension-validation path without a real image asset.
 */
function makeTestPng(width: number, height: number): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(new ArrayBuffer(33));
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // PNG signature
  buffer.set([0, 0, 0, 13], 8); // IHDR chunk length
  buffer.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(buffer.buffer).setUint32(16, width, false);
  new DataView(buffer.buffer).setUint32(20, height, false);
  return buffer;
}

let categoryId: string;
let adminId: string;
const createdProductIds: string[] = [];

beforeAll(async () => {
  const [cat] = await db.insert(category).values({ name: unique("cat"), slug: unique("cat") }).returning();
  categoryId = cat!.id;
  const aid = unique("admin");
  const [admin] = await db.insert(user).values({ id: aid, name: aid, email: `${aid}@example.com`, role: "admin" }).returning();
  adminId = admin!.id;
});

afterEach(() => {
  requireAdminMock.mockReset();
  uploadMock.mockReset();
  deleteMock.mockReset();
});

afterAll(async () => {
  for (const id of createdProductIds) {
    await db.delete(auditLog).where(eq(auditLog.entityId, id));
    await db.delete(product).where(eq(product.id, id));
  }
  await db.delete(category).where(eq(category.id, categoryId));
  await db.delete(user).where(eq(user.id, adminId));
});

function baseInput() {
  return {
    categoryId,
    name: "Test Sword",
    slug: unique("test-sword"),
    basePriceCents: 1000,
    status: "draft" as const,
  };
}

describe("non-admin rejection", () => {
  it("rejects every product action for a non-admin caller", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT:/"));

    await expect(createProductAction(baseInput())).rejects.toThrow("REDIRECT:/");
    await expect(updateProductAction({ id: unique("id"), ...baseInput() })).rejects.toThrow("REDIRECT:/");
    await expect(setProductStatusAction({ id: unique("id"), status: "archived" })).rejects.toThrow("REDIRECT:/");
    await expect(uploadProductImageAction(new FormData())).rejects.toThrow("REDIRECT:/");
    await expect(deleteProductImageAction({ imageId: unique("id"), productId: unique("id") })).rejects.toThrow(
      "REDIRECT:/",
    );
  });
});

describe("createProductAction", () => {
  it("creates a product for an admin caller", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const result = await createProductAction(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) createdProductIds.push(result.id);
  });
});

describe("setProductStatusAction", () => {
  it("archives a product (soft-delete)", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const created = await createProductAction(baseInput());
    if (!created.ok) throw new Error("setup failed");
    createdProductIds.push(created.id);

    const result = await setProductStatusAction({ id: created.id, status: "archived" });
    expect(result).toEqual({ ok: true });

    const [row] = await db.select({ status: product.status }).from(product).where(eq(product.id, created.id));
    expect(row?.status).toBe("archived");
  });
});

describe("uploadProductImageAction", () => {
  it("uploads via the storage provider and records a product image", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const created = await createProductAction(baseInput());
    if (!created.ok) throw new Error("setup failed");
    createdProductIds.push(created.id);

    uploadMock.mockResolvedValue({ url: "https://example.com/a.png" });

    const formData = new FormData();
    formData.set("productId", created.id);
    formData.set("altText", "A sword");
    formData.set("file", new File([makeTestPng(300, 300)], "a.png", { type: "image/png" }));

    const result = await uploadProductImageAction(formData);
    expect(result).toEqual({ ok: true });
    expect(uploadMock).toHaveBeenCalledOnce();
  });

  it("falls back to the product name when alt text is omitted", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const created = await createProductAction(baseInput());
    if (!created.ok) throw new Error("setup failed");
    createdProductIds.push(created.id);

    uploadMock.mockResolvedValue({ url: "https://example.com/b.png" });

    const formData = new FormData();
    formData.set("productId", created.id);
    formData.set("file", new File([makeTestPng(300, 300)], "b.png", { type: "image/png" }));

    const result = await uploadProductImageAction(formData);
    expect(result).toEqual({ ok: true });

    const images = await getProductForAdmin(db, created.id);
    expect(images?.images.find((i) => i.url === "https://example.com/b.png")?.altText).toBe("Test Sword");
  });

  it("rejects an image smaller than the minimum dimensions without calling the storage provider", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const created = await createProductAction(baseInput());
    if (!created.ok) throw new Error("setup failed");
    createdProductIds.push(created.id);

    const formData = new FormData();
    formData.set("productId", created.id);
    formData.set("altText", "A sword");
    formData.set("file", new File([makeTestPng(10, 10)], "tiny.png", { type: "image/png" }));

    const result = await uploadProductImageAction(formData);
    expect(result).toEqual({ ok: false, reason: "invalid_dimensions" });
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects a disallowed file type without calling the storage provider", async () => {
    requireAdminMock.mockResolvedValue({ id: adminId });
    const created = await createProductAction(baseInput());
    if (!created.ok) throw new Error("setup failed");
    createdProductIds.push(created.id);

    const formData = new FormData();
    formData.set("productId", created.id);
    formData.set("altText", "A sword");
    formData.set("file", new File([new Uint8Array([1, 2, 3])], "a.gif", { type: "image/gif" }));

    const result = await uploadProductImageAction(formData);
    expect(result).toEqual({ ok: false, reason: "invalid_type" });
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
