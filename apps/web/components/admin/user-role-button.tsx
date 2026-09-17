"use client";

import { LocalizedText } from "@/components/localized-text";


import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import type { UserRole } from "@medivi/db/schema";
import { setUserRoleAction } from "@/lib/actions/admin-users";

export function UserRoleButton({ userId, role, isSelf }: { userId: string; role: UserRole; isSelf: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleRole() {
    setError(null);
    setPending(true);
    const next: UserRole = role === "admin" ? "customer" : "admin";
    const result = await setUserRoleAction({ userId, role: next });
    setPending(false);
    if (!result.ok) {
      setError(result.reason === "self" ? "You can't change your own role." : "User not found.");
      return;
    }
    router.refresh();
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground"><LocalizedText text={"(you)"} /></span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={toggleRole}>
        {role === "admin" ? "Demote to customer" : "Promote to admin"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
