import { count, eq, ilike } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { auditLog, user, type UserRole } from "../schema";

const DEFAULT_PAGE_SIZE = 30;

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

export type AdminUserListParams = { search?: string; page?: number; pageSize?: number };

export type AdminUserListResult = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listUsersAdmin(db: DbClient, params: AdminUserListParams = {}): Promise<AdminUserListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = params.search ? ilike(user.email, `%${params.search}%`) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(user).where(where);
  const total = totalRow?.total ?? 0;

  const items = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user)
    .where(where)
    .orderBy(user.createdAt)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export type SetUserRoleResult = { ok: true } | { ok: false; reason: "not_found" };

export async function setUserRoleAdmin(
  db: DbClient,
  actorId: string,
  userId: string,
  role: UserRole,
): Promise<SetUserRoleResult> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
    if (!before) return { ok: false, reason: "not_found" };

    await tx.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId));
    await tx.insert(auditLog).values({
      actorId,
      action: "user.role_change",
      entityType: "user",
      entityId: userId,
      diff: { from: before.role, to: role },
    });
    return { ok: true };
  });
}
