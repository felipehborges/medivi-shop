import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@medivi/ui/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — Medivi Shop",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl"><LocalizedText text={"Forgot password"} /></CardTitle>
          <CardDescription><LocalizedText text={"We'll email you a link to reset it."} /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ForgotPasswordForm />
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/sign-in" className="font-medium text-foreground underline">
              <LocalizedText text={"Back to sign in "} /></Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
