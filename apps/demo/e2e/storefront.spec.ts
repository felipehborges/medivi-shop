import { expect, test } from "@playwright/test";

test("browse-to-confirmation stays in the browser", async ({ page }) => {
  const applicationRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) applicationRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Medivi" })).toBeVisible();
  await page.getByRole("link", { name: /Enter the armory/i }).click();
  await page.getByRole("link", { name: /Dragonbone Greatsword/i }).first().click();
  await page.getByRole("button", { name: /Add to the satchel/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("medivi-demo-state-v1"))).not.toBeNull();

  await page.reload();
  await page.getByRole("link", { name: "Bill of lading" }).click();
  await expect(page.getByText("$320.00").first()).toBeVisible();
  await page.getByRole("link", { name: /To the ledger/i }).click();
  await page.getByPlaceholder("Aldric of Hollowfen").fill("Aldric of Hollowfen");
  await page.getByPlaceholder("Third house past the tanner").fill("Third house past the tanner");
  await page.getByPlaceholder("Vael").fill("Vael");
  await page.getByPlaceholder("Aster").fill("Aster");
  await page.getByRole("button", { name: /To the seal/i }).click();
  await page.getByRole("button", { name: /Press the seal/i }).click();
  await expect(page.getByRole("heading", { name: "Sealed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bill of lading" })).toContainText("—");
  expect(applicationRequests).toEqual([]);
});

test("Portuguese selection translates interactive feedback", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { document.cookie = "medivi-locale=pt-BR; path=/"; });
  await page.goto("/product/dragonbone-greatsword");

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.getByRole("button", { name: /Colocar na bolsa/i }).click();
  await expect(page.getByText("Adicionado ao carrinho da demo")).toBeVisible();

  await page.goto("/admin");
  await page.getByRole("button", { name: "Restaurar padrões" }).click();
  await expect(page.getByText("Dados da demo restaurados")).toBeVisible();
});

test("product zoom activates when navigation leaves the cursor over the image", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/catalog");
  await page.getByRole("link", { name: /Dragonbone Greatsword/i }).first().click({ position: { x: 100, y: 100 } });

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
