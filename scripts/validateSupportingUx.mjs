import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEMO_CARD_STORAGE_KEY } from "../src/checkoutSafety.js";
import { guardAgentStateClaim } from "../src/lib/agentStateTruth.js";
import {
  DEMO_CARD_NUMBERS,
  DEMO_SHARE_POINTS,
  DEMO_WALLET_BALANCE,
  createDemoPaymentPlan,
  formatDemoCardNumber,
  maskDemoCardNumber,
  validateDemoCardOffer,
  validateDemoSharePoints,
  validateDemoWallet,
} from "../src/lib/demoPaymentGateway.js";
import { OFFERS } from "../src/offers/offersData.js";
import {
  FALLBACK_EXPERIENCE_MEDIA,
  getExperienceMedia,
  getSupportedImageUrl,
} from "../src/mediaData.js";
import { STRINGS } from "../src/i18n/strings.js";

assert.match(DEMO_CARD_STORAGE_KEY, /demo/i);

const checkoutSource = await readFile(new URL("../src/components/Checkout.jsx", import.meta.url), "utf8");
const demoGatewaySource = await readFile(new URL("../src/components/DemoPaymentGateway.jsx", import.meta.url), "utf8");
assert.doesNotMatch(checkoutSource, /Noorul|DEFAULT_CARDS|["']vox_cards["']/, "checkout must not seed personal or legacy default cards");
assert.doesNotMatch(checkoutSource, /VITE_VISTA_BASE/, "Vista read-data configuration must not change checkout behavior");
assert.match(checkoutSource, /status !== "ready"/, "checkout must guard against duplicate dummy processing");
assert.match(checkoutSource, /onReviewStateChange\?\.\(false\)/, "checkout must release its navigation lock when processing ends or unmounts");
assert.match(checkoutSource, /onComplete\?\.\(\{ checkoutId: checkoutId \|\| order\.checkoutId, payment: nextReceipt \}\)/, "completion must expose the checkout identity and dummy receipt");
assert.match(checkoutSource, /DemoPaymentGateway/, "checkout must render the dummy payment gateway");
assert.match(checkoutSource, /onProcess=\{processPayment\}/, "only a valid reviewed plan may reach dummy processing");
assert.doesNotMatch(`${checkoutSource}\n${demoGatewaySource}`, /\bfetch\s*\(|axios|sendText|sendContextualUpdate|clientTools/, "test checkout data must never leave the non-transactional components");
assert.doesNotMatch(demoGatewaySource, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, "test payment values must remain in memory and must not be persisted");
assert.doesNotMatch(demoGatewaySource, /\b(?:cvv|cvc|cardName|expiryLabel|security code|one-time password|otp)\b/i, "the test gateway must not collect authentication or real cardholder details");
assert.match(demoGatewaySource, /inputMode="numeric"/, "the published test-card field must use a numeric mobile keyboard");
assert.match(demoGatewaySource, /autoComplete="off"/, "the published test-card field must not invite browser payment autofill");
assert.match(demoGatewaySource, /maxLength=\{19\}/, "the test-card field must remain bounded to a formatted 16-digit number");
assert.match(demoGatewaySource, /DEMO_CARD_NUMBERS\.eligible/, "the eligible published test card must be exposed");
assert.match(demoGatewaySource, /DEMO_CARD_NUMBERS\.notEligible/, "the not-eligible published test card must be exposed");
assert.match(demoGatewaySource, /VOX Wallet/, "the gateway must expose VOX Wallet validation");
assert.match(demoGatewaySource, /SHARE points/, "the gateway must expose SHARE points validation");
assert.match(demoGatewaySource, /disabled=\{!plan\.valid\}/, "an incomplete or failed plan must block final payment review");
assert.match(demoGatewaySource, /Final payment summary/, "the guest must receive a separate final review before processing");
assert.match(demoGatewaySource, /Process dummy payment/, "dummy processing must remain a guest-controlled on-screen action");
assert.match(demoGatewaySource, /OFFERS\.map/, "all published offer groups must be selectable");
assert.doesNotMatch(`${checkoutSource}\n${demoGatewaySource}`, /Apple Pay|Samsung Pay|walletButton|reviewCard/i, "non-integrated payment brands must not appear as checkout controls");

assert.equal(formatDemoCardNumber(DEMO_CARD_NUMBERS.eligible), "4111 1111 1111 1111", "eligible test card formatting must be deterministic");
assert.equal(maskDemoCardNumber(DEMO_CARD_NUMBERS.notEligible), "**** **** **** 4444", "test card masking must expose only the final four digits");
assert.equal(validateDemoCardOffer(DEMO_CARD_NUMBERS.eligible).status, "eligible", "the eligible test card must pass offer validation");
assert.equal(validateDemoCardOffer(DEMO_CARD_NUMBERS.notEligible).status, "not_eligible", "the second test card must return a not-eligible result");
assert.equal(validateDemoCardOffer("4000000000000000").status, "unrecognized", "every unpublished card number must fail closed");
assert.equal(validateDemoWallet(84).eligible, true, "the published test wallet balance must validate a normal checkout amount");
assert.equal(validateDemoWallet(DEMO_WALLET_BALANCE + 1).status, "insufficient", "wallet validation must fail above the test balance");
assert.equal(validateDemoSharePoints(84).eligible, true, "the published SHARE balance must validate a normal checkout amount");
assert.equal(validateDemoSharePoints(DEMO_SHARE_POINTS).status, "insufficient", "SHARE validation must account for the points conversion");
const fabShareOffer = OFFERS.find((offer) => offer.id === "fab-share");
assert.ok(fabShareOffer, "the published FAB SHARE offer must remain available");
const splitPlan = createDemoPaymentPlan({
  amount: 84,
  ticketCount: 2,
  offer: fabShareOffer,
  cardNumber: DEMO_CARD_NUMBERS.eligible,
  shareAed: 10,
  walletAed: 20,
});
assert.equal(splitPlan.valid, true, "eligible BOGO plus three-way funding must produce a valid plan");
assert.deepEqual(splitPlan.amounts, {
  originalTotal: 84,
  offerDiscount: 42,
  payableTotal: 42,
  shareAed: 10,
  walletAed: 20,
  cardAed: 12,
}, "BOGO, SHARE, wallet, and card amounts must reconcile exactly");
assert.equal(createDemoPaymentPlan({
  amount: 84,
  ticketCount: 2,
  offer: fabShareOffer,
  cardNumber: DEMO_CARD_NUMBERS.notEligible,
}).reason, "offer_card_not_eligible", "the second published card must fail every selected offer");
assert.equal(createDemoPaymentPlan({
  amount: 84,
  ticketCount: 2,
  walletAed: 84,
}).amounts.cardAed, 0, "wallet funds may cover the full payable amount without a card");
assert.equal(createDemoPaymentPlan({
  amount: 84,
  ticketCount: 2,
  cardNumber: DEMO_CARD_NUMBERS.eligible,
}).amounts.cardAed, 84, "declining SHARE and wallet redemption must leave the full amount on the test card");

const visibleHorrorMovies = {
  view: "movies",
  movies: [{ title: "Horror One" }, { title: "Horror Two" }],
  cinema: { name: "Mall of the Emirates" },
};
const correctedEnglishDiscovery = guardAgentStateClaim("Which genre would you like?", { stage: visibleHorrorMovies, locale: "en" });
assert.match(correctedEnglishDiscovery, /2 movie options are shown/i, "visible horror results must replace a stale English genre question");
assert.doesNotMatch(correctedEnglishDiscovery, /\bgenre\b/i, "corrected English copy must not ask for the already supplied genre");
const correctedArabicDiscovery = guardAgentStateClaim("أي نوع من الأفلام تفضل؟", { stage: visibleHorrorMovies, locale: "ar" });
assert.doesNotMatch(correctedArabicDiscovery, /أي نوع|ما نوع|ماذا تفضل/u, "visible movie results must replace a stale Arabic preference question");

assert.ok(getSupportedImageUrl(FALLBACK_EXPERIENCE_MEDIA), "experience fallback artwork must have a renderable URL");
assert.equal(getExperienceMedia("UNKNOWN EXPERIENCE"), FALLBACK_EXPERIENCE_MEDIA, "unknown experiences must use fallback artwork");
assert.equal(getExperienceMedia("UNKNOWN EXPERIENCE", "javascript:alert(1)"), FALLBACK_EXPERIENCE_MEDIA, "invalid session artwork must fall back safely");

const richMediaSource = await readFile(new URL("../src/components/RichMedia.jsx", import.meta.url), "utf8");
const historySource = await readFile(new URL("../src/components/BookingHistory.jsx", import.meta.url), "utf8");
const qrSource = await readFile(new URL("../src/components/BookingQRCode.jsx", import.meta.url), "utf8");
const handoverSource = await readFile(new URL("../src/components/HandoverPanel.jsx", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const typedGatewayCompletionStart = appSource.indexOf("const checkoutForSummarySave");
const typedGatewayCompletion = appSource.slice(
  typedGatewayCompletionStart,
  appSource.indexOf("if (checkoutPaymentActiveRef.current)", typedGatewayCompletionStart),
);
assert.match(typedGatewayCompletion, /restoreActiveCheckout\(\)/, "a typed summary request must restore the guest-controlled gateway");
assert.match(typedGatewayCompletion, /review the final split and process the dummy payment on screen/i, "typed guidance must require on-screen review and processing");
assert.doesNotMatch(typedGatewayCompletion, /handleCheckoutReviewComplete\(/, "typed chat must never bypass final review or trigger dummy processing");
const retryableLazySource = await readFile(new URL("../src/components/RetryableLazy.jsx", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const voxiPromptSource = await readFile(new URL("../src/lib/voxiPrompt.js", import.meta.url), "utf8");
const offerFactsSource = await readFile(new URL("../src/offers/offerFacts.js", import.meta.url), "utf8");
const i18nProviderSource = await readFile(new URL("../src/i18n/I18nProvider.jsx", import.meta.url), "utf8");
const bookingStoreSource = await readFile(new URL("../src/bookingStore.js", import.meta.url), "utf8");
assert.match(richMediaSource, /requestedTarget != null && Number\.isFinite\(numericTarget\) && numericTarget > 0 \? numericTarget : null/, "an absent conversational seat target must not render as a stray zero above the screen");
for (const key of ["booking.cinema", "booking.performance", "booking.status"]) assert.match(richMediaSource, new RegExp(key.replace(".", "\\.")), `${key} must be shown on booking confirmation`);
for (const field of ["cinemaName", "booking.date", "history.cancelled", "history.active"]) assert.match(historySource, new RegExp(field.replace(".", "\\.")), `${field} must be represented in booking history`);
assert.match(historySource, /const current = isCurrentBooking\(booking\)/, "booking history must classify each record using the shared current-booking rules");
assert.match(historySource, /: !current\s*\? t\("history\.past"\)/, "elapsed records must be labelled as past shows");
assert.match(historySource, /\{current && cancelBooking && \(/, "only current bookings may expose the cancellation action");
assert.match(richMediaSource, /booking\.performanceDate\s*\|\|\s*booking\.sourceDate\s*\|\|\s*booking\.date/, "booking cards must prefer the actual performance date and retain after-midnight source dates");
assert.match(richMediaSource, /sessionSummaryParts[\s\S]*findIndex\([\s\S]*trim\(\)\.toLowerCase\(\)[\s\S]*join\(" · "\)/, "booking summaries must not repeat an experience when the screen label is identical");
assert.match(richMediaSource, /uniqueDisplayParts\(s\.exp, s\.screen\)\.slice\(1\)/, "showtime cards must not repeat identical experience and screen labels");
assert.match(historySource, /booking\.performanceDate\s*\|\|\s*booking\.sourceDate\s*\|\|\s*booking\.date/, "booking history must use the actual performance date fallback chain");
assert.match(richMediaSource, /m\.language\s*\|\|\s*""/, "movie cards must show language even when runtime is present");
assert.match(qrSource, /booking\.qrDemoHint/, "reference QR codes must direct guests to their official VOX ticket for entry");
assert.match(qrSource, /booking\.deviceRef/, "device-only reference QR titles must not claim a provider booking reference");
assert.match(qrSource, /const providerQrValue =/, "verified bookings must require an explicit provider admission QR payload");
assert.match(qrSource, /if \(!qrValue\)/, "a verified booking without a provider QR payload must not encode its bare reference as an entry ticket");
assert.match(retryableLazySource, /React\.lazy\([\s\S]*useCurrentManifest[\s\S]*loadCurrentChunkFromManifest[\s\S]*@vite-ignore[\s\S]*retryUrl[\s\S]*: loader[\s\S]*\[loader, manifestKey, attempt, retryUrl, useCurrentManifest, failedChunkUrl\]/, "retrying a failed lazy panel must create a fresh current-release importer instead of rethrowing React's cached rejection");
assert.match(retryableLazySource, /const onStaleVersionRef = React\.useRef\(onStaleVersion\)[\s\S]*onStaleVersionRef\.current = onStaleVersion/, "the latest stale-version callback must be retained without changing the lazy component type");
assert.doesNotMatch(retryableLazySource, /\[[^\]]*\bonStaleVersion\b[^\]]*\]/, "stale-version callback identity changes must not remount an active lazy transport");
assert.match(retryableLazySource, /failed to fetch dynamically imported module[\s\S]*chunkloaderror/i, "the lazy boundary must recognize deployed chunk loading failures");
assert.match(retryableLazySource, /function buildChunkRetryUrl[\s\S]*chunk\.origin !== base\.origin[\s\S]*voxi_retry[\s\S]*return chunk\.href/, "chunk retries must use a same-origin cache-busted module URL");
assert.match(retryableLazySource, /canUseManifest = chunkError[\s\S]*setUseCurrentManifest\(canUseManifest\)[\s\S]*setRetryUrl\([\s\S]*buildChunkRetryUrl[\s\S]*setAttempt\(nextAttempt\)/, "chunk failures must prefer the current manifest and retain a same-release cache-busted fallback");
assert.match(retryableLazySource, /failed\.pathname !== chunk\.pathname[\s\S]*onStaleVersion[\s\S]*reloadImpl\(\)/, "a changed deployment hash must preserve the journey before refreshing to the current release");
assert.match(appSource, /saveReleaseJourneyRecovery[\s\S]*preserveJourneyForReleaseReload[\s\S]*onStaleVersion=\{preserveJourneyForReleaseReload\}/, "release refreshes must keep bounded session-scoped journey state");
assert.match(appSource, /RELEASE_RECOVERABLE_STAGE_VIEWS = new Set\(\[[\s\S]*"empty"[\s\S]*"discovery"/, "release recovery must preserve a safe empty or FAQ-only conversation");
assert.match(appSource, /function isSafeReleaseJourneyRecoveryRecord[\s\S]*function takeReleaseJourneyRecovery/, "release recovery must use one bounded nested schema");
assert.match(appSource, /const recovery = \{ \.\.\.value, version: 1, savedAt: Date\.now\(\) \};[\s\S]*if \(!isSafeReleaseJourneyRecoveryRecord\(recovery, recovery\.savedAt\)\) return false/, "unsupported recovery state must never authorize a release reload");
assert.match(appSource, /typeof value === "boolean"[\s\S]*isSafeReleaseRecoveryLocalizedText/, "boolean cinema error state must remain safely recoverable");
assert.match(appSource, /activeStage\?\.view === "loading"[\s\S]*view: "discovery"/, "transient loading stages must recover to an interactive discovery prompt");
assert.match(appSource, /function isSafeReleaseRecoveryPlanMeta[\s\S]*warning[\s\S]*verified/, "release recovery must validate renderable seat-plan metadata");
assert.match(appSource, /function releaseRecoveryTransactionsMatch[\s\S]*function isConsistentReleaseRecoveryStage/, "release recovery must reject contradictory checkout identities");
assert.match(appSource, /checkoutPaymentActiveRef\.current[\s\S]*cancellationFlowRef\.current[\s\S]*return false/, "release rollover must not interrupt a review save or cancellation confirmation");
assert.match(retryableLazySource, /componentRef = null[\s\S]*componentRef \? \{ ref: componentRef \}/, "the isolated transport must retain its imperative ref through the retryable lazy boundary");
assert.match(retryableLazySource, /fallback=\{\(\{ error \}\) =>[\s\S]*onClick=\{\(\) => retry\(error\)\}/, "the retry action must classify the error captured by its boundary");
assert.match(appSource, /loader=\{loadCheckout\}[\s\S]*errorTitle=\{t\("error\.title"\)\}/, "checkout must use the retryable lazy boundary without discarding the active App journey");
for (const loader of ["loadElevenLabsTransport", "loadBookingHistory", "loadOffersPanel", "loadHandoverPanel"]) {
  assert.match(appSource, new RegExp(`<RetryableLazy[\\s\\S]{0,400}loader=\\{${loader}\\}`), `${loader} must render inside its own retryable boundary`);
}
assert.match(appSource, /loader=\{loadElevenLabsTransport\}[\s\S]{0,240}componentRef=\{transportRef\}/, "the deferred ElevenLabs transport must keep its imperative connection API");
assert.doesNotMatch(appSource, /\b(?:React\.)?lazy\s*\(|<Suspense\b/, "App must not contain a raw lazy render that can escape a feature-local boundary");
assert.match(richMediaSource, /loader=\{loadBookingQRCode\}[\s\S]*retryLabel=\{t\("error\.retry"\)\}/, "the booking QR must recover from a transient chunk load failure in place");
assert.match(mainSource, /failed to fetch dynamically imported module[\s\S]*window\.location\.reload\(\)/, "the global boundary must reload for any remaining cached lazy chunk failure");
assert.match(mainSource, /this\.props\.t\("error\.body"\)/, "the global recovery boundary must render generic localized guidance");
assert.doesNotMatch(mainSource, /<p\b[^>]*>\{String\(this\.state\.err/, "raw exception details must never be shown to customers");
for (const locale of ["en", "ar"]) assert.ok(STRINGS[locale]["error.body"], `${locale}: generic recovery guidance is missing`);
assert.match(richMediaSource, /booking\.noRefundProcessed/, "device-only cancellation must not claim that a refund was initiated");
assert.match(richMediaSource, /pricing\?\.tiers\?\.standard/, "seat prices must come from pricing metadata");
assert.match(richMediaSource, /seats\.demoEstimateLabel/, "estimated seat totals must defer final pricing to checkout");
assert.match(richMediaSource, /seats\.quoteRequiredLabel/, "live pricing must remain pending until a quote is returned");
assert.doesNotMatch(richMediaSource, /\?\s*63\s*:\s*42/, "the seat map must not hard-code pre-quote tier prices");
assert.match(richMediaSource, /s\.availabilityVerified === true[\s\S]*showtimes\.seats[\s\S]*showtimes\.previewAvailability/, "snapshot showtimes must not present generated seat counts as live inventory");
assert.match(appSource, /<Showtimes[^>]+error=\{localizedStageMessage\(stage, "error", locale\)\}[^>]+onRetry=/, "a failed showtime request must render a localized scoped retry action");
assert.doesNotMatch(appSource, /app\.(?:text|voice)Connected/, "transport readiness must not be added to customer chat");
for (const key of [
  "common.retry", "movies.empty", "movies.error", "showtimes.empty", "showtimes.error", "showtimes.previewAvailability",
  "seats.empty", "seats.error", "seats.demoNotice", "seats.standardEstimate", "seats.premiumEstimate",
  "seats.standardQuoteRequired", "seats.premiumQuoteRequired", "seats.demoPricingNotice",
  "seats.quoteRequiredNotice", "seats.demoEstimateLabel", "seats.quoteRequiredLabel", "checkout.testOnly", "checkout.liveUnavailable",
  "booking.demoConfirmed", "booking.cancelledLocal", "booking.noRefundProcessed", "booking.qrDemoHint", "booking.qrReferenceOnly",
  "history.demo", "history.cancelledLocal", "history.cancelLocal", "history.past", "booking.deviceRef",
  "checkout.saveSummary", "checkout.saveSummaryHint", "app.paymentSimulated", "app.dateUnavailable",
]) {
  assert.ok(STRINGS.en[key], `${key}: English copy missing`);
  assert.ok(STRINGS.ar[key], `${key}: Arabic copy missing`);
}

for (const locale of ["en", "ar"]) {
  const visibleCopy = Object.values(STRINGS[locale]).join("\n");
  assert.doesNotMatch(
    visibleCopy,
    /\bprototype\b|\bdemo only\b|\bprototype simulation\b|نموذج أولي/i,
    `${locale}: leadership-facing UI may describe the bounded dummy payment but must not label the product a prototype`,
  );
}
assert.match(STRINGS.en["checkout.demoDisclaimer"], /does not charge a card or reserve cinema inventory/i, "checkout must keep its transaction-boundary disclosure");
assert.match(STRINGS.en["checkout.demoDisclaimer"], /official VOX booking channel/i, "checkout must direct real purchases to an official channel");
assert.match(STRINGS.en["checkout.testNotice"], /estimated amount/i, "checkout must disclose that its amount is not an authoritative VOX quote");
assert.match(STRINGS.en["seats.demoNotice"], /official VOX booking channel/i, "seat guidance must distinguish the official booking channel from this review checkout");
assert.match(STRINGS.en["offers.disclaimer"], /official VOX website or app checkout/i, "offer eligibility must point to the official VOX website or app checkout");
assert.match(i18nProviderSource, /safeCurrency[\s\S]*catch[\s\S]*currency: "AED"/, "currency formatting must fail safely even if an untrusted currency reaches the renderer");
assert.match(STRINGS.en["booking.cancelDemoQuestion"], /Mark booking .* as cancelled on this device/, "device-only cancellation must describe the persisted cancelled state");
assert.match(STRINGS.en["booking.cancelDemoQuestion"], /will not contact VOX or issue a refund/, "device-only cancellation must keep its transaction-boundary disclosure");
assert.match(STRINGS.en["booking.cancelledLocal"], /Marked cancelled on this device/, "device-only cancellation must not claim the stored record was removed");
assert.equal(STRINGS.en["history.cancelledLocal"], "Cancelled on device", "history must show the device-only cancellation boundary");
assert.equal(STRINGS.en["history.cancelLocal"], "Mark cancelled", "history must not imply provider cancellation for a device summary");
assert.match(STRINGS.en["booking.qrDemoHint"], /official VOX ticket/, "reference QR must direct guests to an official admission ticket");
assert.match(handoverSource, /showDebug\s*=\s*false/, "leadership view must hide handover diagnostics by default");
assert.match(STRINGS.en["handover.readyBody"], /No external support connection has been started/, "handover must state that it only prepares a summary");
assert.doesNotMatch(handoverSource, /agent queue|pick up this conversation|UserRound|Headphones/i, "handover presentation must not imply a live agent or queue");
assert.match(appSource, /connectingStep:\s*t\("handover\.preparingStep"\)/, "handover progress must say preparing rather than connecting");
assert.doesNotMatch(appSource, /booking (?:was|is) removed from this device|Booking summary [^\n]+ removed only from this device/i, "persisted cancellations must not be described as removed records");
assert.match(voxiPromptSource, /two published test card numbers[\s\S]*without transmitting or storing it/, "the voice prompt must describe the bounded test-card contract");
assert.match(voxiPromptSource, /combine optional SHARE points and VOX Wallet value[\s\S]*never charges a real card/, "the voice prompt must keep split funding non-transactional");
assert.match(voxiPromptSource, /final review[\s\S]*Process dummy payment[\s\S]*guest-controlled on-screen actions/, "the voice prompt must leave every payment-step choice to the guest");
assert.match(voxiPromptSource, /dummy payment was processed only after authoritative widget context/, "processed receipt claims must synchronize with authoritative UI state");
assert.match(voxiPromptSource, /Never ask in chat for a card number[\s\S]*Never ask the guest to enter a real card/, "the agent must never solicit card details in chat");
assert.match(richMediaSource, /\["confirmed_demo", "summary_saved", "locally_stored"\]/, "booking cards must classify every device-summary status safely");
assert.match(historySource, /\["confirmed_demo", "summary_saved", "locally_stored"\]/, "history must classify every device-summary status safely");
assert.match(bookingStoreSource, /\["confirmed_demo", "summary_saved", "locally_stored"\][\s\S]*result\.verified = false[\s\S]*result\.paymentStatus = "simulated_not_charged"/, "storage normalization must fail closed for contradictory device summaries");
assert.match(offerFactsSource, /official VOX website or app checkout/, "bank-offer redemption must point to the official VOX checkout");
assert.doesNotMatch(appSource, /\bPrototype (?:checkout|booking|only)\b|الحجز التجريبي|نموذج تجريبي/i, "conversation copy must not label the overall experience as a prototype");
assert.match(qrSource, /size\s*=\s*104/, "booking QR should remain compact inside the mobile widget");

console.log("Validated supporting UX: safe checkout preview, leadership-ready copy, compact booking details, retry states, and experience-art fallback.");
