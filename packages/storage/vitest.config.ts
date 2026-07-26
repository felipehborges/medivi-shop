import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // No unit tests yet — both providers are thin wrappers around the AWS SDK
    // / Vercel Blob SDK with nothing meaningfully testable without mocking
    // the SDK entirely; exercised indirectly via the admin image-upload
    // action tests in apps/web instead.
    passWithNoTests: true,
  },
});
