import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@medivi/ui/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password — Medivi Shop",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl"><LocalizedText text={"Reset password"} /></CardTitle>
          <CardDescription><LocalizedText text={"Choose a new password for your account."} /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ResetPasswordForm token={token ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
