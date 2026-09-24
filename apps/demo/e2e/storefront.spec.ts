import { expect, test, type Page } from "@playwright/test";

async function addGreatsword(page: Page) {
  await page.goto("/product/dragonbone-greatsword");
  await page
    .getByRole("button", { name: "Add to the satchel", exact: true })
    .click();
}
async function fillLedger(page: Page) {
  await page.getByLabel("Name of bearer").fill("Aldric of Hollowfen");
  await page.getByLabel("Road and house").fill("Third house past the tanner");
  await page.getByLabel("Town", { exact: true }).fill("Vael");
  await page.getByLabel("Kingdom", { exact: true }).fill("Aster");
}

test("manifest, carriage and seal preserve the browser-only order", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  await addGreatsword(page);
  await page.reload();
  await page.getByRole("link", { name: "Cart, 1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bill of lading" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Decrease quantity" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "To the ledger", exact: true }).click();
  await fillLedger(page);
  await page.getByText("Raven and courier", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Raven and courier/ })).toBeChecked();
  await expect(page.locator(".due strong")).toHaveText("$344.00");
  await page.getByRole("button", { name: "To the seal", exact: true }).click();
  await expect(page.locator(".large-price")).toHaveText("$344.00");
  await page.getByText("Simulate decline", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Simulate decline", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Payment simulation declined." }),
  ).toContainText("cart was preserved");
  await page
    .getByRole("button", { name: "Press the seal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sealed", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".entry-number strong")).toHaveText("MMXCI–1147");
  await page.reload();
  await expect(page.locator(".entry-number strong")).toHaveText("MMXCI–1147");
  await expect(
    page.getByRole("link", { name: "Cart, 0", exact: true }),
  ).toBeVisible();
  const order = await page.evaluate(
    () => JSON.parse(localStorage.getItem("medivi-demo-state-v1")!).orders[0],
  );
  expect(order.totalCents).toBe(34400);
  expect(requests).toEqual([]);
});

test("Portuguese copy, watchlist and keyboard zoom", async ({ page }) => {
  await page.goto("/product/dragonbone-greatsword");
  await page.getByRole("button", { name: "Mudar para português" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(
    page.getByRole("heading", { name: "Espadão de Osso de Dragão" }),
  ).toBeVisible();
  const zoom = page.getByRole("button", {
    name: "Ampliar Espadão de Osso de Dragão",
  });
  await zoom.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(zoom).toBeFocused();
  await page
    .getByRole("button", { name: "Anotar na lista", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Livro de vigia, 1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Espadão de Osso de Dragão" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Parar de vigiar" }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma peça em vigia ainda." }),
  ).toBeVisible();
});

test("department navigation and search remain in sync", async ({ page }) => {
  await page.goto("/catalog?department=relics");
  await expect(page.locator(".ware-card")).toHaveCount(2);
  await page
    .getByRole("navigation", { name: "Departments", exact: true })
    .getByRole("link", { name: "The Armory", exact: true })
    .click();
  await expect(page.locator(".ware-card")).toHaveCount(3);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Relics", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ware-card")).toHaveCount(2);
  await page.getByLabel("Ask the merchant").fill("   Northern Marches   ");
  await expect(page.locator(".ware-card")).toHaveCount(1);
  await page.getByLabel("Ask the merchant").fill("nothing-matches-this");
  await expect(
    page.getByRole("heading", { name: "Nothing of that description" }),
  ).toBeVisible();
});

test("quantity is clamped and explicit removal clears the manifest", async ({
  page,
}) => {
  await addGreatsword(page);
  await page
    .getByRole("button", { name: "Add to the satchel", exact: true })
    .click();
  await page.getByRole("link", { name: "Cart, 2", exact: true }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(
    page.getByRole("button", { name: "Increase quantity" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Strike out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing set aside yet." }),
  ).toBeVisible();
});

test("mobile menu closes on Escape and counter navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.getByRole("link", { name: "Cart, 0", exact: true }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Mudar para português" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test("magnifier follows the photo and leaves its frame cleanly", async ({
  page,
}) => {
  await page.goto("/product/dragonbone-greatsword");
  const photo = page.locator(".product-frame--detail .product-photo");
  await expect
    .poll(() =>
      photo
        .locator("img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await photo.hover();
  await expect(page.getByTestId("product-zoom-lens")).toBeVisible();
  await page.locator("h1").hover();
  await expect(page.getByTestId("product-zoom-lens")).toHaveCount(0);
});

for (const width of [360, 768, 1024, 1440]) {
  test(`all screens fit at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await addGreatsword(page);
    await page
      .getByRole("button", { name: "Set on the watchlist", exact: true })
      .click();
    for (const path of [
      "/",
      "/catalog",
      "/product/dragonbone-greatsword",
      "/product/mithril-chestplate",
      "/cart",
      "/checkout",
      "/payment",
      "/wishlist",
      "/admin",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path,
      ).toBe(true);
      for (const image of await page.locator("img").all()) {
        if (!(await image.isVisible())) continue;
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(
            () =>
              image.evaluate(
                (element) => (element as HTMLImageElement).naturalWidth,
              ),
            { message: path },
          )
          .toBeGreaterThan(0);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 360 || width === 1440)
        await page.screenshot({
          path: testInfo.outputPath(
            `${path.replaceAll("/", "-") || "home"}.png`,
          ),
          fullPage: true,
        });
    }
    await page.goto("/checkout");
    await fillLedger(page);
    await page
      .getByRole("button", { name: "To the seal", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Press the seal", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sealed", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("confirmation.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
