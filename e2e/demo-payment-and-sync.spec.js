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
    const nextDate = dateGroup.getByRole("button").nth(1);
    const dateChoice = (await nextDate.getAttribute("aria-label")) || (await nextDate.innerText());
    await sendText(page, dateChoice.replace(/^[^,]+,\s*/, ""));
  }

  await expect(page.getByText("Choose a movie", { exact: true })).toBeVisible();
  const cards = page.locator('main button:has([aria-label^="Relevant showtimes for "])');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count(), "Text discovery should render at least one matching movie").toBeGreaterThan(0);
  return cards;
}

async function reachCheckoutByText(page, { seatCount = 2 } = {}) {
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
  expect(await availableSeats.count()).toBeGreaterThanOrEqual(seatCount);
  const seatLabels = [];
  for (let index = 0; index < seatCount; index += 1) {
    const label = await availableSeats.nth(index).getAttribute("aria-label");
    const match = String(label || "").match(/^Seat\s+([A-Z]\d+)/i);
    expect(match, "Available seats must expose a conversational seat label").toBeTruthy();
    seatLabels.push(match[1]);
  }
  await sendText(page, seatCount === 1
    ? `Select seat ${seatLabels[0]}`
    : `Select seats ${seatLabels.join(" and ")}`);
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
}

async function selectedMovieTitleFromGrid(page) {
  const cards = await reachMovieGridByText(page, "Show me any movie");
  const firstMovie = cards.first();
  const movieAria = await firstMovie.locator('[aria-label^="Relevant showtimes for "]').getAttribute("aria-label");
  const movieTitle = String(movieAria || "").replace(/^Relevant showtimes for\s+/i, "").trim();
  expect(movieTitle).not.toBe("");
  return movieTitle;
}

async function reachShowtimesByText(page) {
  const movieTitle = await selectedMovieTitleFromGrid(page);
  await sendText(page, movieTitle);
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  return movieTitle;
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

test("a movie title supplied before cinema and date is selected without being requested again", async ({ page }) => {
  const movieTitle = await selectedMovieTitleFromGrid(page);
  await page.getByRole("button", { name: "Start a new conversation" }).click();

  await sendText(page, movieTitle);
  await expect(page.getByRole("heading", { name: "Choose your cinema" })).toBeVisible();
  await sendText(page, "Mall of the Emirates");
  const dateGroup = page.getByRole("group", { name: "Choose a date" });
  await expect(dateGroup).toBeVisible();
  const nextDate = dateGroup.getByRole("button").nth(1);
  const dateChoice = (await nextDate.getAttribute("aria-label")) || (await nextDate.innerText());
  await sendText(page, dateChoice.replace(/^[^,]+,\s*/, ""));

  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  await expect(page.locator("main")).toContainText(`${movieTitle} is selected.`);
  await expect(page.locator("main")).not.toContainText(/Type the movie title to choose it/);
});

test("an unmatched typed showtime hour keeps the rendered showtime options visible in English and Arabic", async ({ page }) => {
  await reachShowtimesByText(page);
  const showtimeButtons = page.locator("main button").filter({ hasText: /\d{1,2}:\d{2}/ });
  const initialCount = await showtimeButtons.count();
  expect(initialCount).toBeGreaterThan(0);
  const visibleHours = new Set();
  for (let index = 0; index < initialCount; index += 1) {
    const text = await showtimeButtons.nth(index).innerText();
    const match = text.match(/(\d{1,2}):\d{2}/);
    if (match) visibleHours.add((Number(match[1]) % 12) || 12);
  }
  const unmatchedHour = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 12].find((hour) => !visibleHours.has(hour));
  expect(unmatchedHour).toBeTruthy();

  await sendText(page, String(unmatchedHour));
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  await expect(showtimeButtons).toHaveCount(initialCount);
  await expect(page.locator("main")).toContainText("The current options remain visible");

  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, String(unmatchedHour));
  await expect(showtimeButtons).toHaveCount(initialCount);
  await expect(page.locator("main")).toContainText("بقيت مواعيد العرض ظاهرة");
});

