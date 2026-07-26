import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { address, user } from "@medivi/db/schema";

const requireUserMock = vi.fn();
vi.mock("@/lib/auth-guards", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { createAddressAction, deleteAddressAction, updateAddressAction } = await import("./addresses");

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

const baseInput = {
  fullName: "Ada Venturer",
  line1: "1 Guild Hall Way",
  city: "Millhaven",
  region: "Riverlands",
  postalCode: "00001",
  country: "US",
};

const createdUserIds: string[] = [];

afterEach(async () => {
  requireUserMock.mockReset();
  for (const id of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, id));
  }
});

afterAll(async () => {
  // Safety net in case an assertion failure skipped the afterEach cleanup above.
  for (const id of createdUserIds) {
    await db.delete(user).where(eq(user.id, id));
  }
});

async function makeUser() {
  const id = unique("user");
  const [row] = await db.insert(user).values({ id, name: id, email: `${id}@example.com` }).returning();
  createdUserIds.push(row!.id);
  return row!;
}

describe("createAddressAction", () => {
  it("requires a session", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT:/sign-in"));
    await expect(createAddressAction(baseInput)).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("creates an address for the signed-in user", async () => {
    const u = await makeUser();
    requireUserMock.mockResolvedValue({ id: u.id });

    await createAddressAction(baseInput);

    const rows = await db.select().from(address).where(eq(address.userId, u.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isDefault).toBe(true);
  });
});

describe("updateAddressAction and deleteAddressAction", () => {
  it("updates then deletes an address, and rejects updates from another user", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    requireUserMock.mockResolvedValue({ id: owner.id });
    await createAddressAction(baseInput);
    const [created] = await db.select().from(address).where(eq(address.userId, owner.id));

    requireUserMock.mockResolvedValue({ id: other.id });
    await updateAddressAction({ id: created!.id, ...baseInput, city: "Hijacked" });
    const [unchanged] = await db.select().from(address).where(eq(address.id, created!.id));
    expect(unchanged?.city).toBe("Millhaven");

    requireUserMock.mockResolvedValue({ id: owner.id });
    await updateAddressAction({ id: created!.id, ...baseInput, city: "New Millhaven" });
    const [updated] = await db.select().from(address).where(eq(address.id, created!.id));
    expect(updated?.city).toBe("New Millhaven");

    await deleteAddressAction({ id: created!.id });
    const remaining = await db.select().from(address).where(eq(address.userId, owner.id));
    expect(remaining).toHaveLength(0);
  });
});
