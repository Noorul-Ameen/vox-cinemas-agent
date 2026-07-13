import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEMO_CARD_STORAGE_KEY,
  isLuhnValid,
  isValidDemoExpiry,
  sanitizeStoredCardMetadata,
  toStoredCardMetadata,
} from "../src/checkoutSafety.js";
import {
  FALLBACK_EXPERIENCE_MEDIA,
  getExperienceMedia,
  getSupportedImageUrl,
} from "../src/mediaData.js";
import { STRINGS } from "../src/i18n/strings.js";

assert.equal(isLuhnValid("4111 1111 1111 1111"), true, "the documented prototype card must pass Luhn validation");
assert.equal(isLuhnValid("4111 1111 1111 1112"), false, "invalid test PAN must fail Luhn validation");
const july2026 = new Date(2026, 6, 13, 12, 0, 0);
assert.equal(isValidDemoExpiry("12/30", july2026), true);
assert.equal(isValidDemoExpiry("07/26", july2026), true, "cards remain valid through the stated expiry month");
assert.equal(isValidDemoExpiry("06/26", july2026), false, "expiry validation must reject an elapsed month");
assert.equal(isValidDemoExpiry("12/25", july2026), false, "expiry validation must reject an elapsed year");
assert.equal(isValidDemoExpiry("13/30", july2026), false, "expiry validation must reject invalid months");

const metadata = toStoredCardMetadata({ pan: "4111 1111 1111 1111", cvv: "123", name: "Test Guest", exp: "12/30" }, "demo-test");
assert.deepEqual(Object.keys(metadata).sort(), ["brand", "exp", "id", "last4", "name"], "stored cards may contain display metadata only");
assert.equal(metadata.last4, "1111");
assert.doesNotMatch(JSON.stringify(metadata), /4111111111111111|"cvv"|"pan"/i, "PAN and security code must not survive metadata conversion");
assert.deepEqual(
  Object.keys(sanitizeStoredCardMetadata({ ...metadata, pan: "4111111111111111", cvv: "123" })).sort(),
  ["brand", "exp", "id", "last4", "name"],
  "storage hydration must strip injected sensitive fields",
);
assert.match(DEMO_CARD_STORAGE_KEY, /demo/i);

const checkoutSource = await readFile(new URL("../src/components/Checkout.jsx", import.meta.url), "utf8");
assert.doesNotMatch(checkoutSource, /Noorul|DEFAULT_CARDS|["']vox_cards["']/, "checkout must not seed personal or legacy default cards");
assert.doesNotMatch(checkoutSource, /VITE_VISTA_BASE/, "Vista read-data configuration must not change checkout behavior");
assert.match(checkoutSource, /return "demo";/, "checkout must default explicitly to simulation mode");
assert.match(checkoutSource, /checkoutMode !== "demo"/, "simulated authorization must be gated to demo mode");
assert.match(checkoutSource, /paymentStartedRef\.current/, "checkout must guard against duplicate payment attempts");
assert.match(checkoutSource, /clearSensitiveForm\(false\)/, "checkout must clear sensitive form data during unmount cleanup");
assert.match(checkoutSource, /clearTimers\(\)/, "checkout must clear pending authorization timers");
assert.match(checkoutSource, /onPaid\?\.\(\{ method, label, checkoutId \}\)/, "payment completion may expose only a safe method label and checkout id");
assert.doesNotMatch(checkoutSource, /\bfetch\s*\(|axios|sendText|sendContextualUpdate|clientTools/, "payment fields must never be sent from the checkout component");
assert.match(checkoutSource, /clearSensitiveForm\(\)/, "sensitive form state must be cleared after use");

assert.ok(getSupportedImageUrl(FALLBACK_EXPERIENCE_MEDIA), "experience fallback artwork must have a renderable URL");
assert.equal(getExperienceMedia("UNKNOWN EXPERIENCE"), FALLBACK_EXPERIENCE_MEDIA, "unknown experiences must use fallback artwork");
assert.equal(getExperienceMedia("UNKNOWN EXPERIENCE", "javascript:alert(1)"), FALLBACK_EXPERIENCE_MEDIA, "invalid session artwork must fall back safely");

const richMediaSource = await readFile(new URL("../src/components/RichMedia.jsx", import.meta.url), "utf8");
const historySource = await readFile(new URL("../src/components/BookingHistory.jsx", import.meta.url), "utf8");
const qrSource = await readFile(new URL("../src/components/BookingQRCode.jsx", import.meta.url), "utf8");
for (const key of ["booking.cinema", "booking.performance", "booking.status"]) assert.match(richMediaSource, new RegExp(key.replace(".", "\\.")), `${key} must be shown on booking confirmation`);
for (const field of ["cinemaName", "booking.date", "history.cancelled", "history.active"]) assert.match(historySource, new RegExp(field.replace(".", "\\.")), `${field} must be represented in booking history`);
assert.match(richMediaSource, /booking\.performanceDate\s*\|\|\s*booking\.sourceDate\s*\|\|\s*booking\.date/, "booking cards must prefer the actual performance date and retain after-midnight source dates");
assert.match(historySource, /booking\.performanceDate\s*\|\|\s*booking\.sourceDate\s*\|\|\s*booking\.date/, "booking history must use the actual performance date fallback chain");
assert.match(richMediaSource, /m\.language\s*\|\|\s*""/, "movie cards must show language even when runtime is present");
assert.match(qrSource, /booking\.qrDemoHint/, "prototype QR codes must state that they are not entry tickets");
assert.match(qrSource, /const providerQrValue =/, "verified bookings must require an explicit provider admission QR payload");
assert.match(qrSource, /if \(!qrValue\)/, "a verified booking without a provider QR payload must not encode its bare reference as an entry ticket");
assert.match(richMediaSource, /booking\.noRefundProcessed/, "demo cancellation must not claim that a refund was initiated");
assert.match(richMediaSource, /pricing\?\.tiers\?\.standard/, "seat prices must come from pricing metadata");
assert.match(richMediaSource, /seats\.demoEstimateLabel/, "demo seat totals must be labeled as prototype estimates");
assert.match(richMediaSource, /seats\.quoteRequiredLabel/, "live pricing must remain pending until a quote is returned");
assert.doesNotMatch(richMediaSource, /\?\s*63\s*:\s*42/, "the seat map must not hard-code pre-quote tier prices");
for (const key of [
  "common.retry", "movies.empty", "movies.error", "showtimes.empty", "showtimes.error",
  "seats.empty", "seats.error", "seats.demoNotice", "seats.standardEstimate", "seats.premiumEstimate",
  "seats.standardQuoteRequired", "seats.premiumQuoteRequired", "seats.demoPricingNotice",
  "seats.quoteRequiredNotice", "seats.demoEstimateLabel", "seats.quoteRequiredLabel", "checkout.testOnly", "checkout.liveUnavailable",
  "booking.demoConfirmed", "booking.cancelledLocal", "booking.noRefundProcessed", "booking.qrDemoHint", "booking.qrReferenceOnly",
  "history.demo", "history.cancelledLocal", "app.paymentSimulated", "app.dateUnavailable",
]) {
  assert.ok(STRINGS.en[key], `${key}: English copy missing`);
  assert.ok(STRINGS.ar[key], `${key}: Arabic copy missing`);
}

console.log("Validated supporting UX: safe simulated checkout, expiry and duplicate-submit guards, booking details, retry states, and experience-art fallback.");
