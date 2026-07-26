import { z } from "zod";

/**
 * Single source of truth for every environment variable the app reads.
 * Import `env` (never `process.env` directly) so a missing/invalid value
 * fails fast at boot with a clear message instead of surfacing as a
 * confusing runtime error deep in a provider implementation.
 *
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().url(),

  BETTER_AUTH_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Medivi Shop <no-reply@medivi.shop>"),

  STORAGE_PROVIDER: z.enum(["s3", "vercel-blob"]).default("s3"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

function loadEnv() {
  // Unset optional vars round-trip through .env as empty strings, not
  // `undefined` — normalize so `.optional()` actually skips validation
  // instead of failing string/url checks on "".
  const normalized = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      value === "" ? undefined : value,
    ]),
  );

  const parsed = envSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
