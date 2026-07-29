import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  extractDiscoveryPreferencePatch,
  unresolvedMovieTitleCandidate,
} from "../src/lib/discoveryPreferences.js";
import {
  isMalformedVisibleShowtimeSelectionAttempt,
  isVisibleShowtimeSelectionAttempt,
  visibleShowtimeSelectionCandidates,
} from "../src/lib/showtimeSelectionRouting.js";
import { isResumeOnlyTurn, pausedResumeTarget } from "../src/lib/pausedJourneyRouting.js";
import { resolveMovieInformationTurn } from "../src/lib/movieInformation.js";
import { resolveLocalOfferTextTurn } from "../src/offers/offerTextFallback.js";

const movies = [
  {
    id: "minions-monsters",
    title: "Minions & Monsters",
    genres: ["Animation", "Comedy"],
    languageName: "English",
    experiences: ["STANDARD"],
  },
];

const showtimeStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "one", time: "15:50", exp: "STANDARD" },
    { sessionId: "two", time: "23:15", exp: "STANDARD" },
  ],
};

const englishOffers = resolveLocalOfferTextTurn("What card offers are available?", { locale: "en" });
assert.ok(englishOffers, "A general English card-offer question must be locally owned.");
assert.equal(englishOffers.bankName, "");
assert.match(englishOffers.answer, /published bank offers/i);

const arabicOffers = resolveLocalOfferTextTurn("ما عروض البطاقات المتاحة؟", { locale: "ar" });
assert.ok(arabicOffers, "A general Arabic card-offer question must be locally owned.");
assert.equal(arabicOffers.bankName, "");
assert.match(arabicOffers.answer, /عروض البنوك/u);
assert.equal(resolveLocalOfferTextTurn("What is the refund policy?", { locale: "en" }), null);

const cinemaChange = extractDiscoveryPreferencePatch("Change cinema", { movies });
assert.ok(cinemaChange.clear.includes("cinemaId"));
assert.ok(cinemaChange.clear.includes("cinemaName"));
assert.equal(cinemaChange.hasDiscoverySignal, true);

const arabicCinemaChange = extractDiscoveryPreferencePatch("غيّر السينما", { movies });
assert.ok(arabicCinemaChange.clear.includes("cinemaId"));
assert.ok(arabicCinemaChange.clear.includes("cinemaName"));

const exactTitle = extractDiscoveryPreferencePatch("Switch to Minions & Monsters", { movies });
assert.equal(exactTitle.patch.movieTitle, "Minions & Monsters");
for (const field of ["genre", "language", "experience", "audience", "viewerAge", "preferredTime", "timeBand"]) {
  assert.ok(exactTitle.clear.includes(field), `An exact title switch must clear stale ${field}.`);
}

for (const request of ["Show me other movies", "أفلاماً أخرى"]) {
  const signal = extractDiscoveryPreferencePatch(request, { movies });
  assert.ok(signal.clear.includes("movieTitle"), `${request} must clear the selected title.`);
  assert.ok(signal.clear.includes("preferredTime"), `${request} must clear the selected time.`);
  assert.equal(unresolvedMovieTitleCandidate(request, signal), null, `${request} must not become a title search.`);
}

for (const request of ["25:99", "٢٥:٩٩"]) {
  assert.equal(isMalformedVisibleShowtimeSelectionAttempt({ text: request, stage: showtimeStage }), true);
  assert.equal(isVisibleShowtimeSelectionAttempt({ text: request, stage: showtimeStage }), true);
  assert.deepEqual(visibleShowtimeSelectionCandidates({ text: request, stage: showtimeStage }), []);
}

assert.equal(pausedResumeTarget("Return to showtimes"), "showtimes");
assert.equal(pausedResumeTarget("العودة إلى مواعيد العرض"), "showtimes");
assert.equal(isResumeOnlyTurn("return"), true);
assert.equal(isResumeOnlyTurn("العودة"), true);

const englishRating = resolveMovieInformationTurn({ query: "What does PG13 mean?", locale: "en" });
assert.equal(englishRating.handled, true);
assert.equal(englishRating.movie, null);
assert.match(englishRating.answer, /PG13 is a VOX age certificate/);
assert.doesNotMatch(englishRating.answer, /movie title/i);

const arabicRating = resolveMovieInformationTurn({ query: "ما معنى تصنيف PG13؟", locale: "ar" });
assert.equal(arabicRating.handled, true);
assert.equal(arabicRating.movie, null);
assert.match(arabicRating.answer, /تصنيف PG13/u);

for (const request of [
  "I'd like to book a movie suitable for a 15-year-old",
  "Suggest a movie for my 15-year-old",
  "Show me a movie suitable for children",
  "Recommend a good movie for teenagers",
  "Book a comedy movie",
  "Show me an Arabic movie",
  "What movie can I watch with my 10-year-old?",
]) {
  const signal = extractDiscoveryPreferencePatch(request, { movies });
  assert.equal(signal.patch.movieTitle, undefined, `${request} must be treated as discovery, not a title.`);
  assert.equal(unresolvedMovieTitleCandidate(request, signal), null, `${request} must not create an unresolved title.`);
}

const unknownSignal = extractDiscoveryPreferencePatch("Show me Galactic Penguins 9", { movies });
assert.equal(unresolvedMovieTitleCandidate("Show me Galactic Penguins 9", unknownSignal), "Galactic Penguins 9");

const deferredTitleWithExperience = extractDiscoveryPreferencePatch("I want Toy Story in IMAX", { movies: [] });
assert.equal(
  unresolvedMovieTitleCandidate("I want Toy Story in IMAX", deferredTitleWithExperience),
  "Toy Story",
  "A title named before the catalog loads must survive experience-filter subtraction.",
);

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /match\?\.id === "movie-age-ratings"/, "The generic age-rating FAQ must be recognized as journey-safe.");
assert.match(appSource, /if \(journeySafeFaq\) return false;/, "A generic age-rating FAQ must keep the current rich journey panel visible.");

console.log("Conversation recovery routing validation passed.");
