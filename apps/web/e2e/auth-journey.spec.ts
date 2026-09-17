import { expect, test } from "@playwright/test";

import { E2E_CUSTOMER_EMAIL, E2E_PASSWORD } from "./fixtures/seed";

test("sign up shows a check-your-email state instead of auto sign-in", async ({ page }) => {
  const email = `e2e-signup-${test.info().workerIndex}-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await page.locator("#name").fill("New Adventurer");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText(email)).toBeVisible();
  await expect(
    page.getByText(/Check your email for a verification link, then/),
  ).toBeVisible();
  await expect(page.locator("p").filter({ hasText: email }).getByRole("link", { name: "sign in" })).toBeVisible();

  // Better Auth's requireEmailVerification means no session was created.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("guest cart merges into the account cart on sign in", async ({ page }) => {
  await page.goto("/product/wooden-buckler");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText("Added to cart.")).toBeVisible();

  await page.goto("/sign-in");
  await page.locator("#email").fill(E2E_CUSTOMER_EMAIL);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/account/);

  await page.goto("/cart");
  await expect(page.getByText("Wooden Buckler")).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
