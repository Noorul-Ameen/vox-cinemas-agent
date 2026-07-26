import { expect, test } from "@playwright/test";

const FORBIDDEN_DASH_PATTERN = /[\u2013\u2014]/;
const CSP_CONSOLE_PATTERN = /content security policy|violates? the following content security policy directive|refused to (?:execute|load|connect).*because it violates/iu;
const cspViolations = new WeakMap();

async function expectNoForbiddenCustomerFacingDashes(page) {
  const offenders = await page.locator("body").evaluate((body) => {
    const forbidden = /[\u2013\u2014]/;
    const found = [];
    const visibleText = body.innerText || "";
    if (forbidden.test(visibleText)) {
      found.push({ source: "visible text", value: visibleText.match(forbidden)?.[0] });
    }

    for (const element of body.querySelectorAll("[aria-label], [title], [alt], [placeholder]")) {
      for (const attribute of ["aria-label", "title", "alt", "placeholder"]) {
        const value = element.getAttribute(attribute);
        if (value && forbidden.test(value)) {
          found.push({
            source: attribute,
            element: element.tagName.toLowerCase(),
            value,
          });
        }
      }
    }
    return found;
  });

  expect(offenders, "Customer-facing DOM must use standard punctuation").toEqual([]);
}

async function openMallOfTheEmirates(page) {
  await page.getByRole("button", { name: "Choose VOX cinema" }).first().click();
  await expect(page.getByRole("heading", { name: "Choose your cinema" })).toBeVisible();
  await page.getByPlaceholder("Search cinemas").fill("Mall of the Emirates");
  await page.getByRole("button", { name: /Mall of the Emirates/ }).click();
  await expect(page.getByRole("group", { name: "Choose a date" })).toBeVisible();
}

async function choosePublishedDate(page) {
  const dateGroup = page.getByRole("group", { name: "Choose a date" });
  const dateButtons = dateGroup.getByRole("button");
  const dateCount = await dateButtons.count();
  expect(dateCount, "The selected cinema should publish at least one date").toBeGreaterThan(0);
  await dateButtons.nth(dateCount > 1 ? 1 : 0).click();
}

async function seedBookings(page, bookings) {
  await page.evaluate((storedBookings) => {
    localStorage.setItem("vox_bookings", JSON.stringify({
      version: 2,
      namespace: "voxi",
      bookings: storedBookings,
    }));
  }, bookings);
}

async function reachCheckout(page, seatCount = 2) {
  await openMallOfTheEmirates(page);
  await choosePublishedDate(page);
  await expect(page.getByText(/What would you prefer|What kind of movie/).first()).toBeVisible();

  const input = page.locator("input[aria-label]").last();
  await input.fill("anything is fine");
  await input.press("Enter");
  await expect(page.getByText("Choose a movie", { exact: true })).toBeVisible();

  const firstMovieCard = page.locator('main button:has([aria-label^="Relevant showtimes for "])').first();
  await expect(firstMovieCard).toBeVisible();
  await firstMovieCard.click();
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();

  const showtimeButton = page.locator("main button").filter({ hasText: /\d{1,2}:\d{2}/ }).first();
  await expect(showtimeButton).toBeVisible();
  await showtimeButton.click();
  await expect(page.getByText(/Tap seats/).first()).toBeVisible();

  const availableSeats = page.locator('main button[aria-label^="Seat "]:not([disabled])');
  expect(await availableSeats.count(), "The seat preview should expose selectable seats").toBeGreaterThanOrEqual(seatCount);
  for (let index = 0; index < seatCount; index += 1) await availableSeats.nth(index).click();
  await expect(page.getByText(new RegExp(`${seatCount} seats?:`))).toBeVisible();

  await page.getByRole("button", { name: "Confirm seats" }).click();
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(new RegExp(`${seatCount} seats?`)).first()).toBeVisible();
  return { input };
}

test.beforeEach(async ({ page }) => {
  const violations = [];
  cspViolations.set(page, violations);
  page.on("console", (message) => {
    const text = message.text();
    if (CSP_CONSOLE_PATTERN.test(text)) violations.push(text);
  });
  await page.route(
    /^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (route) => route.abort("blockedbyclient"),
  );
  await page.routeWebSocket(
    /^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (socket) => socket.close(),
  );
  await page.goto("/");
  await expect(page.locator(".voxi-widget")).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(cspViolations.get(page) || [], "No browser journey may produce a CSP console violation").toEqual([]);
});

