import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CINEMAS, DATA_DATES } from "../src/mockVistaData.js";
import { assessCancellationEligibility } from "../src/lib/cancellationEligibility.js";
import {
  VISTA_MODE,
  VistaClientError,
  buildSeatPricingPreview,
  buildProgrammingDateFilter,
  demoDate,
  getPricingQuote,
  getLiveProgrammingDates,
  getProgrammingDates,
  getResultMeta,
  getScheduleStatus,
  getScheduledFilms,
  getSeatPlan,
  getSessions,
  getVistaCapabilities,
  parseVistaResultCode,
  parseVistaRefundReference,
  refundBooking,
  reserveSeats,
  searchBooking,
  sourceDateForDemoDate,
} from "../src/vistaClient.js";

const snapshotNow = new Date("2026-07-13T12:00:00Z");
const vistaSource = await readFile(new URL("../src/vistaClient.js", import.meta.url), "utf8");
assert.doesNotMatch(vistaSource, /VITE_VISTA_API_KEY/, "browser source must not read or emit an upstream Vista API key");
assert.doesNotMatch(vistaSource, /RESTBooking\.svc\/booking\/refund/, "refund writes must not use a hard-coded Vista route");
assert.match(vistaSource, /configuredUrl\(ENV\.VITE_VISTA_REFUND_PATH/, "refund writes require an explicit configured proxy path");
for (const malformed of [null, undefined, "", "   ", false, true, {}, [], "0x0", "0e999", "1e-9999", "0.0", 0.5]) {
  assert.equal(parseVistaResultCode(malformed), null, `malformed Vista Result ${JSON.stringify(malformed)} must not be interpreted as success`);
}
assert.equal(parseVistaResultCode(0), 0);
assert.equal(parseVistaResultCode("0"), 0);
assert.equal(parseVistaResultCode(-1), -1);
for (const malformed of [null, undefined, "", "   ", false, true, {}, []]) {
  assert.equal(parseVistaRefundReference(malformed), null, `malformed refund reference ${JSON.stringify(malformed)} must not be accepted`);
}
assert.equal(parseVistaRefundReference("  RF-123  "), "RF-123");
assert.equal(parseVistaRefundReference(123), "123");

assert.equal(VISTA_MODE, "snapshot");
assert.deepEqual(getProgrammingDates({ now: snapshotNow }), DATA_DATES, "fresh snapshot dates remain available");
assert.deepEqual(getProgrammingDates({ now: new Date("2026-08-01T00:00:00Z") }), [], "expired snapshot dates are not presented as current");
assert.equal(demoDate(new Date("2026-08-01T00:00:00Z")), "2026-08-01", "expired demo date stays honest instead of cycling into the past");
assert.equal(sourceDateForDemoDate("2026-08-01"), null);
assert.equal(getScheduleStatus({ now: new Date("2026-08-01T00:00:00Z") }).reason, "snapshot_expired");

assert.deepEqual(
  getLiveProgrammingDates({ now: new Date("2026-07-13T20:30:00Z"), days: 3 }),
  ["2026-07-14", "2026-07-15", "2026-07-16"],
  "live availability windows start from the current UAE calendar date",
);

const capabilities = getVistaCapabilities({ now: snapshotNow });
assert.equal(capabilities.demo, true);
assert.equal(capabilities.seats.verified, false);
assert.equal(capabilities.pricing.mode, "static_demo");
assert.equal(capabilities.reservation.mode, "not_applied_demo");
assert.equal(capabilities.refund.verified, false);
assert.equal(capabilities.refund.mode, "not_applied_demo");

const snapshotPricingPreview = buildSeatPricingPreview({ mode: "snapshot" });
assert.deepEqual(snapshotPricingPreview.tiers, { standard: 42, premium: 63 });
assert.equal(snapshotPricingPreview.demo, true, "snapshot prices must be explicitly marked as demo estimates");
assert.equal(snapshotPricingPreview.verified, false);
const liveDemoPricingPreview = buildSeatPricingPreview({ mode: "live", pricingConfigured: false });
assert.equal(liveDemoPricingPreview.mode, "static_demo", "live reads without a pricing adapter retain only the explicit demo estimate");
assert.equal(liveDemoPricingPreview.demo, true);
const liveQuotePreview = buildSeatPricingPreview({ mode: "live", pricingConfigured: true });
assert.equal(liveQuotePreview.mode, "quote_required");
assert.equal(liveQuotePreview.demo, false);
assert.deepEqual(liveQuotePreview.tiers, { standard: null, premium: null }, "configured live pricing must not fabricate pre-quote tier amounts");

const filter = buildProgrammingDateFilter("00'1", "2026-07-14");
assert.match(filter, /CinemaId eq '00''1'/, "OData string values are escaped");
assert.match(filter, /2026-07-14T06:00:00Z/);
assert.match(filter, /2026-07-15T06:00:00Z/);

const shindagha = CINEMAS.find((cinema) => /Shindagha/i.test(cinema.Name));
assert.ok(shindagha);
const noFilms = await getScheduledFilms(shindagha.ID, "2026-07-16");
assert.deepEqual(noFilms, []);
assert.equal(getResultMeta(noFilms).empty, true);
assert.equal(getResultMeta(noFilms).reason, "date_not_published");
assert.ok(getProgrammingDates({ cinemaId: shindagha.ID, now: snapshotNow }).length < DATA_DATES.length, "per-cinema dates omit empty programming days");

const duplicateGroup = await getSessions("0002", "HO00016314", "2026-07-14");
assert.equal(duplicateGroup.length, 1, "indistinguishable presentation rows are grouped");
assert.deepEqual(duplicateGroup[0].sessionIds, ["618294", "618340", "618712", "618843"], "every authoritative source ID remains available");
assert.equal(duplicateGroup[0].sessionId, "618294", "the stable first source ID remains the selectable ID");
assert.equal(duplicateGroup[0].isAvailableForOffer, false, "session-level offer availability is retained");
assert.equal(getResultMeta(duplicateGroup).deduplicatedCount, 3);

const plan = await getSeatPlan("0002", duplicateGroup[0].sessionId);
assert.ok(plan.length > 0);
assert.equal(getResultMeta(plan).mode, "generated_demo");
assert.equal(getResultMeta(plan).verified, false);
assert.match(getResultMeta(plan).warning, /not reserved/i);

const quote = await getPricingQuote("0002", duplicateGroup[0].sessionId, [{ id: "A1" }, { id: "G1", premium: true }]);
assert.equal(quote.total, 105);
assert.equal(quote.demo, true);
assert.equal(quote.verified, false);

const reservation = await reserveSeats({ cinemaId: "0002", sessionId: duplicateGroup[0].sessionId, seats: ["A1", "A2"] });
assert.equal(reservation.reserved, false);
assert.equal(reservation.applied, false);
assert.equal(reservation.reason, "demo_inventory_not_reserved");

const fixture = await searchBooking("wl59lfj");
assert.equal(fixture.ref, "WL59LFJ");
assert.equal(fixture.dataMode, "snapshot_demo");
assert.equal(fixture.verified, false);
const demoRefund = await refundBooking(fixture.ref);
assert.equal(demoRefund.applied, false);
assert.equal(demoRefund.demo, true);
assert.equal(demoRefund.verified, false);
assert.match(demoRefund.ErrorDescription, /DEMO_ONLY/);
const unverifiedIneligibleRefund = await refundBooking("LOCAL-DEMO", {
  booking: { ref: "LOCAL-DEMO", demo: true, verified: false, date: "2026-07-01", showtime: "10:00" },
  now: snapshotNow,
  requireLocalEligibility: true,
});
assert.equal(unverifiedIneligibleRefund.applied, false, "an unverified local booking can never reach a refund write");
assert.equal(unverifiedIneligibleRefund.verified, false);

await assert.rejects(
  () => getScheduledFilms("0002", "not-a-date"),
  (error) => error instanceof VistaClientError && error.code === "INVALID_PROGRAMMING_DATE",
);

const eligibleBooking = {
  ref: "FUTURE",
  date: "2026-07-15",
  showtime: "20:00",
  providerEligibilityVerified: true,
};
assert.equal(assessCancellationEligibility(eligibleBooking, { now: new Date("2026-07-15T12:00:00+04:00") }).status, "eligible");
assert.equal(assessCancellationEligibility({ ...eligibleBooking, providerEligibilityVerified: false }, { now: new Date("2026-07-15T12:00:00+04:00") }).status, "review_required");
assert.equal(assessCancellationEligibility(eligibleBooking, { now: new Date("2026-07-15T19:30:00+04:00") }).reason, "cutoff_passed");
assert.equal(assessCancellationEligibility({ ...eligibleBooking, ticketScanned: true }, { now: new Date("2026-07-15T12:00:00+04:00") }).reason, "ticket_scanned");

console.log("Validated honest snapshot expiry, date-scoped Vista filters, empty-result metadata, session presentation grouping, explicit demo capabilities, verified-mutation contracts, and cancellation policy checks.");
