import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listAuditEntityTypes, listAuditLogAdmin } from "@medivi/db/queries";
import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { requireAdmin } from "@/lib/auth-guards";
import { CatalogPagination } from "@/components/catalog-pagination";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Audit log — Admin — Medivi Shop" };

type Params = { actorId?: string; entityType?: string; page?: string };

export default async function AdminAuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const params = await searchParams;

  const [result, entityTypes] = await Promise.all([
    listAuditLogAdmin(db, {
      actorId: params.actorId || undefined,
      entityType: params.entityType || undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    listAuditEntityTypes(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Audit log</h1>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="actorId" className="text-xs text-muted-foreground">
            Actor id
          </label>
          <Input id="actorId" name="actorId" defaultValue={params.actorId} placeholder="user id…" className="w-56" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="entityType" className="text-xs text-muted-foreground">
            Entity type
          </label>
          <select
            id="entityType"
            name="entityType"
            defaultValue={params.entityType ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none dark:bg-input/30"
          >
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No matching audit entries" description="Try a different actor id or entity type." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Diff</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((entry) => (
                <tr key={entry.id} className="border-b align-top last:border-0">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{entry.createdAt.toLocaleString()}</td>
                  <td className="p-3">{entry.actorName ?? entry.actorId ?? "system"}</td>
                  <td className="p-3 font-mono text-xs">{entry.action}</td>
                  <td className="p-3 text-muted-foreground">
                    {entry.entityType}:{entry.entityId.slice(0, 8)}
                  </td>
                  <td className="p-3">
                    <pre className="max-w-xs overflow-x-auto text-xs text-muted-foreground">
                      {JSON.stringify(entry.diff, null, 0)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPagination
        basePath="/admin/audit-log"
        page={result.page}
        totalPages={result.totalPages}
        searchParams={{ actorId: params.actorId, entityType: params.entityType }}
      />
    </div>
  );
}