test("cold welcome works without microphone access and preserves the 420px widget", async ({ page }) => {
  const widget = page.locator(".voxi-widget");
  await expect(page.getByText("No microphone is needed.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable voice" })).toBeEnabled();
  await expect(page.getByText(/Voice could not start|Microphone access is blocked/)).toHaveCount(0);

  const dimensions = await widget.evaluate((element) => {
    const main = element.querySelector("main");
    return {
      widgetWidth: element.getBoundingClientRect().width,
      widgetScrollWidth: element.scrollWidth,
      widgetClientWidth: element.clientWidth,
      mainScrollWidth: main?.scrollWidth ?? 0,
      mainClientWidth: main?.clientWidth ?? 0,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    };
  });

  expect(dimensions.widgetWidth).toBeCloseTo(420, 0);
  expect(dimensions.widgetScrollWidth).toBeLessThanOrEqual(dimensions.widgetClientWidth);
  expect(dimensions.mainScrollWidth).toBeLessThanOrEqual(dimensions.mainClientWidth);
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("microphone denial is recoverable and typed booking history remains usable", async ({ page }) => {
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(
      new DOMException("Permission denied", "NotAllowedError"),
    );
  });

  await page.getByRole("button", { name: "Enable voice" }).click();
  await expect(page.getByText(/Microphone access is blocked|Voice could not start/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable voice" })).toBeEnabled();

  const input = page.locator("input[aria-label]").last();
  await expect(input).toBeEnabled();
  await input.fill("Show my booking history");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await expect(page.getByText(/No bookings yet/)).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("direct UI journey reaches checkout with seat-derived ticket count", async ({ page }) => {
  await openMallOfTheEmirates(page);
  await expectNoForbiddenCustomerFacingDashes(page);

  await choosePublishedDate(page);
  await expect(page.getByText(/What would you prefer|What kind of movie/).first()).toBeVisible();

  const input = page.locator("input[aria-label]").last();
  await input.fill("anything is fine");
  await input.press("Enter");
  await expect(page.getByText("Choose a movie", { exact: true })).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);

  const firstMovieCard = page.locator('main button:has([aria-label^="Relevant showtimes for "])').first();
  await expect(firstMovieCard).toBeVisible();
  const movieAriaLabel = await firstMovieCard.locator('[aria-label^="Relevant showtimes for "]').getAttribute("aria-label");
  const movieTitle = String(movieAriaLabel || "").replace(/^Relevant showtimes for /, "");
  expect(movieTitle).not.toEqual("");
  await input.fill(`I want ${movieTitle}`);
  await input.press("Enter");
  await expect(page.getByText(/Select a showtime/).first()).toBeVisible();

  const showtimeButton = page.locator("main button").filter({ hasText: /\d{1,2}:\d{2}/ }).first();
  await expect(showtimeButton).toBeVisible();
  const showtimeText = await showtimeButton.innerText();
  const showtime = showtimeText.match(/\d{1,2}:\d{2}/)?.[0];
  const experience = showtimeText.match(/\b(?:4DX|GOLD|IMAX|KIDS|MAX|ONYX|PREMIER|STANDARD|THEATRE)\b/i)?.[0] || "";
  expect(showtime).toBeTruthy();
  await input.fill(`Yes, use ${showtime} ${experience}`.trim());
  await input.press("Enter");
  await expect(page.getByText(/Tap seats/).first()).toBeVisible();

  const availableSeats = page.locator('main button[aria-label^="Seat "]:not([disabled])');
  expect(await availableSeats.count(), "The seat preview should expose selectable seats").toBeGreaterThanOrEqual(2);
  await availableSeats.nth(0).click();
  await availableSeats.nth(1).click();
  await expect(page.getByText(/2 seats:/)).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);

  await page.getByRole("button", { name: "Confirm seats" }).click();
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/2 seats/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit seats" })).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);

  await input.fill("What does PG mean?");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: /Return to checkout/ })).toBeVisible();
  await page.getByRole("button", { name: /Return to checkout/ }).click();
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/2 seats/).first()).toBeVisible();

  await input.fill("Remove seat Z9");
  await input.press("Enter");
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/2 seats/).first()).toBeVisible();

  await page.getByRole("button", { name: "Edit seats" }).click();
  await expect(page.getByText(/Tap seats/).first()).toBeVisible();
  await expect(page.locator('main button[aria-label^="Seat "][aria-pressed="true"]')).toHaveCount(2);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("checkout gateway processes a POC payment receipt with reference QR disclosure", async ({ page }) => {
  const { input } = await reachCheckout(page, 2);
  await input.fill("Can I pre order food and collect it at the cinema?");
  await input.press("Enter");
  await expect(page.getByText(/Voxi cannot place a food order inside this conversation/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Return to checkout review/ })).toBeVisible();

  await input.fill("Return to checkout review");
  await input.press("Enter");
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();

  const reviewPayment = page.getByTestId("review-dummy-payment");
  await expect(reviewPayment).toBeDisabled();
  await page.getByTestId("eligible-test-card").click();
  await expect(reviewPayment).toBeEnabled();
  await reviewPayment.click();
  await expect(page.getByText("Final payment summary")).toBeVisible();
  await page.getByTestId("process-dummy-payment").click();

  await expect(page.getByText("Payment receipt", { exact: true }).last()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/Payment processed in the POC environment/)).toBeVisible();
  await expect(page.getByText(/use the official VOX ticket for cinema admission/i)).toBeVisible();
  await expect(page.getByText("Booking reference", { exact: true })).toBeVisible();
  await expect(page.getByText("Booking ref", { exact: true })).toHaveCount(0);

  const qr = page.locator("[data-qr-value]");
  await expect(qr).toHaveCount(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("vox_bookings") || "null"));
  expect(stored?.version).toBe(2);
  expect(stored?.namespace).toBe("voxi");
  expect(stored?.bookings).toHaveLength(1);
  expect(stored.bookings[0]).toMatchObject({
    bookingStatus: "summary_saved",
    paymentStatus: "simulated_not_charged",
    demo: true,
    verified: false,
    cancelled: false,
    reviewedWith: "dummy_payment_processor",
    demoPayment: {
      status: "processed",
      simulated: true,
    },
  });
  expect(stored.bookings[0].demoPayment.transactionRef).toMatch(/^TXN-/);
  expect(stored.bookings[0].seats).toHaveLength(2);
  await expect(qr).toHaveAttribute("data-qr-value", stored.bookings[0].ref);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("language control switches the complete interface direction", async ({ page }) => {
  const applicationRoot = page.locator("#root > div").first();
  await expect(applicationRoot).toHaveAttribute("lang", "en");
  await expect(applicationRoot).toHaveAttribute("dir", "ltr");

  const input = page.locator("input[aria-label]").last();
  await input.fill("Switch the conversation and interface to Arabic.");
  await input.press("Enter");
  await expect(applicationRoot).toHaveAttribute("lang", "ar");
  await expect(applicationRoot).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
  await expectNoForbiddenCustomerFacingDashes(page);

  const arabicInput = page.locator("input[aria-label]").last();
  await arabicInput.fill("اعرض حجوزاتي");
  await arabicInput.press("Enter");
  await expect(page.getByRole("heading", { name: "حجوزاتي" })).toBeVisible();
  await expect(page.getByText(/لا توجد حجوزات بعد/)).toBeVisible();

  await arabicInput.fill("Switch the interface and conversation to English.");
  await arabicInput.press("Enter");
  await expect(applicationRoot).toHaveAttribute("lang", "en");
  await expect(applicationRoot).toHaveAttribute("dir", "ltr");
});

