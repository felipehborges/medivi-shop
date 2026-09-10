import { expect, test } from "@playwright/test";

test("browse-to-confirmation stays in the browser", async ({ page }) => {
  const applicationRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) applicationRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Gear for those who answer the call." })).toBeVisible();
  await page.getByRole("link", { name: /Enter the armory/i }).click();
  await page.getByRole("link", { name: /Dragonbone Greatsword Featured/i }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("medivi-demo-state-v1"))).not.toBeNull();

  await page.reload();
  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page.getByText("$320.00").first()).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page.getByText("Everything stays in this browser.")).toBeVisible();
  await page.getByRole("button", { name: /Continue to simulation/i }).click();

  await page.getByRole("button", { name: "Simulate decline" }).click();
  await expect(page.getByText(/cart was preserved/i)).toBeVisible();
  await page.getByRole("button", { name: "Simulate approval" }).click();
  await expect(page.getByRole("heading", { name: "Your quest is confirmed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart" })).toHaveText("");
  expect(applicationRequests).toEqual([]);
});
