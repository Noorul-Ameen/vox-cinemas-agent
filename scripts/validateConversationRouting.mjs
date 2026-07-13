import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isDirectCinemaSelectionUtterance,
  isCinemaSelectionTurn,
  resolveCinemaCandidate,
} from "../src/lib/cinemaRouting.js";
import { normalizeElevenLabsMessageEvent } from "../src/lib/conversationMessage.js";
import * as vista from "../src/vistaClient.js";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const richMedia = fs.readFileSync(new URL("../src/components/RichMedia.jsx", import.meta.url), "utf8");
const cinemas = vista.getCinemas();

function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${label} start marker must exist`);
  assert.notEqual(end, -1, `${label} end marker must exist`);
  assert.ok(end > start, `${label} markers must be ordered`);
  return source.slice(start, end);
}

const mallOfTheEmirates = cinemas.find((cinema) => cinema.id === "0002");
assert.ok(mallOfTheEmirates, "the Mall of the Emirates cinema fixture must exist");
const observedLiveVoiceEvent = {
  source: "user",
  message: "I want to choose Mall of the Emirates Cinema.",
};
assert.deepEqual(normalizeElevenLabsMessageEvent(observedLiveVoiceEvent), {
  role: "user",
  source: "user",
  text: observedLiveVoiceEvent.message,
}, "the public ElevenLabs v0.7 onMessage voice-transcript shape must normalize as a user turn");
assert.equal(
  isDirectCinemaSelectionUtterance({
    text: normalizeElevenLabsMessageEvent(observedLiveVoiceEvent).text,
    view: "cinemas",
    cinemaMatch: resolveCinemaCandidate(cinemas, observedLiveVoiceEvent.message),
  }),
  true,
  "the observed live voice transcript must override generic cinema FAQ tags and select the visible cinema",
);
assert.equal(normalizeElevenLabsMessageEvent({ source: "ai", message: "Selected." })?.role, "agent", "ElevenLabs ai replies must map to the agent transcript role");
for (const utterance of [
  "Mall of the Emirates",
  "Mall of Emirates",
  "MOE",
  "model Emirates",
  "I want to choose Mall of the Emirates Cinema.",
  "مول الإمارات",
  "show movies at mall emirates",
]) {
  assert.equal(
    resolveCinemaCandidate(cinemas, utterance)?.id,
    mallOfTheEmirates.id,
    `voice/text cinema resolver must recognize: ${utterance}`,
  );
}

for (const unrelatedEmiratesPhrase of ["Emirates NBD", "ENBD card", "Emirates NBD offer"]) {
  assert.equal(
    resolveCinemaCandidate(cinemas, unrelatedEmiratesPhrase),
    null,
    `bank/offer language must not be mistaken for Mall of the Emirates: ${unrelatedEmiratesPhrase}`,
  );
}

for (const broadCityRequest of [
  "I want to book in Abu Dhabi",
  "Show me movies in Dubai",
  "Book two tickets in Sharjah",
  "I want Ajman",
  "VOX Fujairah please",
  "أريد الحجز في أبوظبي",
  "أريد أفلام في دبي",
]) {
  assert.equal(
    resolveCinemaCandidate(cinemas, broadCityRequest),
    null,
    `a city-level request must ask for a venue instead of silently selecting a cinema: ${broadCityRequest}`,
  );
}

for (const [explicitVenue, expectedId] of [
  ["Abu Dhabi Mall", "0036"],
  ["I want to book at Abu Dhabi Mall", "0036"],
  ["City Centre Sharjah", "0035"],
  ["City Centre Ajman", "0004"],
  ["City Centre Fujairah", "0006"],
  ["Dubai Festival City", "0105"],
  ["أبوظبي مول", "0036"],
  ["سيتي سنتر الشارقة", "0035"],
]) {
  assert.equal(
    resolveCinemaCandidate(cinemas, explicitVenue)?.id,
    expectedId,
    `an explicit cinema venue must continue to resolve: ${explicitVenue}`,
  );
}

for (const cinema of cinemas) {
  assert.equal(resolveCinemaCandidate(cinemas, cinema.id)?.id, cinema.id, `${cinema.id} must resolve by ID`);
  assert.equal(resolveCinemaCandidate(cinemas, cinema.name)?.id, cinema.id, `${cinema.name} must resolve by full picker label`);
}

assert.equal(isCinemaSelectionTurn({
  view: "movies",
  intent: "booking",
  actionIntent: null,
  hasFaq: false,
  cinemaMatch: mallOfTheEmirates,
}), true, "a bare cinema reply must advance an active movie-selection journey");
assert.equal(isCinemaSelectionTurn({
  view: "cinemas",
  intent: null,
  actionIntent: null,
  hasFaq: false,
  cinemaMatch: mallOfTheEmirates,
}), true, "a bare cinema reply must advance the cinema picker");
assert.equal(isCinemaSelectionTurn({
  view: "cinemas",
  intent: null,
  actionIntent: null,
  hasFaq: true,
  cinemaMatch: mallOfTheEmirates,
}), true, "an explicit cinema-picker reply must advance even when broad FAQ keywords also match");
assert.equal(isCinemaSelectionTurn({
  view: "empty",
  intent: null,
  actionIntent: null,
  hasFaq: false,
  cinemaMatch: mallOfTheEmirates,
}), true, "an unambiguous bare cinema reply must start the journey from the home state");
assert.equal(isCinemaSelectionTurn({
  view: "empty",
  intent: null,
  actionIntent: "booking",
  hasFaq: false,
  cinemaMatch: mallOfTheEmirates,
}), true, "an explicit first-turn booking request may select its named cinema");
assert.equal(isCinemaSelectionTurn({
  view: "movies",
  intent: "booking",
  actionIntent: null,
  hasFaq: true,
  cinemaMatch: mallOfTheEmirates,
}), false, "an FAQ answer must not silently reroute the active cinema");
assert.equal(isCinemaSelectionTurn({
  view: "movies",
  intent: "booking",
  actionIntent: null,
  hasFaq: false,
  cinemaMatch: null,
}), false, "a journey must not advance without an unambiguous cinema match");

for (const informationQuestion of [
  "What time does Mall of the Emirates cinema open?",
  "Does Mall of the Emirates cinema have parking?",
  "Tell me about Mall of the Emirates cinema",
]) {
  assert.equal(isDirectCinemaSelectionUtterance({
    text: informationQuestion,
    view: "cinemas",
    cinemaMatch: resolveCinemaCandidate(cinemas, informationQuestion),
  }), false, `cinema information must remain on the FAQ path: ${informationQuestion}`);
}

const routeRecognizedCinema = sliceBetween(app, "const routeRecognizedCinema", "const clearConversationState", "recognized cinema router");
assert.match(routeRecognizedCinema, /clientTools\.show_movie_selection\(\{[\s\S]*cinemaId:\s*matchedCinema\.id/, "recognized cinema routing must load that cinema's movies locally");
assert.match(routeRecognizedCinema, /scheduleDate:\s*requestedDate\s*\|\|\s*scheduleDateRef\.current/, "recognized cinema routing must preserve the requested or selected programming date");

const voiceMessageFlow = sliceBetween(app, "onMessage: (message) =>", "onError:", "SDK voice message flow");
const typedMessageFlow = sliceBetween(app, "const sendText", "const sendUiTurn", "typed message flow");
assert.match(voiceMessageFlow, /normalizeElevenLabsMessageEvent\(message\)/, "SDK events must be normalized from the documented ElevenLabs onMessage contract");
for (const [label, flow] of [["SDK voice", voiceMessageFlow], ["typed", typedMessageFlow]]) {
  assert.match(flow, /isDirectCinemaSelectionUtterance\(/, `${label} must identify a direct cinema reply before FAQ rendering`);
  assert.match(flow, /directCinemaSelection\s*\|\|\s*directCancellation\s*\?\s*\{\s*matches:\s*\[\],\s*context:\s*""\s*\}\s*:\s*prepareFaqContext/, `${label} must not let generic FAQ tags swallow direct cinema or cancellation actions`);
  assert.match(flow, /dismissStaleTransactionalView\(/, `${label} turns must dismiss a stale booking/history panel when the turn is unrelated`);
  assert.ok(flow.indexOf("dismissStaleTransactionalView(") < flow.indexOf("prepareFaqContext("), `${label} turns must clear hidden transactional context before an FAQ panel replaces it`);
  assert.match(flow, /classifyBookingHistoryRequest\(/, `${label} must use the shared bilingual current/history classifier`);
  assert.match(flow, /openHistory\(\{\s*notifyAgent:\s*false,\s*forceOpen:\s*true,\s*activeOnly:\s*historyRequest\.activeOnly\s*\}\)/, `${label} must apply the classifier's active-only scope to the visible list`);
  assert.match(flow, /cancellationReply:\s*decision\s*!==\s*null/, `${label} cancellation confirmations must keep the active booking panel`);
  assert.match(flow, /isDirectCancellationRequest\(/, `${label} must classify contextual cancellation before stale-view cleanup`);
  assert.ok(flow.indexOf("isDirectCancellationRequest(") < flow.indexOf("dismissStaleTransactionalView("), `${label} must recognize contextual cancellation before stale booking context can be dismissed`);
  assert.match(flow, /actionIntent:\s*directCancellation\s*\?\s*["']cancellation["']\s*:\s*actionIntent/, `${label} must preserve the visible booking while shared cancellation routing begins`);
  assert.match(flow, /routeCancellationTurn\(/, `${label} must initiate cancellation through the shared local router`);
  assert.match(flow, /handleCancellationDecision\(decision,\s*\{\s*source:\s*["']conversation["']\s*\}\)/, `${label} must continue pending yes/no cancellation through the shared decision handler`);
  assert.match(flow, /routeRecognizedCinema\(details\.cinema,\s*requestedDate\)/, `${label} turns must route a recognized cinema without requiring a picker click`);
  assert.match(flow, /clientTools\.show_movie_selection\(\{\}\)/, `${label} first-turn movie discovery without a cinema must display the cinema picker`);
  assert.match(flow, /Only the VOX Cinemas UAE cinema picker is displayed; no movie list is visible yet/, `${label} context must not claim that movies are shown before a cinema is selected`);
}

const staleViewHandler = sliceBetween(app, "const dismissStaleTransactionalView", "const prepareFaqContext", "stale transactional-view handler");
assert.match(staleViewHandler, /\["booking",\s*"history"\]\.includes\(current\.view\)/, "only completed booking/history views should be automatically dismissed");
assert.match(staleViewHandler, /historyRequested[\s\S]*actionIntent === "booking_history"[\s\S]*actionIntent === "cancellation"/, "booking-history and cancellation turns must preserve their active panel");
assert.match(staleViewHandler, /cancellationReply[\s\S]*Boolean\(cancellationFlowRef\.current\)/, "pending yes/no cancellation turns must preserve the active booking panel");
assert.match(staleViewHandler, /clearPendingOrder\(\)[\s\S]*bookingRef\.current\s*=\s*null[\s\S]*setBooking\(null\)/, "abandoning a stale booking/history panel must clear hidden checkout and active-booking context");
assert.match(staleViewHandler, /showStage\(canRestoreMovies\s*\?[\s\S]*view:\s*"movies"[\s\S]*:\s*\{\s*view:\s*"empty"\s*\}\)/, "an unrelated turn must hide the stale booking/history panel while preserving available movie context");

const offersTool = sliceBetween(app, "show_offers: async", "handover_to_agent:", "offers tool");
assert.match(offersTool, /current\.view === "booking"\s*\?\s*bookingRef\.current\s*:\s*null/, "offers must use a booking's experience only while that booking is visibly active");
assert.match(offersTool, /current\.view === "checkout"\s*\?\s*pendingOrderRef\.current\s*:\s*null/, "offers must use a pending order only while checkout is visibly active");

const mainRender = sliceBetween(app, "<main ref={scrollRef}", "</main>", "inline stage render");
const guardedPanels = [
  ["FaqPanel", "faq"],
  ["CinemaPicker", "cinemas"],
  ["MovieGrid", "movies"],
  ["Showtimes", "showtimes"],
  ["SeatMap", "seatmap"],
  ["Checkout", "checkout"],
  ["BookingCard", "booking"],
  ["BookingHistory", "history"],
  ["OffersPanel", "offers"],
  ["HandoverPanel", "handover"],
];
for (const [component, view] of guardedPanels) {
  assert.equal((mainRender.match(new RegExp(`<${component}\\b`, "g")) || []).length, 1, `${component} must have one render site`);
  assert.match(mainRender, new RegExp(`stage\\.view === ["']${view}["'][\\s\\S]{0,2400}<${component}\\b`), `${component} must be guarded by its exclusive stage.view`);
}
assert.match(mainRender, /stage\.view === "booking" && displayedBooking && <BookingCard\b/, "a stored booking must not render unless booking is the active view");
assert.match(mainRender, /stage\.view === "history" && <BookingHistory\b/, "booking history must not render unless history is the active view");
assert.match(mainRender, /<BookingCard\b[\s\S]{0,1200}cancellation=\{[\s\S]{0,350}\bcancellationState\b/, "BookingCard must render the booking-scoped shared cancellation state used by text, voice, and touch");
assert.match(mainRender, /<BookingCard\b[\s\S]{0,1200}onRequestCancel=\{/, "BookingCard must initiate cancellation through its parent-owned router");
assert.match(mainRender, /<BookingCard\b[\s\S]{0,1200}onConfirm=\{/, "BookingCard confirmation must use the shared cancellation decision handler");

assert.match(app, /const routeCancellationTurn\s*=\s*/, "App must define one shared local cancellation initiation router");
assert.ok((app.match(/routeCancellationTurn\(/g) || []).length >= 2, "the shared cancellation router must be used by both SDK voice and typed turns");
assert.match(app, /const IDLE_CANCELLATION_STATE\s*=\s*Object\.freeze\(\{\s*phase:\s*["']idle["']/, "cancellation rendering must begin from an explicit idle phase");
const cancellationTool = sliceBetween(app, "show_booking_for_cancellation:", "show_offers:", "cancellation tool");
assert.match(cancellationTool, /setHistoryFilter\(["']active["']\)/, "zero or multiple cancellation targets must render the active-bookings list with matching current-booking copy");
const unresolvedCancellationTarget = sliceBetween(cancellationTool, "if (!target.bookingRef)", "if ([\"already_cancelled\", \"not_current_booking\"]", "unresolved cancellation target");
assert.match(unresolvedCancellationTarget, /dismissPendingCancellation\(["']target_selection_required["']\)/, "zero or multiple targets must clear pending cancellation state before showing history");
assert.doesNotMatch(unresolvedCancellationTarget, /setCancellationFlow\(/, "a target-selection outcome must not create a hidden confirmation or error flow");
const inactiveCancellationTarget = sliceBetween(cancellationTool, "if ([\"already_cancelled\", \"not_current_booking\"]", "const existingFlow", "inactive cancellation target");
assert.match(inactiveCancellationTarget, /dismissPendingCancellation\(target\.reason\)/, "known cancelled or past bookings must end the shared flow without confirmation");
assert.match(inactiveCancellationTarget, /eligible:\s*false[\s\S]{0,180}confirmationRequired:\s*false/, "known past bookings must be returned as ineligible without confirmation");
assert.ok(cancellationTool.indexOf("if (!isCurrentBooking(displayed))") < cancellationTool.indexOf("if (demoOnly)"), "a provider or fixture result must be rejected as past before any local cancellation confirmation is offered");
assert.match(cancellationTool, /cancellationRequestId[\s\S]{0,900}cancellationRequestIsStale\(\)[\s\S]{0,300}staleCancellationResult\(\)/, "an obsolete booking lookup must not restore cancellation state after the guest moves to another task");
assert.match(app, /const bookingHistoryTurnContext[\s\S]{0,900}no active bookings saved on this device[\s\S]{0,300}Do not ask them to select a booking/, "an empty current-booking result must not ask the guest to select a missing booking");
assert.match(app, /cancellationFlowRef\.current[\s\S]{0,120}scroller\.scrollTop\s*=\s*scroller\.scrollHeight/, "new conversation messages must keep an active cancellation confirmation in view");
const cancellationDecisionHandler = sliceBetween(app, "const handleCancellationDecision", "const publishCancellationDecision", "cancellation decision handler");
assert.match(cancellationDecisionHandler, /flow\.phase === ["']error["'][\s\S]{0,450}dismissPendingCancellation\(["']error_dismissed["']\)/, "the error-panel keep action must dismiss the failed flow while leaving the booking unchanged");
const cancellationContext = sliceBetween(app, "const cancellationResultContext", "const bookingHistoryTurnContext", "cancellation result context");
assert.match(cancellationContext, /result\.reason === ["']no_active_booking["'][\s\S]{0,360}Do not ask for a booking reference/, "an empty current-booking cancellation must not ask for a missing reference");
assert.match(cancellationContext, /result\.reason === ["']not_current_booking["'][\s\S]{0,360}Do not ask for confirmation/, "a past booking must be explained without reopening confirmation");
const historyCancelHandler = sliceBetween(app, "const cancelHistoryBooking", "const toggleSeat", "history cancellation handler");
assert.ok(historyCancelHandler.indexOf("existingFlow") < historyCancelHandler.indexOf("selectHistoryBooking(selected)"), "a repeated history cancel click must be ignored before it can invalidate the active lookup");
assert.match(historyCancelHandler, /\["checking", "route_confirmation", "final_confirmation", "processing"\]\.includes\(existingFlow\.phase\)/, "history cancellation must guard every active phase against repeated clicks");
const historyOpenHandler = sliceBetween(app, "const openHistory", "const openOffers", "history open handler");
assert.match(historyOpenHandler, /preserveReturn\s*=\s*false[\s\S]{0,600}if \(!preserveReturn\) historyReturnRef\.current = stageRef\.current/, "returning from a selected booking must preserve the history panel's original parent view");
assert.match(mainRender, /openHistory\(\{[^}]*preserveReturn:\s*true/, "the booking card's back action must reopen history without overwriting its original return target");
const completionHandler = sliceBetween(app, "const completeCancellation", "const handleCancellationDecision", "cancellation completion handler");
assert.match(completionHandler, /!isCurrentBooking\(current\)/, "final cancellation must re-check that the showtime is still current before any mutation");
const cardCancelHandler = sliceBetween(app, "const cancelBooking", "const changeLanguage", "booking-card cancellation handler");
assert.match(cardCancelHandler, /!isCurrentBooking\(current\)/, "the booking-card action must refuse past or cancelled records");
for (const phase of ["checking", "route_confirmation", "final_confirmation", "processing", "error"]) {
  assert.match(app, new RegExp(`phase:\\s*["']${phase}["']`), `App cancellation state must represent the ${phase} phase`);
  assert.match(richMedia, new RegExp(`["']${phase}["']`), `BookingCard must render the ${phase} phase`);
}
assert.doesNotMatch(richMedia, /confirmingCancellation|setConfirmingCancellation/, "BookingCard must not keep a private confirmation state split from text and voice");
assert.match(richMedia, /export function BookingCard\(\{[\s\S]{0,400}\bcancellation\b/, "BookingCard must receive parent-owned cancellation state");
assert.match(richMedia, /const isCurrent = isCurrentBooking\(/, "BookingCard must share the current-showtime predicate used by text and voice routing");
assert.match(richMedia, /\{isCurrent && !cancellationActive \? \(/, "BookingCard must not render a cancellation action for a past showtime");
assert.match(richMedia, /cancellationActive[\s\S]{0,1800}<CancellationPanel\b/, "active cancellation phases must replace the normal card footer with one inline panel");

console.log("Validated live voice-event normalization, text/voice cinema and cancellation routing parity, shared cancellation rendering phases, stale-panel dismissal, and exclusive rich-panel rendering.");
