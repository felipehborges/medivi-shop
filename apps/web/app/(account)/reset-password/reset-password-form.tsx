"use client";

import { LocalizedText } from "@/components/localized-text";


import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@/components/translated-input";
import { Label } from "@medivi/ui/components/ui/label";
import { resetPassword } from "@/lib/auth-client";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token) {
    return (
      <p role="alert" className="text-sm text-destructive">
        <LocalizedText text={"This reset link is missing or invalid. Request a new one from the forgot-password page. "} /></p>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setServerError(null);
    const { error } = await resetPassword({ newPassword: values.newPassword, token: token! });
    if (error) {
      setServerError(error.message ?? "That reset link is invalid or expired.");
      return;
    }
    router.push("/sign-in");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword"><LocalizedText text={"New password"} /></Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          aria-describedby={errors.newPassword ? "newPassword-error" : undefined}
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p id="newPassword-error" role="alert" className="text-sm text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
