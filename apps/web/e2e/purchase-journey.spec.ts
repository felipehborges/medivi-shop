import { expect, test } from "@playwright/test";

test("guest browses, filters, adds to cart, and completes checkout via mock payment", async ({
  page,
}) => {
  await page.goto("/catalog/swords");
  await expect(page.getByRole("heading", { name: "Swords", level: 1 })).toBeVisible();

  await page.getByLabel("Material").selectOption("Iron");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/material=Iron/);

  await page.getByRole("link", { name: /Iron Longsword/ }).first().click();
  await expect(page).toHaveURL(/\/product\/iron-longsword/);
  await expect(page.getByRole("heading", { name: "Iron Longsword" })).toBeVisible();

  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText("Added to cart.")).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText("Iron Longsword")).toBeVisible();

  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  const checkoutForm = page.getByRole("main");
  await checkoutForm.locator("#guestEmail").fill("guest-purchase@example.com");
  await checkoutForm.locator("#fullName").fill("Guest Adventurer");
  await checkoutForm.locator("#line1").fill("1 Market Square");
  await checkoutForm.locator("#city").fill("Rivermoor");
  await checkoutForm.locator("#region").fill("CA");
  await checkoutForm.locator("#postalCode").fill("94016");
  await page.getByLabel(/Standard Shipping/).check();

  await page.getByRole("button", { name: /^Pay \$/ }).click();

  await expect(page).toHaveURL(/\/checkout\/mock\//);
  await expect(page.getByText("Mock payment processor")).toBeVisible();

  await page.getByRole("button", { name: "Approve payment" }).click();

  await expect(page).toHaveURL(/\/order\/confirmation\//);
  await expect(page.getByText("Thank you for your order!")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/A confirmation has been recorded for order/)).toBeVisible();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
});
