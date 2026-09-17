import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listUsersAdmin } from "@medivi/db/queries";
import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { requireAdmin } from "@/lib/auth-guards";
import { CatalogPagination } from "@/components/catalog-pagination";
import { UserRoleButton } from "@/components/admin/user-role-button";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Users — Admin — Medivi Shop" };

type Params = { search?: string; page?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const result = await listUsersAdmin(db, { search: params.search || undefined, page: params.page ? Number(params.page) : 1 });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Users</h1>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="text-xs text-muted-foreground">
            Email
          </label>
          <Input id="search" name="search" defaultValue={params.search} placeholder="Search by email…" className="w-64" />
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No users match" description="Try a different email search." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Joined</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {result.items.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{u.createdAt.toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <UserRoleButton userId={u.id} role={u.role} isSelf={u.id === admin.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPagination
        basePath="/admin/users"
        page={result.page}
        totalPages={result.totalPages}
        searchParams={{ search: params.search }}
      />
    </div>
  );
}
