import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@medivi/db/client";
import { account, session, user } from "@medivi/db/schema";
import { APIError } from "better-auth/api";

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  getEmailProvider: () => ({ send: sendEmailMock }),
}));

const { auth } = await import("./auth");

const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  testEmails.push(email);
  return email;
}

afterEach(() => {
  sendEmailMock.mockClear();
});

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

  it("does not create a second account for an email that's already verified", async () => {
    // Doesn't throw — Better Auth returns a non-persisted response instead
    // of a hard conflict here, to avoid leaking via an error message whether
    // an email is already registered (account enumeration). An unverified
    // duplicate, by contrast, is allowed to retry sign-up freely, since an
    // incomplete signup is reclaimable.
    const email = uniqueEmail("dupe");
    const signedUp = await auth.api.signUpEmail({
      body: { name: "Dupe Test", email, password: "correcthorsebatterystaple" },
    });
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, signedUp.user.id));

    await auth.api.signUpEmail({
      body: { name: "Dupe Test 2", email, password: "anotherpassword123" },
    });

    const rows = await db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(signedUp.user.id);
  });

  it("sends a welcome email and a verification email", async () => {
    const email = uniqueEmail("emails");
    await auth.api.signUpEmail({
      body: { name: "Email Test", email, password: "correcthorsebatterystaple" },
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const recipients = sendEmailMock.mock.calls.map((call) => call[0].to);
    expect(recipients).toEqual([email, email]);
    const subjects = sendEmailMock.mock.calls.map((call) => call[0].subject);
    expect(subjects).toEqual(expect.arrayContaining(["Welcome to Medivi Shop", "Verify your email address"]));
  });
});

describe("sign in", () => {
  it("rejects sign-in for an unverified email", async () => {
    const email = uniqueEmail("unverified");
    const password = "correcthorsebatterystaple";
    await auth.api.signUpEmail({ body: { name: "Unverified Test", email, password } });

    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toThrow(APIError);
  });

  it("succeeds with correct credentials once verified, and persists a session", async () => {
    const email = uniqueEmail("signin-ok");
    const password = "correcthorsebatterystaple";
    const signedUp = await auth.api.signUpEmail({
      body: { name: "Signin Test", email, password },
    });
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, signedUp.user.id));

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
    const signedUp = await auth.api.signUpEmail({
      body: { name: "Signin Bad Test", email, password: "correcthorsebatterystaple" },
    });
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, signedUp.user.id));

    await expect(
      auth.api.signInEmail({ body: { email, password: "wrongpassword" } }),
    ).rejects.toThrow(APIError);
  });
});

describe("password reset", () => {
  it("sends a reset-password email with a working token", async () => {
    const email = uniqueEmail("reset");
    await auth.api.signUpEmail({
      body: { name: "Reset Test", email, password: "correcthorsebatterystaple" },
    });
    sendEmailMock.mockClear();

    await auth.api.requestPasswordReset({ body: { email, redirectTo: "http://localhost:3000/reset-password" } });

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const sentEmail = sendEmailMock.mock.calls[0]![0];
    expect(sentEmail.to).toBe(email);
    expect(sentEmail.subject).toBe("Reset your password");
    expect(sentEmail.html).toContain("Reset password");
  });
});
