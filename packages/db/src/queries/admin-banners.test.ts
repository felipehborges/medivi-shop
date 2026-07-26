import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { auditLog, banner, user } from "../schema";
import { createBannerAdmin, deleteBannerAdmin, updateBannerAdmin } from "./admin-banners";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeActor(tx: Tx) {
  const uid = unique("admin");
  const [actor] = await tx.insert(user).values({ id: uid, name: uid, email: `${uid}@example.com`, role: "admin" }).returning();
  return actor!.id;
}

const baseInput = {
  title: "Autumn Sale",
  imageUrl: "https://example.com/banner.png",
  placement: "hero" as const,
  isActive: true,
  sortOrder: 0,
};

describe("createBannerAdmin", () => {
  it("creates a banner and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const row = await createBannerAdmin(tx, actorId, baseInput);
      expect(row.title).toBe("Autumn Sale");

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, row.id), eq(auditLog.action, "banner.create")));
      expect(logs).toHaveLength(1);
    });
  });
});

describe("updateBannerAdmin", () => {
  it("updates the banner and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const created = await createBannerAdmin(tx, actorId, baseInput);

      const updated = await updateBannerAdmin(tx, actorId, created.id, { ...baseInput, isActive: false });
      expect(updated?.isActive).toBe(false);

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "banner.update")));
      expect(logs).toHaveLength(1);
    });
  });
});

describe("deleteBannerAdmin", () => {
  it("deletes the banner and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actorId = await makeActor(tx);
      const created = await createBannerAdmin(tx, actorId, baseInput);

      await deleteBannerAdmin(tx, actorId, created.id);

      const [row] = await tx.select().from(banner).where(eq(banner.id, created.id));
      expect(row).toBeUndefined();

      const logs = await tx.select().from(auditLog).where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "banner.delete")));
      expect(logs).toHaveLength(1);
    });
  });
});
