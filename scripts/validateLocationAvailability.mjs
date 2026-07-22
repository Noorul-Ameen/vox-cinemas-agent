import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveCinemaCandidate } from "../src/lib/cinemaRouting.js";
import { filterDiscoveryResults } from "../src/lib/discoveryPreferences.js";
import { nearbyCinemasForCinema, resolveLocationIntent } from "../src/lib/locationRouting.js";
import { installPublicAssetFetch } from "./lib/installPublicAssetFetch.mjs";
import * as vista from "../src/vistaClient.js";

installPublicAssetFetch();
vista.clearVistaSessionCache();

const cinemas = vista.getCinemas();
assert.equal(resolveCinemaCandidate(cinemas, "Abu Dhabi Marina Mall"), null, "an unsupported venue must not resolve to Abu Dhabi Mall");
assert.equal(resolveCinemaCandidate(cinemas, "Ras Al Khaimah"), null, "Ras Al Khaimah must remain a city-level request");
assert.equal(resolveCinemaCandidate(cinemas, "Al Ain"), null, "Al Ain must remain a city-level request");

for (const request of ["Dubai Marina", "Al Quoz", "Karama", "Jumeirah", "Umm Suqeim", "Al Nahda", "Mussafah", "Khalidiya", "Hatta"]) {
  const result = resolveLocationIntent(cinemas, `Show movies near ${request} tomorrow`);
  assert.equal(result?.kind, "area", `${request} must route as a UAE area, not a movie title`);
  assert.ok(result.cinemas.length > 0, `${request} must return deterministic VOX alternatives`);
  assert.ok(result.cinemas.every((cinema) => cinemas.some((item) => item.id === cinema.id)), `every ${request} alternative must exist in the published catalog`);
}

const unsupportedVenue = resolveLocationIntent(cinemas, "Movies at Abu Dhabi Marina Mall tomorrow");
assert.equal(unsupportedVenue?.kind, "unsupported_venue");
assert.ok(unsupportedVenue.cinemas.length > 0, "a known unsupported venue must offer curated nearby choices");

const competitorVenue = resolveLocationIntent(cinemas, "Movies at Roxy Cinemas Boxpark tomorrow");
assert.equal(competitorVenue?.kind, "unsupported_venue", "a named non-VOX cinema must never be treated as a movie title");
assert.ok(competitorVenue.cinemas.length > 0, "a known Dubai competitor venue must return curated VOX alternatives");

const unknownDubaiVenue = resolveLocationIntent(cinemas, "Movies at Crescent Moon Mall in Dubai tomorrow");
assert.equal(unknownDubaiVenue?.kind, "unknown_venue");
assert.ok(unknownDubaiVenue.cinemas.length > 0, "an unknown Dubai mall must fall back to Dubai cinemas instead of an empty picker");

const outside = resolveLocationIntent(cinemas, "Show movies in Doha tomorrow");
assert.deepEqual({ kind: outside?.kind, cinemas: outside?.cinemas }, { kind: "outside_scope", cinemas: [] }, "outside-UAE requests must not fabricate a nearby UAE cinema");
assert.equal(resolveLocationIntent(cinemas, "Show movies in New York tomorrow")?.kind, "outside_scope", "a common non-UAE city must be rejected explicitly");
assert.equal(resolveLocationIntent(cinemas, "Show movies near Atlantis Resort tomorrow")?.kind, "unknown_location", "an unknown location clause must not become a movie title");
assert.equal(resolveLocationIntent(cinemas, "Show Arabic movies tomorrow"), null, "a movie-language phrase must not be mistaken for a location");
assert.equal(resolveLocationIntent(cinemas, "Show a movie at 8 PM tomorrow"), null, "a requested time must not be mistaken for a location");
for (const nonLocation of [
  "I want a comedy in the evening",
  "Show me movies at night",
  "What is playing around dinner time?",
  "Show family movies in the afternoon",
  "Movies in 3D",
  "Movies in Original",
  "Show movies in English dubbed",
  "Show movies in Arabic language",
  "I want films in Hindi dubbed",
  "Show movies in Dolby Atmos",
  "I want Dolby Cinema",
  "أريد أفلام في دولبي سينما",
  "No educational filter, Urdu in Dolby Cinema",
  "Show me movies in Private Cinema tomorrow",
  "Show me movies in Kids Cinema tomorrow",
  "Show me movies in Theatre Pods in IMAX tomorrow",
  "Movies in MAX",
  "Movies in VOX MAX",
  "I want movies at Noon",
  "Movies around Sunset",
]) {
  assert.equal(resolveLocationIntent(cinemas, nonLocation), null, `${nonLocation} must remain a movie preference, not a location`);
}

