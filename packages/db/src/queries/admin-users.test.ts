import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Tx } from "../lib/db-client";
import { withTestTransaction } from "../test";
import { auditLog, user } from "../schema";
import { setUserRoleAdmin } from "./admin-users";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeUser(tx: Tx, role: "customer" | "admin" = "customer") {
  const id = unique("user");
  const [row] = await tx.insert(user).values({ id, name: id, email: `${id}@example.com`, role }).returning();
  return row!;
}

describe("setUserRoleAdmin", () => {
  it("promotes a customer to admin and writes an audit log row", async () => {
    await withTestTransaction(async (tx) => {
      const actor = await makeUser(tx, "admin");
      const target = await makeUser(tx, "customer");

      const result = await setUserRoleAdmin(tx, actor.id, target.id, "admin");
      expect(result).toEqual({ ok: true });

      const [row] = await tx.select({ role: user.role }).from(user).where(eq(user.id, target.id));
      expect(row?.role).toBe("admin");

      const logs = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, target.id), eq(auditLog.action, "user.role_change")));
      expect(logs).toHaveLength(1);
      expect(logs[0]?.diff).toEqual({ from: "customer", to: "admin" });
    });
  });

  it("returns not_found for a nonexistent user", async () => {
    await withTestTransaction(async (tx) => {
      const actor = await makeUser(tx, "admin");
      const result = await setUserRoleAdmin(tx, actor.id, "00000000-0000-0000-0000-000000000000", "admin");
      expect(result).toEqual({ ok: false, reason: "not_found" });
    });
  });
});
