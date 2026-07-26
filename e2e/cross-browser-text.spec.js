import { expect, test } from "@playwright/test";

const CSP_CONSOLE_PATTERN = /content security policy|violates? the following content security policy directive|refused to (?:execute|load|connect).*because it violates/iu;

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function sendText(page, text) {
  const input = page.locator("input[aria-label]").last();
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
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

test("English and Arabic typed journeys match every rendered stage", async ({ page, browserName }) => {
  const cspViolations = [];
  page.on("console", (message) => {
    if (CSP_CONSOLE_PATTERN.test(message.text())) cspViolations.push(message.text());
  });

  const response = await page.goto("/");
  expect(response?.ok(), `${browserName} must load the VOXI application`).toBe(true);
  await expect(page.locator(".voxi-widget")).toBeVisible();

  await sendText(page, "Show me movies tomorrow at Mall of the Emirates after 7 PM");
  const movieRegion = page.getByRole("region", { name: "Choose a movie" });
  await expect(movieRegion).toBeVisible();
  await expect(page.getByRole("log")).toContainText(/I found \d+ movies matching your request/);

  const movieCard = movieRegion.locator('button:has([aria-label^="Relevant showtimes for "])').first();
  await expect(movieCard).toBeVisible();
  const movieTitle = (await movieCard.locator('span[dir="auto"]').first().innerText()).trim();
  expect(movieTitle).not.toBe("");

  await sendText(page, `Choose ${movieTitle}`);
  const showtimeRegion = page.getByRole("region", { name: movieTitle, exact: true });
  await expect(showtimeRegion).toBeVisible();
  await expect(page.getByRole("log")).toContainText(new RegExp(`${escapeRegExp(movieTitle)} is selected`));

  const showtimeButtons = showtimeRegion.getByRole("button").filter({ hasText: /\d{1,2}:\d{2}/ });
  await expect(showtimeButtons.first()).toBeVisible();
  const options = (await showtimeButtons.allInnerTexts())
    .map((text) => {
      const normalized = text.replace(/\s+/g, " ").trim();
      const time = normalized.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || "";
      const experience = normalized.match(/\b(?:IMAX|MAX|4DX|THEATRE|GOLD|PREMIER|KIDS|VIP)\b/i)?.[0] || "";
      return { text: normalized, time, experience };
    })
    .filter(({ time }) => time);
  expect(options.length, "At least one typed showtime option must be available").toBeGreaterThan(0);
  const uniqueOption = options.find((candidate) => (
    options.filter(({ time }) => time === candidate.time).length === 1
  )) || options[0];
  const showtimeCommand = `Choose the ${uniqueOption.time}${uniqueOption.experience ? ` ${uniqueOption.experience}` : ""} show`;

  await sendText(page, showtimeCommand);
  await expect(page.getByRole("log")).toContainText(`The ${uniqueOption.time} showtime is selected`);
  const seatRegion = page.getByRole("region", {
    name: new RegExp(`${escapeRegExp(movieTitle)}.*${escapeRegExp(uniqueOption.time)}`),
  });
  await expect(seatRegion).toBeVisible();

  const availableSeats = seatRegion.locator('button[aria-label^="Seat "]:not([disabled])');
  await expect.poll(() => availableSeats.count()).toBeGreaterThanOrEqual(2);
  const seatLabels = (await availableSeats.evaluateAll((buttons) => buttons.slice(0, 2).map((button) => (
    String(button.getAttribute("aria-label") || "").match(/^Seat\s+([^,]+)/i)?.[1]?.trim() || ""
  )))).filter(Boolean);
  expect(seatLabels).toHaveLength(2);

  await sendText(page, `Select seats ${seatLabels[0]} and ${seatLabels[1]}`);
  const checkoutRegion = page.getByRole("region", { name: "Checkout review" });
  await expect(checkoutRegion).toBeVisible();
  await expect(page.getByRole("log")).toContainText("Seats are selected. Checkout review is ready.");
  await expect(checkoutRegion).toContainText(seatLabels[0]);
  await expect(checkoutRegion).toContainText(seatLabels[1]);

  await sendText(page, "تابع بالعربية");
  await expect(page.getByRole("button", { name: "العربية" })).toHaveAttribute("aria-pressed", "true");
  const arabicCheckout = page.getByRole("region", { name: "مراجعة إتمام الحجز", exact: true });
  await expect(arabicCheckout).toBeVisible();
  await expect(page.getByRole("log")).toContainText("تم تحويل المحادثة والواجهة إلى العربية.");

  await sendText(page, "هل توجد مقاعد مخصصة للكراسي المتحركة؟");
  await expect(page.getByRole("region", { name: "العودة إلى مراجعة إتمام الحجز" })).toBeVisible();
  await expect(arabicCheckout).toBeHidden();

  await sendText(page, "العودة إلى مراجعة إتمام الحجز");
  await expect(arabicCheckout).toBeVisible();
  await expect(page.getByRole("log")).toContainText("تمت استعادة مراجعة إتمام الحجز.");

  const overflow = await page.locator(".voxi-widget").evaluate((widget) => ({
    widget: widget.scrollWidth - widget.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.widget, `${browserName} widget must not overflow`).toBeLessThanOrEqual(0);
  expect(overflow.document, `${browserName} document must not overflow`).toBeLessThanOrEqual(0);
  expect(cspViolations, `${browserName} must not produce CSP violations`).toEqual([]);
});
