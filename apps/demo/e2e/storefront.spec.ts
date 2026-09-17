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

test("Portuguese selection translates interactive feedback", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { document.cookie = "medivi-locale=pt-BR; path=/"; });
  await page.goto("/product/dragonbone-greatsword");

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByText("Adicionado ao carrinho da demo")).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("button", { name: "Restaurar padrões" }).click();
  await expect(page.getByText("Dados da demo restaurados")).toBeVisible();
});

test("product zoom activates when navigation leaves the cursor over the image", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/catalog");
  await page.getByRole("link", { name: /Dragonbone Greatsword Featured/i }).click({ position: { x: 100, y: 100 } });

  await expect(page.getByRole("heading", { name: "Dragonbone Greatsword" })).toBeVisible();
  await expect(page.getByTestId("product-zoom-lens")).toBeVisible();
});

test("every gallery selection retains zoom for its product", async ({ page }) => {
  for (const [slug, name] of [["dragonbone-greatsword", "Dragonbone Greatsword"], ["shadowweave-cloak", "Shadowweave Cloak"]]) {
    await page.goto(`/product/${slug}`);
    const gallery = page.getByRole("group", { name: "Product images" });
    for (let image = 1; image <= 3; image++) {
      const selection = gallery.getByRole("button", { name: `Show image ${image} of 3` });
      await selection.click();
      await expect(selection).toHaveAttribute("aria-pressed", "true");
      const mainImage = page.getByRole("img", { name: `${name} — Photo ${image}` });
      await mainImage.hover();
      await expect(page.getByTestId("product-zoom-lens")).toBeVisible();
    }
  }
});