assert.equal(vista.normalizeMovieLanguage("TM"), "Tamil", "the source language code TM must normalize to Tamil");
assert.equal(vista.normalizeMovieLanguage("ARA"), "Arabic");

const syntheticAvailability = filterDiscoveryResults({
  movies: [{ id: "fixture-ar", title: "Fixture Arabic", language: "Arabic", languageName: "Arabic", genres: ["Drama"] }],
  sessions: [{ sessionId: "fixture-session", scheduledFilmId: "fixture-ar", movieId: "fixture-ar", cinemaId: "fixture-cinema", date: "2099-01-01", time: "20:00", exp: "THEATRE" }],
  cinemas: [{ id: "fixture-cinema", name: "Fixture Cinema" }],
  preferences: { cinemaId: "fixture-cinema", date: "2099-01-01", language: "Korean" },
});
assert.equal(syntheticAvailability.movies.length, 0);
assert.equal(syntheticAvailability.noResultsReason, "no_language_match", "a known but unavailable language must return an availability result, not an unresolved title");

async function matchingCinemas(candidateCinemas, preferences) {
  const outcomes = await Promise.all(candidateCinemas.map(async (cinema) => {
    const [movies, sessions] = await Promise.all([
      vista.getScheduledFilms(cinema.id, preferences.date),
      vista.getCinemaDateSessions(cinema.id, preferences.date),
    ]);
    const result = filterDiscoveryResults({
      movies,
      sessions,
      cinemas,
      preferences: { ...preferences, cinemaId: cinema.id, cinemaName: cinema.name, city: null },
    });
    return result.movies.length ? { cinema, result } : null;
  }));
  return outcomes.filter(Boolean);
}

const programmingDate = vista.getProgrammingDates()[0];
assert.ok(programmingDate, "the current snapshot must expose at least one active programming date");
const dubai = resolveLocationIntent(cinemas, "Movies in Dubai tomorrow");
assert.equal(dubai?.kind, "city");

const cinemaCatalogs = await Promise.all(dubai.cinemas.map(async (cinema) => ({
  cinema,
  movies: await vista.getScheduledFilms(cinema.id, programmingDate),
})));
const availableLanguage = cinemaCatalogs.flatMap(({ movies }) => movies.map((movie) => movie.languageName || movie.language)).find(Boolean);
assert.ok(availableLanguage, "at least one current Dubai movie language is required for the availability integration check");
const verifiedDubai = await matchingCinemas(dubai.cinemas, { date: programmingDate, language: availableLanguage });
assert.ok(verifiedDubai.length > 0, "the city availability scan must retain cinemas with real matching sessions");
assert.ok(verifiedDubai.every(({ result }) => result.movies.every((movie) => (movie.languageName || movie.language) === availableLanguage)), "every retained city result must match the requested language");

const sourceCinema = cinemas.find((cinema) => nearbyCinemasForCinema(cinemas, cinema.id).length > 0);
assert.ok(sourceCinema, "the catalog must contain at least one curated nearby-cinema relationship");
assert.ok(nearbyCinemasForCinema(cinemas, sourceCinema.id).every((cinema) => cinema.id !== sourceCinema.id), "nearby alternatives must never repeat the selected cinema");

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /noticeByLocale\?\.\[locale\] \|\| stage\.notice/, "location notices must update when the customer explicitly switches the interface language");
assert.match(appSource, /showStage\(\{ view: "cinemas", cinemas: visibleCinemas, notice, noticeByLocale/, "nearby-cinema stages must retain both English and Arabic notice copy");

console.log(`Validated location routing and availability against rolling snapshot date ${programmingDate}.`);
