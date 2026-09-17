import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@medivi/ui/components/ui/card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — Medivi Shop",
};

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl"><LocalizedText text={"Sign in"} /></CardTitle>
          <CardDescription><LocalizedText text={"Welcome back, adventurer."} /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SignInForm />
          <p className="text-center text-sm text-muted-foreground">
            <LocalizedText text={"Don't have an account?"} />{" "}
            <Link href="/sign-up" className="font-medium text-foreground underline">
              <LocalizedText text={"Create one "} /></Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <LocalizedText text={"Checked out as a guest?"} />{" "}
            <Link href="/orders/lookup" className="font-medium text-foreground underline">
              <LocalizedText text={"Find your order "} /></Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
