import { expect, test } from "@playwright/test";

const STALE_DISCOVERY_QUESTION = /which genre|what genre|what kind of movie|what are you in the mood for/iu;
const STALE_ARABIC_DISCOVERY_QUESTION = /أي نوع|ما نوع|ماذا تفضل/iu;

async function sendText(page, text) {
  const input = page.locator("input[aria-label]").last();
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
}

async function waitForDateOrMovies(page) {
  await expect.poll(async () => {
    const dateVisible = await page.getByRole("group", { name: "Choose a date" }).isVisible().catch(() => false);
    const moviesVisible = await page.getByText("Choose a movie", { exact: true }).isVisible().catch(() => false);
    return dateVisible || moviesVisible;
  }).toBe(true);
}

async function reachMovieGridByText(page, preference) {
  await sendText(page, `${preference} at Mall of the Emirates`);
  await waitForDateOrMovies(page);

  const dateGroup = page.getByRole("group", { name: "Choose a date" });
  if (await dateGroup.isVisible().catch(() => false)) {
    const firstDate = dateGroup.getByRole("button").first();
    const dateChoice = (await firstDate.getAttribute("aria-label")) || (await firstDate.innerText());
    await sendText(page, dateChoice.replace(/^[^,]+,\s*/, ""));
  }

  await expect(page.getByText("Choose a movie", { exact: true })).toBeVisible();
  const cards = page.locator('main button:has([aria-label^="Relevant showtimes for "])');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count(), "Text discovery should render at least one matching movie").toBeGreaterThan(0);
  return cards;
}

async function reachCheckoutByText(page) {
  const cards = await reachMovieGridByText(page, "Show me any movie");
  const firstMovie = cards.first();
  const movieAria = await firstMovie.locator('[aria-label^="Relevant showtimes for "]').getAttribute("aria-label");
  const movieTitle = String(movieAria || "").replace(/^Relevant showtimes for\s+/i, "").trim();
  expect(movieTitle).not.toBe("");
  await sendText(page, `I choose ${movieTitle}`);

  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  const showtimeButton = page.locator("main button").filter({ hasText: /\d{1,2}:\d{2}/ }).first();
  await expect(showtimeButton).toBeVisible();
  const showtimeChoice = (await showtimeButton.getAttribute("aria-label")) || (await showtimeButton.innerText());
  await sendText(page, `Choose ${showtimeChoice}`);

  await expect(page.getByText(/Tap seats/).first()).toBeVisible();
  const availableSeats = page.locator('main button[aria-label^="Seat "]:not([disabled])');
  expect(await availableSeats.count()).toBeGreaterThanOrEqual(2);
  const seatLabels = [];
  for (let index = 0; index < 2; index += 1) {
    const label = await availableSeats.nth(index).getAttribute("aria-label");
    const match = String(label || "").match(/^Seat\s+([A-Z]\d+)/i);
    expect(match, "Available seats must expose a conversational seat label").toBeTruthy();
    seatLabels.push(match[1]);
  }
  await sendText(page, `Select seats ${seatLabels[0]} and ${seatLabels[1]}`);
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i, (route) => route.abort("blockedbyclient"));
  await page.routeWebSocket(/^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i, (socket) => socket.close());
  await page.goto("/");
  await expect(page.locator(".voxi-widget")).toBeVisible();
});

test("typed horror discovery keeps the response synchronized with the rendered movies", async ({ page }) => {
  await reachMovieGridByText(page, "Show me horror movies");
  await expect(page.locator("main")).not.toContainText(STALE_DISCOVERY_QUESTION);
});

test("Arabic typed date is consumed once and renders the retained horror results", async ({ page }) => {
  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "أريد أفلام رعب في مول الإمارات");
  const dateGroup = page.getByRole("group", { name: "اختر التاريخ" });
  await expect(dateGroup).toBeVisible();
  const firstDate = dateGroup.getByRole("button").first();
  const displayedDate = (await firstDate.getAttribute("aria-label")) || (await firstDate.innerText());
  await sendText(page, displayedDate.replace(/^[^،,]+[،,]\s*/, ""));

  await expect(page.getByRole("heading", { name: "اختر فيلماً" })).toBeVisible();
  const cards = page.getByRole("region", { name: "اختر فيلماً" }).getByRole("button");
  await expect(cards.first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/لم أتمكن من مطابقة/u);
  await expect(page.locator("main")).not.toContainText(STALE_ARABIC_DISCOVERY_QUESTION);
});

test("typed journey reaches the test gateway and validates every published outcome", async ({ page }) => {
  await reachCheckoutByText(page);
  await expect(page.getByRole("heading", { name: "Test payment gateway" })).toBeVisible();

  await sendText(page, "save booking summary");
  await expect(page.getByRole("heading", { name: "Test payment gateway" })).toBeVisible();
  await expect(page.getByText(/Validate a method in the test gateway before saving/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Save validated checkout summary/ })).toBeDisabled();

  await page.getByRole("button", { name: /Not eligible test card/ }).click();
  await expect(page.getByText("This test card is not eligible for the card offer.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Save validated checkout summary/ })).toBeDisabled();

  await page.getByRole("button", { name: /Eligible test card/ }).click();
  await expect(page.getByText(/Eligible for the 20% test card offer/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Save validated checkout summary/ })).toBeEnabled();

  await page.getByRole("button", { name: "VOX Wallet" }).click();
  await page.getByRole("button", { name: "Validate wallet balance" }).click();
  await expect(page.getByText(/VOX Wallet balance is sufficient/)).toBeVisible();

  await page.getByRole("button", { name: "SHARE points" }).click();
  await page.getByRole("button", { name: "Validate SHARE points" }).click();
  await expect(page.getByText(/SHARE points balance is sufficient/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Save validated checkout summary/ })).toBeEnabled();
});
