import assert from "node:assert/strict";
import { isAmbiguousBareBookingTurn } from "../src/lib/bookingIntentRouting.js";
import { explicitLanguageRequest } from "../src/lib/languageSwitch.js";
import { resolveVisibleMovieSelectionTurn } from "../src/lib/movieSelectionRouting.js";
import { resolveVisibleShowtimeSelectionTurn } from "../src/lib/showtimeSelectionRouting.js";
import { extractDiscoveryPreferencePatch } from "../src/lib/discoveryPreferences.js";
import { classifyMovieInformationQuestion } from "../src/lib/movieInformation.js";
import { isResumeCheckoutTurn } from "../src/lib/pausedJourneyRouting.js";
import { buildOfferEvaluationContext } from "../src/offers/offerContext.js";
import { offerTicketCountAcknowledgement, resolveLocalOfferTextTurn } from "../src/offers/offerTextFallback.js";

const movieStage = {
  view: "movies",
  movies: [
    { id: "toy-story-5", title: "Toy Story 5" },
    { id: "other", title: "Other Movie" },
  ],
};

assert.equal(
  (await resolveVisibleMovieSelectionTurn({ text: "I want Toy Story 5", stage: movieStage }))?.id,
  "toy-story-5",
  "an explicit title containing the word Story must be treated as a selection",
);
assert.equal(
  (await resolveVisibleMovieSelectionTurn({ text: "اختر فيلم Toy Story 5", stage: movieStage }))?.id,
  "toy-story-5",
  "an Arabic imperative with a Latin title must advance movie selection",
);

const showtimeStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "standard", time: "17:55", exp: "STANDARD" },
    { sessionId: "premier", time: "17:55", exp: "PREMIER" },
  ],
};
assert.equal(
  resolveVisibleShowtimeSelectionTurn({ text: "Yes, use 5:55 PM PREMIER", stage: showtimeStage })?.sessionId,
  "premier",
  "a visible experience named in a conversational showtime choice must disambiguate the session",
);

const afterSeven = extractDiscoveryPreferencePatch("Show movies after 7 PM");
assert.equal(afterSeven.patch.timeRangeStart, "19:00");
assert.equal(afterSeven.patch.timeRangeEnd, "05:59");
assert.equal(afterSeven.patch.timeRangeStrict, true);

const afterSevenArabic = extractDiscoveryPreferencePatch("\u0627\u0639\u0631\u0636 \u0644\u064a \u0627\u0644\u0623\u0641\u0644\u0627\u0645 \u0627\u0644\u0644\u064a\u0644\u0629 \u0628\u0639\u062f \u0627\u0644\u0633\u0627\u0639\u0629 7 \u0645\u0633\u0627\u0621\u064b");
assert.equal(afterSevenArabic.patch.timeRangeStart, "19:00");
assert.equal(afterSevenArabic.patch.timeRangeEnd, "05:59");
assert.equal(afterSevenArabic.patch.timeRangeStrict, true, "Arabic directional times must not use a nearest-time fallback");

const filterRemoval = extractDiscoveryPreferencePatch("Remove the language, genre, experience and time filters");
for (const key of ["language", "genre", "audience", "experience", "preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand"]) {
  assert.ok(filterRemoval.clear.includes(key), `${key} must be cleared by the multi-filter request`);
}
assert.equal(filterRemoval.patch.openChoice, true, "removing filters must repopulate discovery without asking for another movie preference");
assert.equal(isAmbiguousBareBookingTurn("Book it"), true, "a bare booking phrase must request the missing movie instead of routing to group events");

assert.equal(
  classifyMovieInformationQuestion("What are the rating, language and runtime for this movie?"),
  "details",
  "compound movie information questions must not collapse to the first fact",
);
assert.equal(isResumeCheckoutTurn("Return to checkout review"), true);
assert.equal(explicitLanguageRequest("Switch the conversation and interface to Arabic."), "ar");

const browseOfferContext = buildOfferEvaluationContext({
  view: "movies",
  browse: { cinemaName: "Mall of the Emirates" },
  eligibility: { ticketCount: 2 },
});
assert.equal(browseOfferContext.ticketCount, 2, "pre-seat ticket count must reach offer eligibility");

const localOffer = resolveLocalOfferTextTurn("Show me FAB card offers for two tickets");
assert.equal(localOffer?.ticketCount, 2, "written ticket quantities must remain distinct from monthly usage");
assert.match(offerTicketCountAcknowledgement(localOffer?.ticketCount), /\b2\b/, "the offer answer must acknowledge the supplied ticket count");

console.log("Critical QA regression validation passed.");
