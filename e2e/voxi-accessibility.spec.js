import { expect, test } from "@playwright/test";

async function expectNoParentOverflow(page, viewportLabel) {
  const dimensions = await page.locator(".voxi-widget").evaluate((widget) => {
    const main = widget.querySelector("main");
    return {
      widgetScrollWidth: widget.scrollWidth,
      widgetClientWidth: widget.clientWidth,
      mainScrollWidth: main?.scrollWidth ?? 0,
      mainClientWidth: main?.clientWidth ?? 0,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    };
  });

  expect(dimensions.widgetScrollWidth, `${viewportLabel} widget must not overflow`).toBeLessThanOrEqual(dimensions.widgetClientWidth);
  expect(dimensions.mainScrollWidth, `${viewportLabel} conversation must not overflow`).toBeLessThanOrEqual(dimensions.mainClientWidth);
  expect(dimensions.documentScrollWidth, `${viewportLabel} document must not overflow`).toBeLessThanOrEqual(dimensions.documentClientWidth);
}

test.beforeEach(async ({ page }) => {
  await page.route(
    /^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (route) => route.abort("blockedbyclient"),
  );
  await page.routeWebSocket(
    /^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (socket) => socket.close(),
  );
});

test("rich stages are named, announced, and usable at narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto("/");
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expectNoParentOverflow(page, "420px");

  await page.getByRole("button", { name: "Choose VOX cinema" }).first().click();

  const announcement = page.locator("[data-voxi-stage-announcement]");
  const cinemaRegion = page.getByRole("region", { name: "Choose your cinema" });
  await expect(cinemaRegion).toBeVisible();
  await expect(cinemaRegion.getByRole("heading", { level: 2, name: "Choose your cinema" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search cinemas" })).toBeVisible();
  await expect(announcement).toHaveText("Choose your cinema");
  await expect(announcement).not.toBeFocused();

  await page.getByRole("searchbox", { name: "Search cinemas" }).fill("Mall of the Emirates");
  await page.getByRole("button", { name: /Mall of the Emirates/ }).click();
  const dateGroup = page.getByRole("group", { name: "Choose a date" });
  await expect(dateGroup).toBeVisible();
  const dateButtons = dateGroup.getByRole("button");
  await dateButtons.nth((await dateButtons.count()) > 1 ? 1 : 0).click();

  const input = page.locator("input[aria-label]").last();
  await input.fill("anything is fine");
  await input.press("Enter");

  const movieRegion = page.getByRole("region", { name: "Choose a movie" });
  await expect(movieRegion).toBeVisible();
  await expect(movieRegion.getByRole("heading", { level: 2, name: "Choose a movie" })).toBeVisible();
  await expect(announcement).toContainText("Choose a movie");

  const movieCard = page.locator('main button:has([aria-label^="Relevant showtimes for "])').first();
  await expect(movieCard).toBeVisible();
  const movieTitle = (await movieCard.locator('span[dir="auto"]').first().innerText()).trim();
  await movieCard.click();

  const showtimeRegion = page.getByRole("region", { name: movieTitle, exact: true });
  await expect(showtimeRegion).toBeVisible();
  await expect(showtimeRegion.getByRole("heading", { level: 2, name: movieTitle, exact: true })).toBeVisible();
  await expect(announcement).toContainText("Select a showtime");
  await expect(announcement).toContainText(movieTitle);

  const showtimeButton = showtimeRegion.getByRole("button").filter({ hasText: /\d{1,2}:\d{2}/ }).first();
  await expect(showtimeButton).toBeVisible();
  await showtimeButton.click();

  const seatRegion = page.getByRole("region", { name: new RegExp(movieTitle) });
  await expect(seatRegion.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(announcement).toContainText("Tap seats");
  await expect(announcement).toContainText(movieTitle);

  const seatButtons = seatRegion.locator('button[aria-label^="Seat "]');
  expect(await seatButtons.count(), "Seat map must expose seat controls").toBeGreaterThan(0);
  const undersizedSeats = await seatButtons.evaluateAll((buttons) => buttons
    .map((button) => {
      const rect = button.getBoundingClientRect();
      return { name: button.getAttribute("aria-label"), width: rect.width, height: rect.height };
    })
    .filter(({ width, height }) => width < 24 || height < 24));
  expect(undersizedSeats, "Every seat target must be at least 24px in both dimensions").toEqual([]);
  await expectNoParentOverflow(page, "420px seat map");

  await page.setViewportSize({ width: 320, height: 900 });
  await expectNoParentOverflow(page, "320px seat map");
  const seatScroll = seatRegion.locator("[data-voxi-seat-scroll]");
  const narrowSeatGeometry = await seatScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(narrowSeatGeometry.scrollWidth).toBeGreaterThan(narrowSeatGeometry.clientWidth);
  const narrowSeat = await seatButtons.first().boundingBox();
  expect(narrowSeat?.width).toBeGreaterThanOrEqual(24);
  expect(narrowSeat?.height).toBeGreaterThanOrEqual(24);

  const availableSeats = seatRegion.locator('button[aria-label^="Seat "]:not([disabled])');
  await availableSeats.nth(0).click();
  await availableSeats.nth(1).click();
  await expect(seatRegion.getByText("2 seats:", { exact: false })).toBeVisible();
  await seatRegion.getByRole("button", { name: "Confirm seats", exact: true }).click();

  const checkoutRegion = page.getByRole("region", { name: "Checkout review" });
  await expect(checkoutRegion).toBeVisible();
  await expect(checkoutRegion.getByRole("heading", { level: 2, name: "Checkout review" })).toBeVisible();
  await expect(announcement).toHaveText("Checkout review");
  await expectNoParentOverflow(page, "320px checkout");
});
