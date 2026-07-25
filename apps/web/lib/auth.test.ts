import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { account, session, user } from "@medivi/db/schema";
import { APIError } from "better-auth/api";
import { auth } from "./auth";

const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  testEmails.push(email);
  return email;
}

afterAll(async () => {
  for (const email of testEmails) {
    await db.delete(user).where(eq(user.email, email));
  }
});

describe("sign up", () => {
  it("creates a user and a hashed-password account row", async () => {
    const email = uniqueEmail("signup");
    const result = await auth.api.signUpEmail({
      body: { name: "Signup Test", email, password: "correcthorsebatterystaple" },
    });

    expect(result.user.email).toBe(email);
    expect(result.user.role).toBe("customer");

    const [accountRow] = await db
      .select()
      .from(account)
      .where(eq(account.userId, result.user.id));

    expect(accountRow?.password).toBeTruthy();
    expect(accountRow?.password).not.toBe("correcthorsebatterystaple");
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail("dupe");
    await auth.api.signUpEmail({
      body: { name: "Dupe Test", email, password: "correcthorsebatterystaple" },
    });

    await expect(
      auth.api.signUpEmail({
        body: { name: "Dupe Test 2", email, password: "anotherpassword123" },
      }),
    ).rejects.toThrow(APIError);
  });
});

describe("sign in", () => {
  it("succeeds with correct credentials and persists a session", async () => {
    const email = uniqueEmail("signin-ok");
    const password = "correcthorsebatterystaple";
    const signedUp = await auth.api.signUpEmail({
      body: { name: "Signin Test", email, password },
    });

    const result = await auth.api.signInEmail({ body: { email, password } });
    expect(result.user.email).toBe(email);

    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, signedUp.user.id));
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects an incorrect password", async () => {
    const email = uniqueEmail("signin-bad");
    await auth.api.signUpEmail({
      body: { name: "Signin Bad Test", email, password: "correcthorsebatterystaple" },
    });

    await expect(
      auth.api.signInEmail({ body: { email, password: "wrongpassword" } }),
    ).rejects.toThrow(APIError);
  });
});
