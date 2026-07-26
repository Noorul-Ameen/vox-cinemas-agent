import assert from "node:assert/strict";
import { localizeCatalogValue, localizeCinemaName } from "../src/lib/catalogLocalization.js";
import { buildDiscoveryNoResultsMessage } from "../src/lib/discoveryNoResults.js";
import { extractDiscoveryPreferencePatch } from "../src/lib/discoveryPreferences.js";
import { resolveMovieInformationTurn } from "../src/lib/movieInformation.js";
import { resolveRatingMeaning } from "../src/lib/movieRating.js";
import { isResumeCheckoutTurn, isResumeOnlyTurn, pausedResumeTarget } from "../src/lib/pausedJourneyRouting.js";

assert.equal(isResumeCheckoutTurn("العودة إلى مراجعة إتمام الحجز"), true);
assert.equal(pausedResumeTarget("العودة إلى مراجعة إتمام الحجز"), "checkout");
assert.equal(isResumeOnlyTurn("العودة"), true);
assert.equal(pausedResumeTarget("العودة"), "last");
assert.equal(resolveRatingMeaning("العودة إلى مراجعة إتمام الحجز"), null);

const clearPatch = extractDiscoveryPreferencePatch("أزل جميع عوامل التصفية الاختيارية");
for (const key of ["preferredTime", "genre", "language", "experience"]) {
  assert.ok(clearPatch.clear.includes(key), `Arabic filter-clear request must clear ${key}`);
}

assert.equal(localizeCatalogValue("Arabic", "ar"), "العربية");
assert.equal(localizeCatalogValue("Horror", "ar"), "الرعب");
assert.equal(localizeCinemaName("VOX - Mall of the Emirates", "ar"), "VOX - مول الإمارات");

const noResults = buildDiscoveryNoResultsMessage({
  locale: "ar",
  cinemaName: "VOX - Mall of the Emirates",
  date: "2026-07-26",
  preferences: {
    cinemaName: "VOX - Mall of the Emirates",
    date: "2026-07-26",
    language: "Arabic",
    genre: "Horror",
    experience: "IMAX",
    timeRangeStart: "23:00",
    timeRangeEnd: "05:59",
  },
});
assert.match(noResults, /اللغة العربية/u);
assert.match(noResults, /نوع الرعب/u);
assert.match(noResults, /مول الإمارات/u);
assert.doesNotMatch(noResults, /\b(?:Arabic|Horror|Mall of the Emirates)\b/u);

const movie = {
  id: "toy-story-5",
  title: "Toy Story 5",
  rating: "PG",
  runtime: 100,
  genres: ["Animation", "Adventure", "Comedy"],
  language: "English",
  synopsis: "This synopsis should not be appended unless the guest asks for it.",
};
const facts = resolveMovieInformationTurn({
  query: "أخبرني بتصنيف ومدة وأنواع ولغة فيلم Toy Story 5",
  locale: "ar",
  currentMovie: movie,
  visibleMovies: [movie],
  movies: [movie],
  stage: { view: "showtimes", movie },
});
assert.equal(facts.handled, true);
assert.match(facts.answer, /الرسوم المتحركة/u);
assert.match(facts.answer, /المغامرات/u);
assert.match(facts.answer, /الكوميديا/u);
assert.match(facts.answer, /الإنجليزية/u);
assert.doesNotMatch(facts.answer, /This synopsis/u);

console.log("Bilingual text parity validation passed.");
