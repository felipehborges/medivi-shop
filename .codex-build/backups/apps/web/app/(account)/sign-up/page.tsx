import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@medivi/ui/components/ui/card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create an account — Medivi Shop",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl">
            Create an account
          </CardTitle>
          <CardDescription>
            Track orders, save addresses, and build a wishlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SignUpForm />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-foreground underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
