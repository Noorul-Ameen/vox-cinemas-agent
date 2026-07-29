import { expect, test } from "@playwright/test";

async function sendText(page, text) {
  const input = page.locator("input[aria-label]").last();
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
}

async function chooseAvailableDate(page) {
  const dateGroup = page.getByRole("group", { name: /Choose a date|اختر التاريخ/ });
  if (await dateGroup.isVisible().catch(() => false)) {
    const date = dateGroup.getByRole("button").nth(1);
    const label = (await date.getAttribute("aria-label")) || (await date.innerText());
    await sendText(page, label.replace(/^[^،,]+[،,]\s*/, ""));
  }
}

async function reachMovieGrid(page, request = "Show me any movie at Mall of the Emirates") {
  await sendText(page, request);
  await expect.poll(async () => {
    const dates = await page.getByRole("group", { name: /Choose a date|اختر التاريخ/ }).isVisible().catch(() => false);
    const movies = await page.getByRole("heading", { name: /Choose a movie|اختر فيلماً/ }).isVisible().catch(() => false);
    return dates || movies;
  }).toBe(true);
  await chooseAvailableDate(page);
  await expect(page.getByRole("heading", { name: /Choose a movie|اختر فيلماً/ })).toBeVisible();
}

async function reachShowtimes(page) {
  await reachMovieGrid(page);
  const movieCard = page.locator('main button:has([aria-label^="Relevant showtimes for "])').first();
  await expect(movieCard).toBeVisible();
  const movieLabel = await movieCard.locator('[aria-label^="Relevant showtimes for "]').getAttribute("aria-label");
  const movieTitle = String(movieLabel || "").replace(/^Relevant showtimes for\s+/i, "").trim();
  await sendText(page, movieTitle);
  await expect(page.getByText(/Select a showtime|اختر موعد العرض/).first()).toBeVisible();
  return movieTitle;
}

async function visibleMovieTitles(page) {
  return page.locator('main [aria-label^="Relevant showtimes for "]').evaluateAll((nodes) => nodes
    .map((node) => String(node.getAttribute("aria-label") || "").replace(/^Relevant showtimes for\s+/i, "").trim())
    .filter(Boolean));
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i, (route) => route.abort("blockedbyclient"));
  await page.routeWebSocket(/^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i, (socket) => socket.close());
  await page.goto("/");
  await expect(page.locator(".voxi-widget")).toBeVisible();
});

test("general English and Arabic offer questions render bank offers instead of refund guidance", async ({ page }) => {
  await sendText(page, "What card offers are available?");
  await expect(page.getByRole("heading", { name: "Bank offers" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/refund policy/i);

  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "ما عروض البطاقات المتاحة؟");
  await expect(page.getByRole("heading", { name: "عروض البنوك" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/سياسة الاسترداد/u);
});

test("destination-free cinema changes open the picker in English and Arabic", async ({ page }) => {
  await reachMovieGrid(page);
  await sendText(page, "Change cinema");
  await expect(page.getByRole("heading", { name: "Choose your cinema" })).toBeVisible();

  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "غيّر السينما");
  await expect(page.getByRole("heading", { name: "اختر السينما" })).toBeVisible();
});

test("other-movie requests return to the movie grid and never search for a title called other", async ({ page }) => {
  await reachShowtimes(page);
  await sendText(page, "Show me other movies");
  await expect(page.getByRole("heading", { name: "Choose a movie" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/match [“"]?other/i);

  await reachShowtimes(page);
  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "اعرض أفلاماً أخرى");
  await expect(page.getByRole("heading", { name: "اختر فيلماً" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/مطابقة.*أخرى/u);
});

test("exact title replacement clears stale discovery facets and loads that title", async ({ page }) => {
  await reachMovieGrid(page);
  const unfilteredTitles = await visibleMovieTitles(page);
  await sendText(page, "Show me horror movies");
  await expect(page.getByRole("heading", { name: "Choose a movie" })).toBeVisible();
  const filteredTitles = new Set(await visibleMovieTitles(page));
  const replacementTitle = unfilteredTitles.find((title) => !filteredTitles.has(title));
  expect(replacementTitle).toBeTruthy();

  await sendText(page, `Switch to ${replacementTitle}`);
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  await expect(page.locator("main")).toContainText(replacementTitle);
  await expect(page.locator("main")).not.toContainText(/no .*horror.*match/i);
});

test("invalid English and Arabic clocks keep current showtimes visible", async ({ page }) => {
  await reachShowtimes(page);
  const showtimeButtons = page.locator("main button").filter({ hasText: /\d{1,2}:\d{2}/ });
  const count = await showtimeButtons.count();
  expect(count).toBeGreaterThan(0);

  await sendText(page, "25:99");
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  await expect(showtimeButtons).toHaveCount(count);
  await expect(page.locator("main")).toContainText(/current options remain visible/i);

  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "٢٥:٩٩");
  await expect(showtimeButtons).toHaveCount(count);
  await expect(page.locator("main")).toContainText(/مواعيد العرض ظاهرة/u);
});

test("generic rating definitions are answered without requesting a movie or replacing the panel", async ({ page }) => {
  await reachShowtimes(page);
  await sendText(page, "What does PG13 mean?");
  await expect(page.locator("main")).toContainText("For PG13, guests aged 13 and under may attend only with someone aged 13 or older");
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/which movie|movie title/i);

  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "ما معنى تصنيف PG13؟");
  await expect(page.locator("main")).toContainText("يجب أن يحضر الضيوف بعمر 13 سنة أو أقل مع شخص عمره 13 سنة أو أكثر");
  await expect(page.getByText(/اختر موعد العرض/).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/أي فيلم|اسم الفيلم/u);
});

test("explicit return phrases restore the synchronized showtime panel", async ({ page }) => {
  await reachShowtimes(page);
  await sendText(page, "What card offers are available?");
  await expect(page.getByRole("heading", { name: "Bank offers" })).toBeVisible();
  await sendText(page, "Return to showtimes");
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();

  await sendText(page, "What card offers are available?");
  await page.getByRole("button", { name: "العربية" }).click();
  await sendText(page, "العودة إلى مواعيد العرض");
  await expect(page.getByText(/اختر موعد العرض/).first()).toBeVisible();
});
