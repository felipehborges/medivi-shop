import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  expect: {
    // A client mutation followed by `router.refresh()` (most admin CRUD
    // forms) can take longer than the 5s default to land under load —
    // bump rather than chase each assertion individually.
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Runs against a production build, not `next dev` — Turbopack's dev-mode
  // Suspense/streaming has a known bug (see docs/tasks.md Phase 10 notes)
  // where `loading.tsx` boundaries can get stuck rendering only the
  // fallback. `next start` doesn't hit it.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          PAYMENT_PROVIDER: "mock",
        },
      },
});
