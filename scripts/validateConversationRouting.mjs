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
  assert.match(flow, /directCinemaSelection\s*\?\s*\{\s*matches:\s*\[\],\s*context:\s*""\s*\}\s*:\s*prepareFaqContext/, `${label} must not let generic cinema FAQ tags swallow a direct selection`);
  assert.match(flow, /dismissStaleTransactionalView\(/, `${label} turns must dismiss a stale booking/history panel when the turn is unrelated`);
  assert.ok(flow.indexOf("dismissStaleTransactionalView(") < flow.indexOf("prepareFaqContext("), `${label} turns must clear hidden transactional context before an FAQ panel replaces it`);
  assert.match(flow, /cancellationReply:\s*decision\s*!==\s*null/, `${label} cancellation confirmations must keep the active booking panel`);
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

console.log("Validated the live ElevenLabs voice-event fixture, stateful text/voice cinema routing, Mall of the Emirates speech variants, stale booking-panel dismissal, and exclusive rich-panel rendering.");
