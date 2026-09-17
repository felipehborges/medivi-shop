"use client";

import type { ComponentProps } from "react";
import { Input as BaseInput } from "@medivi/ui/components/ui/input";
import { useLocale } from "./locale-provider";

export function Input({ placeholder, "aria-label": ariaLabel, ...props }: ComponentProps<typeof BaseInput>) {
  const { tr } = useLocale();
  return <BaseInput {...props} placeholder={placeholder ? tr(placeholder) : undefined} aria-label={ariaLabel ? tr(ariaLabel) : undefined} />;
}
