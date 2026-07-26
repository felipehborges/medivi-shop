import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@medivi/db/client";
import { account, session, user, verification } from "@medivi/db/schema";
import { renderResetPasswordEmail, renderVerifyEmailEmail, renderWelcomeEmail } from "@medivi/email";
import { env } from "./env";
import { getEmailProvider } from "./email";

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    // Phase 8 wired a real EmailProvider, so verification mail can actually
    // be delivered now — this was deliberately false until then (see
    // CLAUDE.md/docs/tasks.md Phase 2 note).
    requireEmailVerification: true,
    async sendResetPassword({ user: resetUser, url }) {
      const { subject, html } = await renderResetPasswordEmail({ name: resetUser.name, resetUrl: url });
      await getEmailProvider().send({ to: resetUser.email, subject, html });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user: verifyUser, url }) {
      const { subject, html } = await renderVerifyEmailEmail({ name: verifyUser.name, verifyUrl: url });
      await getEmailProvider().send({ to: verifyUser.email, subject, html });
    },
  },
  databaseHooks: {
    user: {
      create: {
        async after(createdUser) {
          const { subject, html } = await renderWelcomeEmail({
            name: createdUser.name,
            shopUrl: env.NEXT_PUBLIC_APP_URL,
          });
          await getEmailProvider().send({ to: createdUser.email, subject, html });
        },
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: "customer",
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