test("Arabic movie rating questions keep the visible movie list read-only", async ({ page }) => {
  await openMallOfTheEmirates(page);
  await choosePublishedDate(page);

  const input = page.locator("input[aria-label]").last();
  await input.fill("anything is fine");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Choose a movie" })).toBeVisible();

  const movieRegion = page.getByRole("region", { name: "Choose a movie" });
  const movieButtons = movieRegion.locator("button").filter({ has: page.locator('span[dir="auto"]') });
  await expect(movieButtons.first()).toBeVisible();
  const minionsTitle = movieRegion.getByText("Minions & Monsters", { exact: true });
  const movieTitle = await minionsTitle.count()
    ? "Minions & Monsters"
    : String(await movieButtons.first().locator('span[dir="auto"]').first().textContent()).trim();
  expect(movieTitle).not.toEqual("");

  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.getByRole("heading", { name: "اختر فيلماً" })).toBeVisible();

  const arabicInput = page.locator("input[aria-label]").last();
  await arabicInput.fill(`ما تصنيف فيلم ${movieTitle}؟`);
  await arabicInput.press("Enter");

  const escapedTitle = movieTitle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  await expect(page.getByText(new RegExp(
    `(?:تصنيف فيلم ${escapedTitle} هو|لفيلم ${escapedTitle} عروض حالية لدى ڤوكس باللغات)`,
    "u",
  ))).toBeVisible();
  await expect(page.getByRole("heading", { name: "اختر فيلماً" })).toBeVisible();
  await expect(page.getByText("اختر موعد العرض", { exact: true })).toHaveCount(0);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("booking history renders a valid localStorage booking", async ({ page }) => {
  const booking = {
    ref: "E2E420",
    movieTitle: "Playwright Family Night",
    cinemaId: "0001",
    cinemaName: "VOX - City Centre Deira",
    performanceDate: "2099-12-20",
    showtime: "18:30",
    experience: "THEATRE",
    screen: "Screen 4",
    seats: ["D4", "D5"],
    total: 84,
    currency: "AED",
    createdAt: "2099-01-01T12:00:00.000Z",
    bookingStatus: "confirmed_demo",
    paymentStatus: "simulated_not_charged",
    verified: false,
    demo: true,
    cancelled: false,
  };

  await page.evaluate((storedBooking) => {
    localStorage.setItem("vox_bookings", JSON.stringify({
      version: 2,
      namespace: "voxi",
      bookings: [storedBooking],
    }));
  }, booking);

  await page.getByRole("button", { name: "Bookings" }).first().click();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await expect(page.getByText("Playwright Family Night", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E420", { exact: true })).toBeVisible();
  await expect(page.getByText("D4, D5", { exact: true })).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("typed booking reference opens the matching visible history record", async ({ page }) => {
  const bookings = [
    {
      ref: "E2E420",
      movieTitle: "Playwright Family Night",
      cinemaId: "0001",
      cinemaName: "VOX - City Centre Deira",
      performanceDate: "2099-12-20",
      showtime: "18:30",
      experience: "THEATRE",
      screen: "Screen 4",
      seats: ["D4", "D5"],
      total: 84,
      currency: "AED",
      createdAt: "2099-01-01T12:00:00.000Z",
      bookingStatus: "confirmed_demo",
      paymentStatus: "simulated_not_charged",
      verified: false,
      demo: true,
      cancelled: false,
    },
    {
      ref: "E2E421",
      movieTitle: "Playwright Action Night",
      cinemaId: "0015",
      cinemaName: "VOX - Mall of the Emirates",
      performanceDate: "2099-12-21",
      showtime: "20:15",
      experience: "IMAX",
      screen: "Screen 1",
      seats: ["E6"],
      total: 62,
      currency: "AED",
      createdAt: "2099-01-02T12:00:00.000Z",
      bookingStatus: "confirmed_demo",
      paymentStatus: "simulated_not_charged",
      verified: false,
      demo: true,
      cancelled: false,
    },
  ];

  await page.evaluate((storedBookings) => {
    localStorage.setItem("vox_bookings", JSON.stringify({
      version: 2,
      namespace: "voxi",
      bookings: storedBookings,
    }));
  }, bookings);

  await page.getByRole("button", { name: "Bookings" }).first().click();
  await expect(page.getByText("E2E420", { exact: true })).toBeVisible();
  const input = page.locator("input[aria-label]").last();
  await input.fill("Open booking E2E420");
  await input.press("Enter");

  await expect(page.getByRole("heading", { name: "Booking summary" })).toBeVisible();
  await expect(page.getByText("Playwright Family Night", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E420", { exact: true })).toBeVisible();
  await expect(page.getByText("Playwright Action Night", { exact: true })).toHaveCount(0);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("typed cancellation stays in the booking flow when a movie title is selected", async ({ page }) => {
  const bookings = [
    {
      ref: "E2ECAN1",
      movieTitle: "Playwright Family Night",
      cinemaId: "0015",
      cinemaName: "VOX - Mall of the Emirates",
      performanceDate: "2099-12-20",
      showtime: "18:30",
      experience: "THEATRE",
      screen: "Screen 4",
      seats: ["D4", "D5"],
      total: 84,
      currency: "AED",
      createdAt: "2099-01-01T12:00:00.000Z",
      bookingStatus: "confirmed_demo",
      paymentStatus: "simulated_not_charged",
      verified: false,
      demo: true,
      cancelled: false,
    },
    {
      ref: "E2ECAN2",
      movieTitle: "Playwright Action Night",
      cinemaId: "0001",
      cinemaName: "VOX - City Centre Deira",
      performanceDate: "2099-12-21",
      showtime: "20:15",
      experience: "IMAX",
      screen: "Screen 1",
      seats: ["E6"],
      total: 62,
      currency: "AED",
      createdAt: "2099-01-02T12:00:00.000Z",
      bookingStatus: "confirmed_demo",
      paymentStatus: "simulated_not_charged",
      verified: false,
      demo: true,
      cancelled: false,
    },
  ];

  await seedBookings(page, bookings);

  const input = page.locator("input[aria-label]").last();
  await input.fill("Cancel booking");
  await input.press("Enter");
  await expect(page.getByText("Playwright Family Night", { exact: true })).toBeVisible();
  await expect(page.getByText("Playwright Action Night", { exact: true })).toBeVisible();

  await input.fill("Playwright Family Night");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Booking summary" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Yes, (?:cancel booking|mark cancelled)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep booking" })).toBeVisible();
  await expect(page.getByText("Choose a movie", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Yes, (?:cancel booking|mark cancelled)/ }).click();
  const cancellationSuccess = page.getByText("Cancelled", { exact: true }).first();
  await expect(cancellationSuccess).toBeVisible();
  await expect(page.getByText(/Cancellation recorded in the POC environment/i).first()).toBeVisible();

  const storedAfterCancellation = await page.evaluate(() => JSON.parse(localStorage.getItem("vox_bookings") || "null"));
  const familyBooking = storedAfterCancellation.bookings.find((booking) => booking.ref === "E2ECAN1");
  const actionBooking = storedAfterCancellation.bookings.find((booking) => booking.ref === "E2ECAN2");
  expect(familyBooking).toMatchObject({
    cancelled: true,
    bookingStatus: "cancelled_demo",
    refundStatus: "not_processed_demo",
  });
  expect(familyBooking.cancelledAt).toBeTruthy();
  expect(actionBooking.cancelled).toBe(false);
  await expect(page.locator("[data-qr-value]")).toHaveCount(0);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("bank offers render detailed FAB guidance and official sources", async ({ page }) => {
  await page.getByRole("button", { name: "Card offers" }).click();
  await expect(page.getByRole("heading", { name: "Bank offers" })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search bank offers" });
  await search.fill("FAB");
  await expect(page.getByText("First Abu Dhabi Bank", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Show offer details: First Abu Dhabi Bank/ }).click();

  await expect(page.getByText(/Buy one ticket, get one free/i).first()).toBeVisible();
  await expect(page.getByText(/FAB SHARE Credit Card/).first()).toBeVisible();
  await expect(page.getByText("Guidance only, not applied", { exact: true })).toBeVisible();

  await page.locator(".offer-card-select").selectOption({ label: "FAB SHARE Credit Card" });
  await expect(page.getByText(/More details needed|Listed as eligible|Not eligible/).first()).toBeVisible();
  await page.locator("summary").filter({ hasText: "Full terms" }).click();
  await expect(page.getByRole("link", { name: "Official details" })).toHaveAttribute("href", /fab-buy-one-ticket-get-one-free/);
  await expect(page.getByRole("link", { name: "Full terms" }).last()).toHaveAttribute("href", /terms-conditions/);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("corrupt booking storage fails closed and recovers after repair", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("vox_bookings", "{corrupt"));
  await page.getByRole("button", { name: "Bookings" }).first().click();

  const storageError = page.getByText(/Saved booking summaries cannot be read from this device|Restore site storage and try again/).first();
  await expect(storageError).toBeVisible();
  await expect(page.getByText(/No bookings yet/)).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.setItem("vox_bookings", JSON.stringify({
      version: 2,
      namespace: "voxi",
      bookings: [],
    }));
  });

  const recoveredPage = await page.context().newPage();
  await recoveredPage.route(
    /^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (route) => route.abort("blockedbyclient"),
  );
  await recoveredPage.routeWebSocket(
    /^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (socket) => socket.close(),
  );
  await recoveredPage.goto("/");
  await recoveredPage.getByRole("button", { name: "Bookings" }).first().click();
  await expect(recoveredPage.getByText(/No bookings yet/)).toBeVisible();
  await recoveredPage.close();
  await expect(storageError).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("valid JSON with unsafe booking field types fails closed", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("vox_bookings", JSON.stringify({
      version: 2,
      namespace: "voxi",
      bookings: [{
        ref: "UNSAFE1",
        movieTitle: { injected: "Unsafe title" },
        total: { amount: 84 },
        seats: { first: "A1" },
        performanceDate: "2099-12-20",
        showtime: "18:30",
        cancelled: false,
      }],
    }));
  });

  await page.getByRole("button", { name: "Bookings" }).first().click();
  await expect(page.getByText(/Saved booking summaries cannot be read from this device|Restore site storage and try again/).first()).toBeVisible();
  await expect(page.getByText("Unsafe title", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/No bookings yet/)).toHaveCount(0);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("unsupported stored booking currency fails closed before formatting", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("vox_bookings", JSON.stringify({
      version: 2,
      namespace: "voxi",
      bookings: [{
        ref: "BADCURRENCY",
        movieTitle: "Currency guard",
        cinemaName: "VOX - Mall of the Emirates",
        seats: ["A1"],
        total: 42,
        currency: "BOGUS",
        performanceDate: "2099-12-20",
        showtime: "18:30",
        cancelled: false,
      }],
    }));
  });

  await page.getByRole("button", { name: "Bookings" }).first().click();
  await expect(page.getByText(/Saved booking summaries cannot be read from this device|Restore site storage and try again/).first()).toBeVisible();
  await expect(page.getByText("Currency guard", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("corrupt nested release recovery fails closed without crashing the widget", async ({ page }) => {
  await page.evaluate(() => {
    sessionStorage.setItem("voxi_release_journey_recovery", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      stage: {
        view: "movies",
        movies: [{ id: "unsafe-movie", title: { injected: "Unsafe title" } }],
      },
      messages: [],
      selectedSeats: [],
    }));
  });

  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByText("Hi, I’m Voxi", { exact: true })).toBeVisible();
  await expect(page.getByText("Unsafe title", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery"))).toBeNull();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("invalid recovered discovery date and time fields fail closed", async ({ page }) => {
  await page.evaluate(() => {
    sessionStorage.setItem("voxi_release_journey_recovery", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      stage: {
        view: "discovery",
        missing: ["preference"],
        preferences: {
          date: "not-a-date",
          preferredTime: { unsafe: true },
        },
      },
      messages: [],
      selectedSeats: [],
      discoveryPreferences: {
        date: "not-a-date",
        preferredTime: { unsafe: true },
      },
    }));
  });

  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByText("Hi, I’m Voxi", { exact: true })).toBeVisible();
  await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery"))).toBeNull();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("malformed paused journey recovery fails closed before restore", async ({ page }) => {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    sessionStorage.setItem("voxi_release_journey_recovery", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      stage: { view: "empty" },
      messages: [],
      selectedSeats: [],
      pausedJourney: {
        schemaVersion: "1.0",
        sessionId: "unsafe-session",
        journeyId: "unsafe-journey",
        previousJourneyId: null,
        status: "paused",
        activeView: null,
        resumeView: "checkout",
        sequence: 1,
        expiresAt: null,
        lastRestore: null,
        lastEvent: { type: "hidden", at: now, reason: "test" },
        entries: {
          checkout: {
            view: "checkout",
            sourceView: "checkout",
            snapshot: { view: "empty" },
            capturedAt: now,
            restorable: true,
            priority: 700,
            sequence: 1,
          },
        },
      },
    }));
  });

  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByText("Hi, I’m Voxi", { exact: true })).toBeVisible();
  await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery"))).toBeNull();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("empty-stage release recovery retains an FAQ-only transcript exactly once", async ({ page }) => {
  await page.evaluate(() => {
    sessionStorage.setItem("voxi_release_journey_recovery", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      conversationId: "release-faq-conversation",
      bookingJourneyId: "release-faq-journey",
      messages: [
        {
          id: "release-faq-user",
          role: "user",
          text: "What identification should I bring?",
          at: new Date().toISOString(),
        },
        {
          id: "release-faq-agent",
          role: "agent",
          text: "Bring the identification required for your ticket type and age rating.",
          at: new Date().toISOString(),
        },
      ],
      stage: { view: "empty" },
      stageVisible: false,
      selectedSeats: [],
      booking: null,
      pendingOrder: null,
      cinema: null,
      scheduleDate: "2026-07-23",
      pausedJourney: null,
      requestedSeatTarget: null,
      seatQuote: null,
      discoveryPreferences: {},
      historyFilter: "all",
      refs: {},
    }));
  });

  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByText("What identification should I bring?", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Bring the identification required for your ticket type and age rating.", { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery"))).toBeNull();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("release recovery retains an active discovery question exactly once", async ({ page }) => {
  await page.evaluate(() => {
    const preferences = {
      cinemaId: "0002",
      cinemaName: "VOX - Mall of the Emirates",
      date: "2026-07-24",
      genre: "Family",
      openChoice: false,
    };
    sessionStorage.setItem("voxi_release_journey_recovery", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      conversationId: "release-discovery-conversation",
      bookingJourneyId: "release-discovery-journey",
      messages: [{
        id: "release-discovery-message",
        role: "user",
        text: "Show family movies at Mall of the Emirates tomorrow",
        at: new Date().toISOString(),
      }],
      stage: {
        view: "discovery",
        missing: ["preference"],
        question: "What would you prefer?",
        preferences,
      },
      stageVisible: true,
      selectedSeats: [],
      booking: null,
      pendingOrder: null,
      cinema: { id: "0002", name: "VOX - Mall of the Emirates", currency: "AED" },
      scheduleDate: "2026-07-24",
      pausedJourney: null,
      requestedSeatTarget: null,
      seatQuote: null,
      discoveryPreferences: preferences,
      historyFilter: "all",
      refs: {},
    }));
  });

  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.locator("main strong").filter({ hasText: "What would you prefer? You can name a movie, time, genre, language, cinema experience, or family choice." })).toHaveCount(1);
  await expect(page.getByText("VOX - Mall of the Emirates", { exact: true })).toBeVisible();
  await expect(page.getByText("Family", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery"))).toBeNull();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("denied booking storage stays fail-closed and a restored page recovers", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access denied", "SecurityError");
      },
    });
  });
  await page.reload();
  await expect(page.locator(".voxi-widget")).toBeVisible();

  await page.getByRole("button", { name: "Bookings" }).first().click();
  await expect(page.getByText(/Saved booking summaries cannot be read from this device|Restore site storage and try again/).first()).toBeVisible();
  await expect(page.getByText(/No bookings yet/)).toHaveCount(0);

  await expect(page.locator(".voxi-widget")).toBeVisible();

  const recoveredPage = await page.context().newPage();
  await recoveredPage.route(
    /^https:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (route) => route.abort("blockedbyclient"),
  );
  await recoveredPage.routeWebSocket(
    /^wss:\/\/[^/]*elevenlabs\.(?:io|com)\//i,
    (socket) => socket.close(),
  );
  await recoveredPage.goto("/");
  await expect(recoveredPage.locator(".voxi-widget")).toBeVisible();
  await recoveredPage.getByRole("button", { name: "Bookings" }).first().click();
  await expect(recoveredPage.getByText(/No bookings yet/)).toBeVisible();
  await recoveredPage.close();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("lazy offer chunk rollover refreshes the release and preserves checkout", async ({ page }) => {
  await reachCheckout(page, 2);

  const manifestUrl = new URL("/asset-manifest.json", page.url()).href;
  const manifestResponse = await page.context().request.get(manifestUrl);
  expect(manifestResponse.ok(), "The release build must publish its Vite asset manifest").toBe(true);
  const manifest = await manifestResponse.json();
  const offersManifestKey = "src/components/OffersPanel.jsx";
  const originalOfferChunkFile = manifest?.[offersManifestKey]?.file;
  expect(originalOfferChunkFile, "The manifest must identify the current OffersPanel chunk").toMatch(/^assets\/OffersPanel-.*\.js$/);

  const originalOfferChunkUrl = new URL(`/${originalOfferChunkFile}`, page.url()).href;
  const originalOfferChunkResponse = await page.context().request.get(originalOfferChunkUrl);
  expect(originalOfferChunkResponse.ok(), "The current OffersPanel module must be available before rollover simulation").toBe(true);
  const originalOfferChunkPath = new URL(originalOfferChunkUrl).pathname;
  const alternateOfferChunkFile = originalOfferChunkFile.replace(/\.js$/i, "-current.js");
  const alternateOfferChunkPath = new URL(`/${alternateOfferChunkFile}`, page.url()).pathname;
  const rolloverManifest = {
    ...manifest,
    [offersManifestKey]: {
      ...manifest[offersManifestKey],
      file: alternateOfferChunkFile,
    },
  };

  let originalOfferChunkRequests = 0;
  let manifestRetryRequests = 0;
  let alternateOfferChunkRequests = 0;
  let releaseReloads = 0;

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) releaseReloads += 1;
  });

  await page.route((url) => url.pathname === originalOfferChunkPath, async (route) => {
    originalOfferChunkRequests += 1;
    if (releaseReloads === 0) {
      await route.fulfill({
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        },
        body: "<!doctype html><title>Stale chunk</title>",
      });
      return;
    }
    await route.continue();
  });
  await page.route("**/asset-manifest.json*", async (route) => {
    manifestRetryRequests += 1;
    await route.fulfill({
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(rolloverManifest),
    });
  });
  await page.route((url) => url.pathname === alternateOfferChunkPath, async (route) => {
    alternateOfferChunkRequests += 1;
    await route.fulfill({
      status: 500,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: "The rollover module must not be imported by the stale entry document.",
    });
  });

  await page.getByRole("button", { name: "Card offers" }).click();
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(originalOfferChunkRequests).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => {
    window.__voxiOriginalSessionStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === "voxi_release_journey_recovery") throw new DOMException("Access denied", "SecurityError");
      return window.__voxiOriginalSessionStorageSetItem.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(releaseReloads, "A failed recovery write must not reload and lose the active checkout").toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery"))).toBeNull();
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__voxiOriginalSessionStorageSetItem;
    delete window.__voxiOriginalSessionStorageSetItem;
  });

  const releaseReload = page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame());
  await Promise.all([
    releaseReload,
    page.getByRole("button", { name: "Try again" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Bank offers" })).toBeVisible();
  expect(manifestRetryRequests).toBeGreaterThanOrEqual(1);
  expect(releaseReloads, "Release rollover must trigger exactly one top-level reload").toBe(1);
  expect(alternateOfferChunkRequests, "A stale entry document must never import a new release module in place").toBe(0);
  expect(originalOfferChunkRequests, "The refreshed app must load its current lazy module").toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("region", { name: "Return to checkout" })).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("voxi_release_journey_recovery")),
    "The single-use release recovery snapshot must be consumed after reload",
  ).toBeNull();

  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByText("Checkout review", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/2 seats/).first()).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("browser back and forward preserve the active in-page journey", async ({ page }) => {
  await page.evaluate(() => history.pushState({ gate: 1 }, "", "?navigation-gate=1"));
  await openMallOfTheEmirates(page);
  await page.evaluate(() => history.pushState({ gate: 2 }, "", "?navigation-gate=2"));

  await page.goBack();
  await expect(page).toHaveURL(/navigation-gate=1/);
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose a date" })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/navigation-gate=2/);
  await expect(page.locator(".voxi-widget")).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose a date" })).toBeVisible();
  await expectNoForbiddenCustomerFacingDashes(page);
});

test("forbidden dash validator detects both disallowed characters", async () => {
  expect(FORBIDDEN_DASH_PATTERN.test("\u2013")).toBe(true);
  expect(FORBIDDEN_DASH_PATTERN.test("\u2014")).toBe(true);
  expect(FORBIDDEN_DASH_PATTERN.test("-")).toBe(false);
});
