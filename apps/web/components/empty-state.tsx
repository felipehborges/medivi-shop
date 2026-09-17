"use client";

import { useLocale } from "./locale-provider";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { tr } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-24 text-center">
      <p className="font-display text-lg">{tr(title)}</p>
      <p className="text-sm text-muted-foreground">{tr(description)}</p>
    </div>
  );
}
