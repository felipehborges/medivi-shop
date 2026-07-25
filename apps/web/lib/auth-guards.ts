import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, type Session } from "./auth";

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Redirects to sign-in if there's no session. Safe to call from both
 * Server Components and Server Actions — Next.js's `redirect()` works in
 * either context. This is the check every protected server action must
 * make itself, not rely on middleware alone (see CLAUDE.md).
 */
export async function requireUser(): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session.user;
}

/**
 * Same as `requireUser`, but also enforces `role === "admin"`. A signed-in
 * non-admin is sent home rather than shown a raw error.
 */
export async function requireAdmin(): Promise<Session["user"]> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}
