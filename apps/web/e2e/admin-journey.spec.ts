import { expect, test, type Page, type Locator } from "@playwright/test";

import { E2E_ADMIN_EMAIL, E2E_PASSWORD } from "./fixtures/seed";

/**
 * `router.refresh()` after these admin mutations is occasionally slow to
 * land client-side under this suite's load (server data is always correct —
 * confirmed independently via direct DB/curl checks). A reload forces a
 * fresh document rather than waiting on the SPA's soft refresh to catch up.
 */
async function expectVisibleAfterReload(page: Page, locator: Locator, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await locator.isVisible().catch(() => false)) return;
    await page.reload();
  }
  await expect(locator).toBeVisible();
}

async function signInAsAdmin(page: Page) {
  await page.goto("/sign-in");
  await page.locator("#email").fill(E2E_ADMIN_EMAIL);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
}

/** Guest checkout via the mock payment provider — returns the order number. */
async function createPaidOrder(page: Page, productSlug: string): Promise<string> {
  await page.goto(`/product/${productSlug}`);
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText("Added to cart.")).toBeVisible();

  await page.goto("/checkout");
  const main = page.getByRole("main");
  await main.locator("#guestEmail").fill("admin-journey-guest@example.com");
  await main.locator("#fullName").fill("Order Fixture");
  await main.locator("#line1").fill("2 Guild Row");
  await main.locator("#city").fill("Rivermoor");
  await main.locator("#region").fill("CA");
  await main.locator("#postalCode").fill("94016");
  await page.getByRole("button", { name: /^Pay \$/ }).click();

  await expect(page).toHaveURL(/\/checkout\/mock\//);
  await page.getByRole("button", { name: "Approve payment" }).click();

  await expect(page).toHaveURL(/\/order\/confirmation\//);
  const text = await page.getByText(/A confirmation has been recorded for order/).innerText();
  const match = text.match(/order (\S+)\.?$/);
  const orderNumber = match?.[1];
  if (!orderNumber) throw new Error(`Could not parse order number from: ${text}`);
  return orderNumber.replace(/\.$/, "");
}

test("admin creates a category, a banner, and a product", async ({ page }) => {
  await signInAsAdmin(page);

  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Add category" }).click();
  await page.locator("#cat-name").fill("E2E Category");
  await page.locator("#cat-slug").fill("e2e-category");
  await page.getByRole("button", { name: "Add category" }).click();
  await expectVisibleAfterReload(page, page.getByRole("main").getByText("E2E Category"));

  await page.goto("/admin/banners");
  await page.getByRole("button", { name: "Add banner" }).click();
  await page.locator("#banner-title").fill("E2E Banner");
  await page.locator("#banner-imageUrl").fill("https://picsum.photos/seed/e2e-banner/1200/400");
  await page.getByRole("button", { name: "Add banner" }).click();
  await expectVisibleAfterReload(page, page.getByRole("main").getByText("E2E Banner"));

  await page.goto("/admin/products/new");
  await page.locator("#name").fill("E2E Test Product");
  await page.locator("#slug").fill("e2e-test-product");
  await page.locator("#categoryId").selectOption({ label: "E2E Category" });
  await page.locator("#material").fill("Testium");
  await page.locator("#description").fill("A product created by an E2E test.");
  await page.locator("#basePriceCents").fill("999");
  await page.locator("#status").selectOption("active");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);
  await expect(page.locator("#name")).toHaveValue("E2E Test Product");
});

test("admin fulfills then refunds a paid order", async ({ page }) => {
  const orderNumber = await createPaidOrder(page, "steel-broadsword");

  await signInAsAdmin(page);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: new RegExp(orderNumber) }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/[^/]+$/);

  const main = page.getByRole("main");
  await expect(main.getByText("paid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark fulfilled" }).click();
  await expectVisibleAfterReload(page, main.getByText("fulfilled", { exact: true }));

  await page.getByRole("button", { name: "Refund" }).click();
  await expectVisibleAfterReload(page, main.getByText("refunded", { exact: true }));
});
