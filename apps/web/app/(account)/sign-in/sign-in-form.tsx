"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@medivi/ui/components/ui/input";
import { Label } from "@medivi/ui/components/ui/label";
import { signIn, sendVerificationEmail } from "@/lib/auth-client";
import { mergeCartOnLogin } from "@/lib/actions/cart";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInValues) {
    setServerError(null);
    setUnverifiedEmail(null);
    setResendState("idle");
    const { error } = await signIn.email(values);
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(values.email);
      } else {
        setServerError(error.message ?? "Invalid email or password.");
      }
      return;
    }
    await mergeCartOnLogin();
    router.push("/account");
    router.refresh();
  }

  async function onResend() {
    if (!unverifiedEmail) return;
    setResendState("sending");
    await sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/account" });
    setResendState("sent");
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground underline">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      {unverifiedEmail && (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>Verify your email before signing in — check your inbox for the link.</p>
          <Button type="button" size="sm" variant="outline" disabled={resendState !== "idle"} onClick={onResend}>
            {resendState === "sent" ? "Verification email sent" : resendState === "sending" ? "Sending…" : "Resend verification email"}
          </Button>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
