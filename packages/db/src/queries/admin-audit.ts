import { and, count, desc, eq } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { auditLog, user } from "../schema";

const DEFAULT_PAGE_SIZE = 30;

export type AdminAuditLogEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff: unknown;
  createdAt: Date;
};

export type AdminAuditLogParams = {
  actorId?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
};

export type AdminAuditLogResult = {
  items: AdminAuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Read-only — `audit_log` is append-only and this never writes to it (see docs/architecture.md §3). */
export async function listAuditLogAdmin(
  db: DbClient,
  params: AdminAuditLogParams = {},
): Promise<AdminAuditLogResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const conditions = [];
  if (params.actorId) conditions.push(eq(auditLog.actorId, params.actorId));
  if (params.entityType) conditions.push(eq(auditLog.entityType, params.entityType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(auditLog).where(where);
  const total = totalRow?.total ?? 0;

  const items = await db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorName: user.name,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      diff: auditLog.diff,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listAuditEntityTypes(db: DbClient): Promise<string[]> {
  const rows = await db.selectDistinct({ entityType: auditLog.entityType }).from(auditLog);
  return rows.map((r) => r.entityType).sort();
}
