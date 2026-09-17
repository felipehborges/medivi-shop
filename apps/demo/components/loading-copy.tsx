"use client";

import { useI18n } from "./locale-provider";

export function LoadingCopy({ text, className }: { text: string; className: string }) {
  const { tr } = useI18n();
  return <div className={className}>{tr(text)}</div>;
}
