import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { user } from "../schema";
import { createAddress, deleteAddress, listAddressesForUser, updateAddress } from "./addresses";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeUser(tx: Tx) {
  const id = unique("user");
  const [row] = await tx.insert(user).values({ id, name: id, email: `${id}@example.com` }).returning();
  return row!;
}

const baseInput = {
  fullName: "Ada Venturer",
  line1: "1 Guild Hall Way",
  city: "Millhaven",
  region: "Riverlands",
  postalCode: "00001",
  country: "US",
};

describe("createAddress", () => {
  it("makes the first address the default regardless of the input flag", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const created = await createAddress(tx, u.id, { ...baseInput, isDefault: false });
      expect(created.isDefault).toBe(true);
    });
  });

  it("unsets the previous default when a new one is created as default", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const first = await createAddress(tx, u.id, baseInput);
      const second = await createAddress(tx, u.id, { ...baseInput, line1: "2 Guild Hall Way", isDefault: true });

      const list = await listAddressesForUser(tx, u.id);
      const firstRow = list.find((a) => a.id === first.id);
      const secondRow = list.find((a) => a.id === second.id);
      expect(firstRow?.isDefault).toBe(false);
      expect(secondRow?.isDefault).toBe(true);
    });
  });

  it("a second non-default address does not disturb the existing default", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const first = await createAddress(tx, u.id, baseInput);
      await createAddress(tx, u.id, { ...baseInput, line1: "2 Guild Hall Way", isDefault: false });

      const list = await listAddressesForUser(tx, u.id);
      expect(list.find((a) => a.id === first.id)?.isDefault).toBe(true);
    });
  });

  it("keeps addresses separate per user", async () => {
    await withTestTransaction(async (tx) => {
      const u1 = await makeUser(tx);
      const u2 = await makeUser(tx);
      await createAddress(tx, u1.id, baseInput);

      expect(await listAddressesForUser(tx, u2.id)).toHaveLength(0);
      expect(await listAddressesForUser(tx, u1.id)).toHaveLength(1);
    });
  });
});

describe("updateAddress", () => {
  it("updates fields and returns null for another user's address", async () => {
    await withTestTransaction(async (tx) => {
      const u1 = await makeUser(tx);
      const u2 = await makeUser(tx);
      const created = await createAddress(tx, u1.id, baseInput);

      const updated = await updateAddress(tx, created.id, u1.id, { ...baseInput, city: "New Millhaven" });
      expect(updated?.city).toBe("New Millhaven");

      const blocked = await updateAddress(tx, created.id, u2.id, { ...baseInput, city: "Hijacked" });
      expect(blocked).toBeNull();
    });
  });

  it("promotes a second address to default and demotes the first", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const first = await createAddress(tx, u.id, baseInput);
      const second = await createAddress(tx, u.id, { ...baseInput, line1: "2 Guild Hall Way" });

      await updateAddress(tx, second.id, u.id, { ...baseInput, isDefault: true });

      const list = await listAddressesForUser(tx, u.id);
      expect(list.find((a) => a.id === first.id)?.isDefault).toBe(false);
      expect(list.find((a) => a.id === second.id)?.isDefault).toBe(true);
    });
  });
});

describe("deleteAddress", () => {
  it("removes the address", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const created = await createAddress(tx, u.id, baseInput);
      await deleteAddress(tx, created.id, u.id);
      expect(await listAddressesForUser(tx, u.id)).toHaveLength(0);
    });
  });

  it("promotes the next-most-recent address to default when the default is deleted", async () => {
    await withTestTransaction(async (tx) => {
      const u = await makeUser(tx);
      const first = await createAddress(tx, u.id, baseInput);
      const second = await createAddress(tx, u.id, { ...baseInput, line1: "2 Guild Hall Way" });

      await deleteAddress(tx, first.id, u.id);

      const list = await listAddressesForUser(tx, u.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(second.id);
      expect(list[0]?.isDefault).toBe(true);
    });
  });

  it("does not delete another user's address", async () => {
    await withTestTransaction(async (tx) => {
      const u1 = await makeUser(tx);
      const u2 = await makeUser(tx);
      const created = await createAddress(tx, u1.id, baseInput);

      await deleteAddress(tx, created.id, u2.id);

      expect(await listAddressesForUser(tx, u1.id)).toHaveLength(1);
    });
  });
});
