import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <AdminNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