test("typed journey reaches final review and processes a three-way payment", async ({ page }) => {
  await reachCheckoutByText(page);
  await expect(page.getByTestId("dummy-payment-gateway")).toBeVisible();
  await expect(page.getByTestId("combined-payment-options")).toBeVisible();
  await expect(page.getByTestId("combined-payment-options")).toContainText("Available SHARE balance: 200 points worth AED 20");
  await expect(page.getByTestId("combined-payment-options")).toContainText("Wallet balance AED 30");

  await sendText(page, "pay now");
  await expect(page.getByTestId("dummy-payment-gateway")).toBeVisible();
  await expect(page.getByTestId("process-dummy-payment")).toHaveCount(0);
  await expect(page.getByTestId("review-dummy-payment")).toBeDisabled();

  await page.getByTestId("dummy-payment-gateway").getByLabel("Card offer").selectOption("fab-share");
  await page.getByTestId("payment-card-select").selectOption({ label: "**** **** **** 4444" });
  await expect(page.getByText("This card is not eligible for the selected offer.")).toBeVisible();
  await expect(page.getByTestId("review-dummy-payment")).toBeDisabled();

  await page.getByTestId("payment-card-select").selectOption({ label: "**** **** **** 1111" });
  await expect(page.getByText("Eligible for the selected offer").last()).toBeVisible();
  await expect(page.getByTestId("payment-card-select")).toContainText("**** **** **** 1111");
  await expect(page.getByTestId("dummy-payment-gateway")).not.toContainText("4111 1111 1111 1111");
  await page.getByLabel("Card CVV").fill("123");

  await page.getByLabel("Use SHARE points").check();
  await page.getByLabel("SHARE points to redeem").fill("201");
  await expect(page.getByText("You have 200 SHARE points available. Enter 200 points or fewer.")).toBeVisible();
  await expect(page.getByTestId("review-dummy-payment")).toBeDisabled();
  await page.getByLabel("SHARE points to redeem").fill("150");
  await page.getByLabel("Use VOX Wallet").check();
  await page.getByLabel("Wallet value in AED").fill("10");

  await expect(page.getByText(/Offer discount/).locator("..")).toContainText(/AED\s*42\.00/);
  await expect(page.getByText(/Equivalent AED discount/).locator("..")).toContainText(/AED\s*15\.00/);
  await expect(page.getByText(/Remaining amount to be paid/).locator("..")).toContainText(/AED\s*27\.00/);
  await expect(page.getByText(/Card remainder/).locator("..")).toContainText(/AED\s*17\.00/);
  await expect(page.getByTestId("review-dummy-payment")).toBeEnabled();
  await page.getByTestId("review-dummy-payment").click();
  await expect(page.getByText("Final payment summary")).toBeVisible();
  await expect(page.getByText("Points redeemed").locator("..")).toContainText(/150 points/);
  await expect(page.getByText("Equivalent AED discount").locator("..")).toContainText(/AED\s*15\.00/);
  await expect(page.getByText("Remaining amount to be paid").locator("..")).toContainText(/AED\s*27\.00/);
  await expect(page.getByText("VOX Wallet").locator("..")).toContainText(/AED\s*10\.00/);
  await page.getByTestId("process-dummy-payment").click();
  await expect(page.getByText("Processing payment")).toBeVisible();
  await expect(page.getByText("Payment receipt")).toBeVisible();
  await expect(page.getByText(/Payment processed successfully/)).toBeVisible();
  await expect(page.getByText(/^WL[A-HJ-NP-Z2-9]{5}$/).first()).toBeVisible();
});

test("SHARE points and VOX Wallet fully fund checkout without card or CVV", async ({ page }) => {
  await reachCheckoutByText(page, { seatCount: 1 });
  await expect(page.getByTestId("combined-payment-options")).toContainText("200 points = AED 20.00");
  await expect(page.getByText("No card or CVV is required because SHARE points and VOX Wallet cover the full amount.")).toBeVisible();
  await expect(page.getByTestId("payment-card-select")).toHaveCount(0);
  await expect(page.getByLabel("Card CVV")).toHaveCount(0);
  await expect(page.getByText(/Card remainder/).locator("..")).toContainText(/AED\s*0\.00/);
  await expect(page.getByTestId("review-dummy-payment")).toBeEnabled();

  await page.getByTestId("review-dummy-payment").click();
  await expect(page.getByText("Final payment summary")).toBeVisible();
  await expect(page.getByText("Points redeemed").locator("..")).toContainText(/200 points/);
  await expect(page.getByText("Equivalent AED discount").locator("..")).toContainText(/AED\s*20\.00/);
  await expect(page.getByText("Card used", { exact: true })).toHaveCount(0);

  await page.getByTestId("process-dummy-payment").click();
  await expect(page.getByText("Payment receipt")).toBeVisible();
  await expect(page.getByText("Card used", { exact: true })).toHaveCount(0);
});

test("Arabic checkout processes a combined SHARE, wallet, and card payment", async ({ page }) => {
  await reachCheckoutByText(page);
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.getByTestId("dummy-payment-gateway")).toBeVisible();

  await page.getByTestId("payment-card-select").selectOption({ label: "**** **** **** 1111" });
  await page.getByLabel("رمز CVV").fill("123");
  await page.getByLabel("استخدام نقاط SHARE").check();
  await page.getByLabel("نقاط SHARE المراد استخدامها").fill("201");
  await expect(page.getByText(/رصيدك المتاح .* نقاط SHARE/)).toBeVisible();
  await expect(page.getByTestId("review-dummy-payment")).toBeDisabled();
  await page.getByLabel("نقاط SHARE المراد استخدامها").fill("200");
  await page.getByLabel("استخدام محفظة VOX").check();
  await page.getByLabel("قيمة المحفظة بالدرهم").fill("30");
  await expect(page.getByTestId("review-dummy-payment")).toBeEnabled();
  await page.getByTestId("review-dummy-payment").click();
  await expect(page.getByText("ملخص الدفع النهائي")).toBeVisible();
  await page.getByTestId("process-dummy-payment").click();
  await expect(page.getByText("جار معالجة الدفع")).toBeVisible();
  await expect(page.getByText("إيصال الدفع")).toBeVisible();
  await expect(page.getByText(/تمت معالجة الدفع بنجاح/)).toBeVisible();
});
