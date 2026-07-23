import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  contextualOpenChoicePreferenceClears,
  createDiscoveryPreferences,
  extractDiscoveryPreferencePatch,
  filterDiscoveryResults,
  formatDiscoveryTimePreference,
  getMissingDiscoveryCriteria,
  hasDiscoveryTimePreference,
  isOpenDiscoveryChoiceReply,
  mergeDiscoveryPreferences,
  parseAndMergeDiscoveryPreferences,
  resolveBilingualDiscoveryMovieCandidate,
  resolveDiscoveryMovieCandidate,
  shouldTreatAsDiscoveryFilterTurn,
  unresolvedMovieTitleCandidate,
} from "../src/lib/discoveryPreferences.js";
import {
  buildAuthoritativeDiscoveryContext,
  buildMovieSelectionGroundingContext,
  isAmbiguousMovieSelectionUtterance,
} from "../src/lib/discoveryResultContext.js";
import { buildDiscoveryNoResultsMessage } from "../src/lib/discoveryNoResults.js";
import { buildVoxiContext } from "../src/lib/voxiSession.js";

const NOW = new Date("2026-07-14T08:00:00Z");
const cinemas = [
  { id: "0002", name: "Mall of the Emirates", city: "Dubai" },
  { id: "0005", name: "City Centre Mirdif", city: "Dubai" },
  { id: "0012", name: "Yas Mall", city: "Abu Dhabi" },
];
const movies = [
  { id: "toy", title: "Toy Story 5", genres: ["Animation", "Adventure", "Family"], languageName: "English", experiences: ["IMAX", "STANDARD"] },
  { id: "laugh", title: "The Big Laugh", genres: ["Comedy"], languageName: "Arabic", experiences: ["STANDARD"] },
  { id: "race", title: "Desert Race", genres: ["Action", "Sports"], languageName: "English", experiences: ["4DX", "STANDARD"] },
];
const minionsMovie = { id: "minions", title: "Minions & Monsters", genres: ["Animation", "Comedy", "Family"], languageName: "English", experiences: ["STANDARD"] };
const sessions = [
  { sessionId: "t1", scheduledFilmId: "toy", cinemaId: "0002", programmingDate: "2026-07-15", time: "17:40", exp: "STANDARD" },
  { sessionId: "t2", scheduledFilmId: "toy", cinemaId: "0002", programmingDate: "2026-07-15", time: "18:00", exp: "IMAX" },
  { sessionId: "t3", scheduledFilmId: "toy", cinemaId: "0012", programmingDate: "2026-07-15", time: "18:10", exp: "STANDARD" },
  { sessionId: "c1", scheduledFilmId: "laugh", cinemaId: "0002", programmingDate: "2026-07-15", time: "18:35", exp: "STANDARD" },
  { sessionId: "c2", scheduledFilmId: "laugh", cinemaId: "0002", programmingDate: "2026-07-15", time: "20:00", exp: "STANDARD" },
  { sessionId: "r1", scheduledFilmId: "race", cinemaId: "0002", programmingDate: "2026-07-15", time: "21:30", exp: "4DX" },
  { sessionId: "r2", scheduledFilmId: "race", cinemaId: "0002", programmingDate: "2026-07-16", time: "18:00", exp: "STANDARD" },
  { sessionId: "r3", scheduledFilmId: "race", cinemaId: "0002", programmingDate: "2026-07-17", time: "19:15", exp: "KIDS" },
];

const reportedFrenchJourneyMovies = [
  { id: "french-film", title: "French Fixture", genres: ["Drama"], languageName: "French", experiences: ["STANDARD"] },
  { id: "english-film", title: "English Fixture", genres: ["Drama"], languageName: "English", experiences: ["STANDARD"] },
];
const reportedFrenchJourneySessions = [
  { sessionId: "fr-23", scheduledFilmId: "french-film", cinemaId: "0002", programmingDate: "2026-07-23", time: "18:00", exp: "STANDARD" },
  { sessionId: "en-23", scheduledFilmId: "english-film", cinemaId: "0002", programmingDate: "2026-07-23", time: "18:30", exp: "STANDARD" },
];

const frenchTurn = parseAndMergeDiscoveryPreferences({}, "French", { cinemas, movies, now: NOW });
assert.equal(frenchTurn.preferences.language, "French", "a bare supported movie language must be retained even when the current catalog has no matching title");
assert.equal(frenchTurn.preferences.movieTitle, null, "French must be treated as a movie-language filter, not an unresolved title");
assert.deepEqual(
  getMissingDiscoveryCriteria(frenchTurn.preferences, ["cinema", "date", "movieOrPreference"]),
  ["cinema", "date"],
  "after French, only cinema and date remain missing",
);

const frenchAtMoeTurn = parseAndMergeDiscoveryPreferences(frenchTurn.preferences, "MOE", { cinemas, movies, now: NOW });
assert.equal(frenchAtMoeTurn.preferences.cinemaId, "0002", "MOE must resolve to Mall of the Emirates");
assert.equal(frenchAtMoeTurn.preferences.cinemaName, "Mall of the Emirates");
assert.equal(frenchAtMoeTurn.preferences.language, "French", "selecting MOE must retain the earlier French-language preference");
assert.deepEqual(
  getMissingDiscoveryCriteria(frenchAtMoeTurn.preferences, ["cinema", "date", "movieOrPreference"]),
  ["date"],
  "after French and MOE, only the date remains missing",
);

// The context-bound bare-day conversion from "23" to this ISO date is
// exercised in validateDiscoveryPromptProgression.mjs. This merge represents
// the authoritative date committed by that route.
const frenchAtMoeOn23 = mergeDiscoveryPreferences(frenchAtMoeTurn.preferences, {
  patch: { date: "2026-07-23", dateSignal: "explicit" },
}).preferences;

const afghanPreferenceTurn = parseAndMergeDiscoveryPreferences({}, "Show me Afghan movies", { cinemas, movies, now: NOW });
assert.equal(afghanPreferenceTurn.update.hasDiscoverySignal, true, "an unsupported Afghan content preference must still be captured as a discovery criterion");
assert.equal(afghanPreferenceTurn.preferences.recommendationIntent, "unsupported_language_afghan", "Afghan must be retained as the exact unsupported-language clarification intent");
assert.equal(afghanPreferenceTurn.preferences.language, null, "Afghan is a nationality clarification and must not be invented as a supported catalog language");
assert.equal(afghanPreferenceTurn.preferences.movieTitle, null, "Afghan must not be treated as a movie title");
assert.equal(unresolvedMovieTitleCandidate("Show me Afghan movies", afghanPreferenceTurn.update), null, "an unsupported Afghan preference must not be queued as a deferred title");
assert.deepEqual(
  getMissingDiscoveryCriteria(afghanPreferenceTurn.preferences, ["cinema", "date", "movieOrPreference"]),
  ["cinema", "date"],
  "an unsupported retained preference must lead to clarification instead of another generic preference question",
);
const afghanAtMoeTurn = parseAndMergeDiscoveryPreferences(afghanPreferenceTurn.preferences, "MOE", { cinemas, movies, now: NOW });
const afghanAtMoeOn23 = mergeDiscoveryPreferences(afghanAtMoeTurn.preferences, {
  patch: { date: "2026-07-23", dateSignal: "explicit" },
}).preferences;
assert.equal(afghanAtMoeOn23.recommendationIntent, "unsupported_language_afghan", "cinema and date replies must not discard the unsupported Afghan preference awaiting clarification");
assert.equal(afghanAtMoeOn23.cinemaId, "0002");
assert.equal(afghanAtMoeOn23.date, "2026-07-23");
for (const supportedLanguage of ["Tamil", "Hindi", "English"]) {
  const clarified = parseAndMergeDiscoveryPreferences(afghanAtMoeOn23, supportedLanguage, { cinemas, movies, now: NOW });
  assert.equal(clarified.preferences.language, supportedLanguage, `${supportedLanguage}: the explicit supported language must replace the Afghan clarification`);
  assert.equal(clarified.preferences.recommendationIntent, null, `${supportedLanguage}: an explicit supported language must clear the Afghan clarification intent`);
  assert.equal(clarified.preferences.cinemaId, "0002", `${supportedLanguage}: resolving the clarification must retain the cinema`);
  assert.equal(clarified.preferences.date, "2026-07-23", `${supportedLanguage}: resolving the clarification must retain the date`);
}

const openChoiceTurn = parseAndMergeDiscoveryPreferences(frenchAtMoeOn23, "anything is fine", { cinemas, movies, now: NOW });
assert.equal(isOpenDiscoveryChoiceReply("anything is fine"), true);
assert.equal(openChoiceTurn.preferences.openChoice, true, "anything is fine must satisfy the open preference prompt deterministically");
assert.equal(openChoiceTurn.preferences.language, "French", "anything is fine must not silently erase the previously supplied French filter");
assert.equal(openChoiceTurn.preferences.cinemaId, "0002", "anything is fine must retain Mall of the Emirates");
assert.equal(openChoiceTurn.preferences.date, "2026-07-23", "anything is fine must retain the selected date");
assert.equal(openChoiceTurn.preferences.movieTitle, null, "anything is fine must never become a movie title");
assert.equal(unresolvedMovieTitleCandidate("anything is fine", openChoiceTurn.update), null, "the open-choice reply must not be queued as an unresolved movie title");
const languageNoResultClears = contextualOpenChoicePreferenceClears({
  input: "anything is fine",
  noResultsReason: "no_language_match",
  preferences: openChoiceTurn.preferences,
});
assert.deepEqual(
  languageNoResultClears,
  ["language"],
  "an open-choice reply to a verified language no-result must clear only the unavailable language",
);
const recoveredOpenChoicePreferences = mergeDiscoveryPreferences(openChoiceTurn.preferences, {
  clear: languageNoResultClears,
  patch: { openChoice: true },
}).preferences;
assert.equal(recoveredOpenChoicePreferences.cinemaId, "0002", "contextual recovery must retain the selected cinema");
assert.equal(recoveredOpenChoicePreferences.date, "2026-07-23", "contextual recovery must retain the selected date");
assert.equal(recoveredOpenChoicePreferences.language, null, "contextual recovery must clear the proven unavailable language");
assert.equal(recoveredOpenChoicePreferences.openChoice, true, "contextual recovery must retain the open choice");
const recoveredOpenChoiceResults = filterDiscoveryResults({
  movies: reportedFrenchJourneyMovies,
  sessions: reportedFrenchJourneySessions,
  cinemas,
  preferences: recoveredOpenChoicePreferences,
});
assert.deepEqual(
  recoveredOpenChoiceResults.movies.map((movie) => movie.id),
  ["french-film", "english-film"],
  "the original French no-result journey must recover by rendering available same-cinema and same-date movies",
);

const allOptionalPreferences = createDiscoveryPreferences({
  movieId: "missing-movie",
  movieTitle: "Missing Movie",
  genre: "Comedy",
  language: "French",
  experience: "IMAX",
  audience: "family",
  preferredTime: "20:00",
  timeRangeStart: "19:00",
  timeRangeEnd: "21:00",
  timeBand: "evening",
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-23",
});
for (const [noResultsReason, expectedClears] of [
  ["no_language_match", ["language"]],
  ["no_genre_match", ["genre"]],
  ["no_experience_match", ["experience"]],
  ["no_audience_match", ["audience"]],
  ["no_suitable_time", ["preferredTime", "timeRangeStart", "timeRangeEnd", "timeBand"]],
  ["movie_unavailable_for_criteria", ["movieId", "movieTitle"]],
]) {
  const clears = contextualOpenChoicePreferenceClears({ input: "anything is fine", noResultsReason, preferences: allOptionalPreferences });
  assert.deepEqual(clears, expectedClears, `${noResultsReason}: contextual recovery must clear only optional incompatible criteria`);
  assert.equal(clears.includes("cinemaId"), false, `${noResultsReason}: contextual recovery must not clear cinema`);
  assert.equal(clears.includes("date"), false, `${noResultsReason}: contextual recovery must not clear date`);
}
assert.deepEqual(
  contextualOpenChoicePreferenceClears({
    input: "\u0623\u064a \u0634\u064a\u0621 \u0645\u0646\u0627\u0633\u0628",
    noResultsReason: "no_language_match",
    preferences: openChoiceTurn.preferences,
  }),
  ["language"],
  "the equivalent Arabic open-choice reply must recover from the same verified language no-result",
);
assert.deepEqual(
  contextualOpenChoicePreferenceClears({
    input: "anything is fine",
    noResultsReason: "no_results_for_criteria",
    preferences: openChoiceTurn.preferences,
  }),
  [],
  "an ambiguous combined zero-result must ask what to change instead of silently broadening the list",
);
assert.deepEqual(
  contextualOpenChoicePreferenceClears({
    input: "anything is fine",
    noResultsReason: null,
    preferences: openChoiceTurn.preferences,
  }),
  [],
  "the same open-choice reply must keep retained filters without empty-result context",
);
assert.deepEqual(
  contextualOpenChoicePreferenceClears({
    input: "maybe later",
    noResultsReason: "no_language_match",
    preferences: openChoiceTurn.preferences,
  }),
  [],
  "an unrelated reply must not clear a retained filter",
);
for (const openChoiceReply of ["any option works", "show me what is available", "I'm flexible"]) {
  assert.equal(isOpenDiscoveryChoiceReply(openChoiceReply), true, `${openChoiceReply}: a clear flexible-choice reply must be recognized`);
}
assert.deepEqual(
  getMissingDiscoveryCriteria(openChoiceTurn.preferences, ["cinema", "date", "movieOrPreference"]),
  [],
  "French, MOE, 23, and an open choice must complete discovery requirements without another repeated question",
);

const combinedOpenChoiceTurn = parseAndMergeDiscoveryPreferences(createDiscoveryPreferences(), "anything is fine at MOE on 23", {
  cinemas,
  movies,
  now: NOW,
});
assert.equal(isOpenDiscoveryChoiceReply("anything is fine at MOE on 23"), true, "an open choice must be recognized when cinema and date share the turn");
assert.equal(isOpenDiscoveryChoiceReply("\u0623\u064a \u0634\u064a\u0621 \u0645\u0646\u0627\u0633\u0628 \u0641\u064a \u0645\u0648\u0644 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a \u064a\u0648\u0645 23"), true, "an Arabic open choice must be recognized when cinema and date share the turn");
for (const combinedReply of [
  "Any movie at Mall of the Emirates on 23",
  "Surprise me at Mall of the Emirates on 23",
  "You choose at Mall of the Emirates on 23",
  "Show me anything available at Mall of the Emirates on 23",
]) assert.equal(isOpenDiscoveryChoiceReply(combinedReply), true, `${combinedReply}: a combined open choice must not trigger another preference question`);
assert.equal(combinedOpenChoiceTurn.preferences.openChoice, true, "the combined turn must satisfy the preference requirement");
assert.equal(combinedOpenChoiceTurn.preferences.cinemaId, "0002", "the combined turn must retain its cinema");
assert.equal(combinedOpenChoiceTurn.preferences.movieTitle, null, "the combined open choice must not become a deferred title");

const retainedFrenchResults = filterDiscoveryResults({
  movies: reportedFrenchJourneyMovies,
  sessions: reportedFrenchJourneySessions,
  cinemas,
  preferences: openChoiceTurn.preferences,
});
assert.deepEqual(retainedFrenchResults.movies.map((movie) => movie.id), ["french-film"], "the completed journey must still filter results by French");
assert.deepEqual(retainedFrenchResults.sessions.map((session) => session.sessionId), ["fr-23"]);

const broadenedLanguageTurn = parseAndMergeDiscoveryPreferences(openChoiceTurn.preferences, "any language", { cinemas, movies, now: NOW });
assert.equal(broadenedLanguageTurn.preferences.language, null, "only an explicit any-language reply may clear the retained French filter");
assert.equal(broadenedLanguageTurn.preferences.openChoice, true, "broadening language must retain the guest's open movie choice");
assert.equal(broadenedLanguageTurn.preferences.cinemaId, "0002");
assert.equal(broadenedLanguageTurn.preferences.date, "2026-07-23");
const broadenedLanguageResults = filterDiscoveryResults({
  movies: reportedFrenchJourneyMovies,
  sessions: reportedFrenchJourneySessions,
  cinemas,
  preferences: broadenedLanguageTurn.preferences,
});
assert.deepEqual(broadenedLanguageResults.movies.map((movie) => movie.id), ["french-film", "english-film"], "explicitly clearing language must broaden the same cinema and date results");

for (const reply of [
  "Anything is fine",
  "Anything works",
  "Anything will do",
  "I'm okay with anything",
  "Whatever works",
  "Whatever you recommend",
  "No particular preference",
  "I don't mind",
  "You choose",
  "Your choice",
  "Surprise me",
  "Show me anything available",
  "Any suitable movie is fine",
  "أي شيء مناسب",
  "ما عندي تفضيل",
  "اختار أنت",
  "على ذوقك",
  "فاجئني",
]) {
  const signal = extractDiscoveryPreferencePatch(reply, { cinemas, movies, now: NOW });
  assert.equal(isOpenDiscoveryChoiceReply(reply), true, `${reply}: must be recognized as an open discovery choice`);
  assert.equal(signal.patch.openChoice, true, `${reply}: must satisfy a preference prompt without inventing a criterion`);
  assert.equal(signal.patch.movieTitle, undefined, `${reply}: must not become a movie title`);
  assert.equal(unresolvedMovieTitleCandidate(reply, signal), null, `${reply}: must not be retained as an unresolved title`);
}

for (const [request, expectedLanguage] of [
  ["French movies", "French"],
  ["movies in Urdu", "Urdu"],
  ["Japanese-language films", "Japanese"],
  ["show me Mandarin movies", "Chinese"],
]) {
  const signal = extractDiscoveryPreferencePatch(request, { cinemas, movies, now: NOW });
  assert.equal(signal.patch.language, expectedLanguage, `${request}: an unavailable but recognized language must remain a filter`);
  assert.equal(unresolvedMovieTitleCandidate(request, signal), null, `${request}: a language request must not become a deferred title`);
}

const titleFacetMovies = [
  { id: "french-exit", title: "French Exit", genres: ["Drama"], languageName: "English", experiences: ["STANDARD"] },
  { id: "family-plan", title: "The Family Plan", genres: ["Action"], languageName: "English", experiences: ["STANDARD"] },
];
const frenchTitleOnly = extractDiscoveryPreferencePatch("Book French Exit", { cinemas, movies: titleFacetMovies, now: NOW });
assert.equal(frenchTitleOnly.patch.movieId, "french-exit");
assert.equal(frenchTitleOnly.patch.language, undefined, "a language word inside an exact movie title must not become an extra filter");
const frenchTitleWithLanguage = extractDiscoveryPreferencePatch("Book French Exit in French", { cinemas, movies: titleFacetMovies, now: NOW });
assert.equal(frenchTitleWithLanguage.patch.movieId, "french-exit");
assert.equal(frenchTitleWithLanguage.patch.language, "French", "an explicit language outside the exact title must still be retained");
const familyTitleOnly = extractDiscoveryPreferencePatch("Book The Family Plan", { cinemas, movies: titleFacetMovies, now: NOW });
assert.equal(familyTitleOnly.patch.movieId, "family-plan");
assert.equal(familyTitleOnly.patch.audience, undefined, "an audience word inside an exact title must not become an extra filter");

const cinemaTitleCollision = extractDiscoveryPreferencePatch(
  "Show family movies at City Centre Mirdif on 24 July",
  {
    cinemas,
    movies: [
      { id: "motor-city", title: "Motor City", genres: ["Drama"], languageName: "English", experiences: ["STANDARD"] },
      ...movies,
    ],
    now: NOW,
  },
);
assert.equal(cinemaTitleCollision.patch.cinemaId, "0005", "City Centre Mirdif must remain the grounded cinema");
assert.equal(cinemaTitleCollision.patch.date, "2026-07-24", "the combined date must remain grounded");
assert.equal(cinemaTitleCollision.patch.audience, "kids_family", "the family requirement must remain grounded");
assert.equal(cinemaTitleCollision.patch.movieId, undefined, "a cinema phrase must not partially match the unrelated Motor City movie");
assert.equal(cinemaTitleCollision.patch.movieTitle, undefined, "a cinema phrase must not create an unrelated movie-title filter");

const realMotorCityAtMirdif = extractDiscoveryPreferencePatch(
  "Show Motor City at City Centre Mirdif on 24 July",
  {
    cinemas,
    movies: [{ id: "motor-city", title: "Motor City", genres: ["Drama"], languageName: "English", experiences: ["STANDARD"] }],
    now: NOW,
  },
);
assert.equal(realMotorCityAtMirdif.patch.cinemaId, "0005", "the cinema must remain grounded when a real movie is also supplied");
assert.equal(realMotorCityAtMirdif.patch.movieId, "motor-city", "an explicitly named movie outside the cinema phrase must still resolve");

const educationalFamily = parseAndMergeDiscoveryPreferences({}, "I want educational family movies", { cinemas, movies, now: NOW });
assert.equal(educationalFamily.preferences.audience, "kids_family", "a family requirement must survive an educational clarification");
assert.equal(educationalFamily.preferences.recommendationIntent, "educational", "educational must be retained as a clarification intent, not invented as a published genre");
assert.equal(educationalFamily.preferences.genre, null, "educational must not silently become Documentary");
assert.equal(unresolvedMovieTitleCandidate("I want educational family movies", educationalFamily.update), null, "educational wording must never become a movie title");
const documentaryClarification = parseAndMergeDiscoveryPreferences(educationalFamily.preferences, "Documentary", { cinemas, movies, now: NOW });
assert.equal(documentaryClarification.preferences.genre, "Documentary");
assert.equal(documentaryClarification.preferences.recommendationIntent, null, "an explicit Documentary answer must resolve the educational clarification");
assert.equal(documentaryClarification.preferences.audience, null, "a later genre-only answer follows the established genre-versus-audience replacement rule");
const relaxedEducational = parseAndMergeDiscoveryPreferences(educationalFamily.preferences, "anything is fine", { cinemas, movies, now: NOW });
assert.equal(relaxedEducational.preferences.recommendationIntent, null, "an open answer must remove only the unresolved educational clarification");
assert.equal(relaxedEducational.preferences.audience, "kids_family", "an open answer must keep the already supplied family requirement");

for (const [request, expected] of [
  ["I want Dolby Cinema", "DOLBY CINEMA"],
  ["Show me ScreenX movies", "SCREENX"],
  ["Anything in D-BOX", "D-BOX"],
  ["Show Film Noir movies", "Film Noir"],
]) {
  const signal = extractDiscoveryPreferencePatch(request, { cinemas, movies, now: NOW });
  const actual = expected === "Film Noir" ? signal.patch.genre : signal.patch.experience;
  assert.equal(actual, expected, `${request}: an explicit unavailable criterion must be retained for honest zero-result handling`);
  assert.equal(unresolvedMovieTitleCandidate(request, signal), null, `${request}: an explicit criterion must not become a deferred movie title`);
}

const combinedDolbyCinemaAlias = extractDiscoveryPreferencePatch("Dolby Cinema at MOE", { cinemas, movies: [], now: NOW });
assert.equal(combinedDolbyCinemaAlias.patch.experience, "DOLBY CINEMA", "a combined Dolby request must retain the experience");
assert.equal(combinedDolbyCinemaAlias.patch.cinemaId, "0002", "MOE must resolve to Mall of the Emirates in a combined criterion request");
assert.equal(unresolvedMovieTitleCandidate("Dolby Cinema at MOE", combinedDolbyCinemaAlias), null, "a resolved cinema alias must not also be retained as a deferred movie title");

const arabicDolbyCinema = extractDiscoveryPreferencePatch("أريد أفلام في دولبي سينما", { cinemas, movies: [], now: NOW });
assert.equal(arabicDolbyCinema.patch.experience, "DOLBY CINEMA", "an Arabic Dolby Cinema criterion must resolve as an experience");
assert.equal(unresolvedMovieTitleCandidate("أريد أفلام في دولبي سينما", arabicDolbyCinema), null, "an Arabic experience criterion must not become a deferred movie title");

const switchArabicFrenchMovies = extractDiscoveryPreferencePatch("Switch to Arabic and show me French movies at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW });
assert.equal(switchArabicFrenchMovies.patch.language, "French", "the requested movie language must remain French when the interface switches to Arabic");
assert.equal(switchArabicFrenchMovies.patch.cinemaId, "0002");
assert.equal(switchArabicFrenchMovies.patch.date, "2026-07-15");
const switchEnglishArabicMovies = extractDiscoveryPreferencePatch("Switch to English and show me Arabic movies at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW });
assert.equal(switchEnglishArabicMovies.patch.language, "Arabic", "the requested movie language must remain Arabic when the interface switches to English");

const unavailableFrenchResults = filterDiscoveryResults({
  movies,
  sessions,
  cinemas,
  preferences: { cinemaId: "0002", cinemaName: "Mall of the Emirates", date: "2026-07-15", language: "French" },
});
assert.equal(unavailableFrenchResults.movies.length, 0);
assert.equal(unavailableFrenchResults.noResultsReason, "no_language_match");
const unavailableFrenchMessage = buildDiscoveryNoResultsMessage({
  preferences: unavailableFrenchResults.preferences,
  cinemaName: "Mall of the Emirates",
  date: "2026-07-15",
  noResultsReason: unavailableFrenchResults.noResultsReason,
  locale: "en",
});
assert.match(unavailableFrenchMessage, /^No French-language movies are available at Mall of the Emirates on 15 July 2026\./);
assert.match(unavailableFrenchMessage, /change the date, cinema, or movie language/i);
assert.doesNotMatch(unavailableFrenchMessage, /[\u2013\u2014]/u, "the grounded empty-state response must use standard punctuation only");

const unavailableRangeMessage = buildDiscoveryNoResultsMessage({
  preferences: { cinemaName: "Mall of the Emirates", date: "2026-07-15", timeRangeStart: "18:00", timeRangeEnd: "20:00" },
  cinemaName: "Mall of the Emirates",
  date: "2026-07-15",
  noResultsReason: "no_suitable_time",
  locale: "en",
});
assert.match(unavailableRangeMessage, /between 18:00 and 20:00/, "a zero-result message must explain the full requested time range");
const rangeSessionContext = buildVoxiContext({
  locale: "en",
  cinema: null,
  scheduleDate: "2026-07-15",
  stage: { view: "discovery" },
  selectedSeats: [],
  discoveryPreferences: { cinemaName: "Mall of the Emirates", date: "2026-07-15", timeRangeStart: "18:00", timeRangeEnd: "20:00" },
  journey: {},
  messages: [],
});
assert.match(rangeSessionContext, /preferred time 18:00 to 20:00/, "the ElevenLabs journey context must not report a retained time range as missing");

for (const reply of ["yes", "no", "maybe later", "thank you", "...", "🤷"]) {
  const signal = extractDiscoveryPreferencePatch(reply, { cinemas, movies, now: NOW });
  const merged = mergeDiscoveryPreferences(frenchAtMoeOn23, signal);
  assert.equal(signal.hasDiscoverySignal, false, `${reply}: conversational noise must not invent a discovery filter`);
  assert.deepEqual(merged.preferences, frenchAtMoeOn23, `${reply}: conversational noise must leave retained discovery state unchanged`);
}

const combined = extractDiscoveryPreferencePatch(
  "I want Toy Story 5 at Mall of the Emirates tomorrow at 6:00 PM in IMAX",
  { cinemas, movies, now: NOW },
);
assert.deepEqual(combined.patch, {
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-15",
  dateSignal: "tomorrow",
  preferredTime: "18:00",
  movieId: "toy",
  movieTitle: "Toy Story 5",
  experience: "IMAX",
});
assert.deepEqual(
  getMissingDiscoveryCriteria(createDiscoveryPreferences(combined.patch), ["cinema", "date", "time", "movie"]),
  [],
  "criteria already present in a guest turn must never be requested again",
);

const textResult = parseAndMergeDiscoveryPreferences({}, "Show me kids' movies tomorrow", { cinemas, movies, now: NOW });
const voiceResult = parseAndMergeDiscoveryPreferences({}, "Show me kids' movies tomorrow", { cinemas, movies, now: NOW });
assert.deepEqual(textResult.preferences, voiceResult.preferences, "text and voice transcripts must share deterministic preference parsing");
assert.equal(textResult.preferences.audience, "kids_family");
assert.equal(textResult.preferences.date, "2026-07-15");
const kidsAudienceOnly = parseAndMergeDiscoveryPreferences({}, "Show me kids and family movies", { cinemas, movies, knownExperiences: ["KIDS", "IMAX"], now: NOW });
assert.equal(kidsAudienceOnly.preferences.audience, "kids_family", "kids and family movie wording must be treated as an audience preference");
assert.equal(kidsAudienceOnly.preferences.experience, null, "kids and family movie wording must not silently require the KIDS cinema experience");
const explicitKidsExperience = parseAndMergeDiscoveryPreferences({}, "Show me movies in the KIDS experience", { cinemas, movies, knownExperiences: ["KIDS", "IMAX"], now: NOW });
assert.equal(explicitKidsExperience.preferences.experience, "KIDS", "an explicit KIDS experience request must still filter by the KIDS cinema experience");

const arabicDiscoveryQuery = "ما هي الأفلام العربية في مول الإمارات غداً؟";
const arabicDiscoverySignal = extractDiscoveryPreferencePatch(arabicDiscoveryQuery, { cinemas, movies, now: NOW });
assert.deepEqual(arabicDiscoverySignal.patch, {
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-15",
  dateSignal: "tomorrow",
  language: "Arabic",
}, "an Arabic discovery question must retain its supplied cinema, date, and language");
assert.equal(
  unresolvedMovieTitleCandidate(arabicDiscoveryQuery, arabicDiscoverySignal),
  null,
  "an Arabic discovery question must not become an unresolved movie title",
);
const arabicDiscoveryPreferences = parseAndMergeDiscoveryPreferences({}, arabicDiscoveryQuery, { cinemas, movies, now: NOW }).preferences;
assert.equal(arabicDiscoveryPreferences.movieId, null);
assert.equal(arabicDiscoveryPreferences.movieTitle, null);
const arabicDiscoveryResults = filterDiscoveryResults({ movies, sessions, cinemas, preferences: arabicDiscoveryPreferences });
assert.deepEqual(arabicDiscoveryResults.movies.map((movie) => movie.id), ["laugh"], "Arabic discovery must return only Arabic-language movies");
assert.ok(arabicDiscoveryResults.sessions.every((session) => session.scheduledFilmId === "laugh" && session.cinemaId === "0002" && session.programmingDate === "2026-07-15"));

const arabicComedyFirstTurn = "أريد أفلام كوميدية في مول الإمارات غداً";
const arabicComedyFirstTurnResult = parseAndMergeDiscoveryPreferences({}, arabicComedyFirstTurn, { cinemas, movies, now: NOW });
assert.deepEqual(
  {
    cinemaId: arabicComedyFirstTurnResult.preferences.cinemaId,
    cinemaName: arabicComedyFirstTurnResult.preferences.cinemaName,
    date: arabicComedyFirstTurnResult.preferences.date,
    genre: arabicComedyFirstTurnResult.preferences.genre,
    language: arabicComedyFirstTurnResult.preferences.language,
  },
  {
    cinemaId: "0002",
    cinemaName: "Mall of the Emirates",
    date: "2026-07-15",
    genre: "Comedy",
    language: null,
  },
  "a first-turn Arabic feminine genre request must retain its cinema, date, and Comedy filter without becoming an Arabic-language filter",
);
assert.deepEqual(
  getMissingDiscoveryCriteria(arabicComedyFirstTurnResult.preferences, ["cinema", "date", "movieOrPreference"]),
  [],
  "a complete first-turn Arabic genre request must not trigger a redundant preference question",
);
assert.equal(
  shouldTreatAsDiscoveryFilterTurn(arabicComedyFirstTurn, { view: "empty", signal: arabicComedyFirstTurnResult.update }),
  true,
  "a complete first-turn Arabic genre request must route directly to discovery results",
);
const arabicComedyFirstTurnResults = filterDiscoveryResults({
  movies,
  sessions,
  cinemas,
  preferences: arabicComedyFirstTurnResult.preferences,
});
assert.deepEqual(
  arabicComedyFirstTurnResults.movies.map((movie) => movie.id),
  ["laugh"],
  "a complete first-turn Arabic Comedy request must render a non-empty Comedy-only movie result",
);
assert.ok(
  arabicComedyFirstTurnResults.movies.every((movie) => movie.genres.includes("Comedy")),
  "every movie rendered for the Arabic Comedy request must satisfy the retained genre",
);
assert.ok(
  arabicComedyFirstTurnResults.sessions.every((session) => (
    session.scheduledFilmId === "laugh"
    && session.cinemaId === "0002"
    && session.programmingDate === "2026-07-15"
  )),
  "Arabic Comedy sessions must retain the supplied cinema and date",
);

for (const [request, expectedGenre] of [
  ["الأفلام الكوميدية", "Comedy"],
  ["أفلام الأكشن", "Action"],
  ["أفلام الاكشن", "Action"],
  ["أفلام رومانسية", "Romance"],
  ["أفلام وثائقية", "Documentary"],
  ["أفلام درامية", "Drama"],
  ["أفلام موسيقية", "Musical"],
  ["أفلام رياضية", "Sports"],
  ["أفلام كرتونية", "Animation"],
  ["أفلام حربية", "War"],
  ["أفلام الخيال العلمي", "Science Fiction"],
]) {
  const signal = extractDiscoveryPreferencePatch(request, { movies, now: NOW });
  assert.equal(signal.patch.genre, expectedGenre, `${request}: common Arabic genre morphology must resolve to ${expectedGenre}`);
  assert.equal(signal.patch.language, undefined, `${request}: an Arabic-script genre term must not imply Arabic movie language`);
}

const arabicLanguageComedy = extractDiscoveryPreferencePatch("أريد أفلام كوميدية عربية", { movies, now: NOW });
assert.equal(arabicLanguageComedy.patch.genre, "Comedy", "Arabic Comedy wording must retain the Comedy genre");
assert.equal(arabicLanguageComedy.patch.language, "Arabic", "an explicit عربية adjective must remain an Arabic movie-language filter");
const arabicFamily = extractDiscoveryPreferencePatch("أريد أفلام عائلية", { movies, now: NOW });
assert.equal(arabicFamily.patch.audience, "kids_family", "the common Arabic feminine family adjective must remain an audience preference");
assert.equal(arabicFamily.patch.genre, undefined, "an Arabic family audience request must not require the literal Family catalog genre");

for (const datePhrase of ["I want to go on 17th", "I'm looking to go on, um, 17th", "17th", "I want to go on July 17th", "I want to go on 2026-07-17"]) {
  const parsedDate = extractDiscoveryPreferencePatch(datePhrase, { now: NOW });
  assert.equal(parsedDate.patch.date, "2026-07-17", `the spoken date must be retained for: ${datePhrase}`);
  assert.equal(parsedDate.patch.dateSignal, "explicit");
}
for (const nonDateOrdinal of [
  "Show me the 2nd movie",
  "I want the 1st row",
  "Select the 3rd seat",
  "Show me the movie on the 2nd screen",
  "We want seats on the 3rd row",
  "Choose the show on the 2nd option",
]) {
  assert.equal(extractDiscoveryPreferencePatch(nonDateOrdinal, { now: NOW }).patch.date, undefined, `an ordinal choice must not become a date: ${nonDateOrdinal}`);
}
assert.equal(extractDiscoveryPreferencePatch("July 32nd", { now: NOW }).patch.date, undefined, "an impossible month date must be rejected");
assert.equal(extractDiscoveryPreferencePatch("31st February", { now: NOW }).patch.date, undefined, "an impossible calendar date must be rejected");
assert.equal(extractDiscoveryPreferencePatch("2026-02-31", { now: NOW }).patch.date, undefined, "an impossible ISO date must be rejected");
assert.equal(extractDiscoveryPreferencePatch("31/02/2026", { now: NOW }).patch.date, undefined, "an impossible numeric date must be rejected");
assert.equal(extractDiscoveryPreferencePatch("2028-02-29", { now: NOW }).patch.date, "2028-02-29", "a valid leap-day ISO date must be retained");
assert.equal(extractDiscoveryPreferencePatch("29/02/2028", { now: NOW }).patch.date, "2028-02-29", "a valid leap-day numeric date must be retained");
assert.equal(extractDiscoveryPreferencePatch("January 2nd", { now: new Date("2026-12-15T08:00:00Z") }).patch.date, "2027-01-02", "a month-name request after that month has passed must roll into the next year");
for (const datePhrase of ["24 يوليو", "يوم 24 يوليو", "يوم ٢٤ يوليو", "بتاريخ ۲۴ يوليو", "يوليو 24"]) {
  const parsedDate = extractDiscoveryPreferencePatch(datePhrase, { now: NOW });
  assert.equal(parsedDate.patch.date, "2026-07-24", `${datePhrase}: an Arabic month date must resolve to the requested calendar date`);
  assert.equal(parsedDate.patch.dateSignal, "explicit");
}
assert.equal(extractDiscoveryPreferencePatch("٢٤/٠٧/٢٠٢٦", { now: NOW }).patch.date, "2026-07-24", "Arabic-Indic numeric dates must use the same validated date path");
assert.equal(extractDiscoveryPreferencePatch("٢٠٢٦-٠٧-٢٤", { now: NOW }).patch.date, "2026-07-24", "Arabic-Indic ISO dates must use the same validated date path");
assert.equal(extractDiscoveryPreferencePatch("31 فبراير", { now: NOW }).patch.date, undefined, "an impossible Arabic month date must be rejected");
assert.equal(extractDiscoveryPreferencePatch("٣١ فبراير", { now: NOW }).patch.date, undefined, "an impossible Arabic-Indic month date must be rejected");
assert.equal(extractDiscoveryPreferencePatch("٢٠٢٦-٠٢-٣١", { now: NOW }).patch.date, undefined, "an impossible Arabic-Indic ISO date must be rejected");
assert.equal(
  extractDiscoveryPreferencePatch("٢٤ يوليو", { now: new Date("2026-07-25T08:00:00Z") }).patch.date,
  "2027-07-24",
  "an Arabic month date that has passed must roll into the next year",
);
for (const weekdayPhrase of ["الجمعة", "يوم الجمعة"]) {
  const parsedDate = extractDiscoveryPreferencePatch(weekdayPhrase, { now: NOW });
  assert.equal(parsedDate.patch.date, "2026-07-17", `${weekdayPhrase}: an Arabic weekday must resolve to its next available occurrence`);
  assert.equal(parsedDate.patch.dateSignal, "friday");
}
assert.equal(
  extractDiscoveryPreferencePatch("الجمعة", { now: new Date("2026-07-17T08:00:00Z") }).patch.date,
  "2026-07-17",
  "a bare Arabic weekday may select today when today has that weekday",
);
for (const weekdayPhrase of ["الجمعة القادمة", "الجمعة الجاية", "يوم الجمعة القادم"]) {
  assert.equal(
    extractDiscoveryPreferencePatch(weekdayPhrase, { now: new Date("2026-07-17T08:00:00Z") }).patch.date,
    "2026-07-24",
    `${weekdayPhrase}: an explicitly upcoming Arabic weekday must advance when today has the same weekday`,
  );
}

assert.equal(unresolvedMovieTitleCandidate("I want to watch a comedy", extractDiscoveryPreferencePatch("I want to watch a comedy", { movies, now: NOW })), null, "a genre request must not be retained as an unknown title");
assert.equal(unresolvedMovieTitleCandidate("I want to watch a movie tomorrow", extractDiscoveryPreferencePatch("I want to watch a movie tomorrow", { movies, now: NOW })), null, "a broad movie request must not become an unknown title");
const spokenAmpersandTitle = extractDiscoveryPreferencePatch("Book Minions and Monsters tomorrow", { movies: [minionsMovie], now: NOW });
assert.equal(spokenAmpersandTitle.patch.movieId, "minions", "spoken and must match an ampersand in the authoritative title");
assert.equal(spokenAmpersandTitle.patch.movieTitle, "Minions & Monsters");
assert.equal(spokenAmpersandTitle.patch.date, "2026-07-15", "the movie title must not consume the supplied tomorrow date signal");
assert.equal(spokenAmpersandTitle.patch.dateSignal, "tomorrow");
const partialMinionsTitle = extractDiscoveryPreferencePatch("Minions tomorrow", { movies: [minionsMovie], now: NOW });
assert.equal(partialMinionsTitle.patch.movieId, "minions", "an unambiguous distinctive partial title must resolve from a short natural turn");
assert.equal(partialMinionsTitle.patch.dateSignal, "tomorrow", "a partial title and date must be extracted in the same turn");
assert.equal(resolveDiscoveryMovieCandidate([minionsMovie], "Minions and Monsters"), minionsMovie, "and and ampersand title forms must resolve equivalently after catalog load");
assert.equal(resolveDiscoveryMovieCandidate([minionsMovie], "Minions"), minionsMovie, "an unambiguous partial catalog title must resolve");
const duplicatedMinionsCatalog = [minionsMovie, { ...minionsMovie }, { ...minionsMovie }];
assert.equal(extractDiscoveryPreferencePatch("Minions", { movies: duplicatedMinionsCatalog, now: NOW }).patch.movieId, "minions", "duplicate schedule rows for one movie must not make its partial title ambiguous");
assert.equal(resolveDiscoveryMovieCandidate(duplicatedMinionsCatalog, "Minions"), minionsMovie, "duplicate catalog rows with one movie identity must collapse before ambiguity checks");
assert.equal(resolveDiscoveryMovieCandidate([minionsMovie, { id: "minions-2", title: "Minions Return" }], "Minions"), null, "a shared partial title must request clarification instead of guessing");
const englishMovieChangeSignal = extractDiscoveryPreferencePatch("I want to go for English movie", { movies: [minionsMovie], now: NOW });
assert.equal(englishMovieChangeSignal.patch.language, "English", "natural go-for phrasing must be retained as a language filter");
assert.equal(englishMovieChangeSignal.patch.movieTitle, undefined, "English movie must not invent a title");
assert.equal(unresolvedMovieTitleCandidate("I want to go for English movie", englishMovieChangeSignal), null, "the filler phrase to go must not be retained as a deferred movie title");
assert.equal(unresolvedMovieTitleCandidate("I want Toy Storey 5 at Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("I want Toy Storey 5 at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), "Toy Storey 5", "live mode must retain a likely title until its cinema/date catalog loads");
assert.equal(unresolvedMovieTitleCandidate("I need Toy Storey 5 at Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("I need Toy Storey 5 at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), "Toy Storey 5", "I-need phrasing must retain a plausible title without confusing ticket-count requests");
assert.equal(unresolvedMovieTitleCandidate("Toy Storey 5 at Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("Toy Storey 5 at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), "Toy Storey 5", "a bare residual title must survive cinema/date removal in live mode");
assert.equal(unresolvedMovieTitleCandidate("I need three tickets at Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("I need three tickets at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), null, "ticket targets must never be mistaken for a movie title");
assert.equal(unresolvedMovieTitleCandidate("Show me movies tomorrow", extractDiscoveryPreferencePatch("Show me movies tomorrow", { cinemas, movies: [], now: NOW })), null, "plural generic movie requests must remain broad discovery requests");
assert.equal(unresolvedMovieTitleCandidate("I want films at Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("I want films at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), null, "generic film requests must ask for a preference instead of showing an unknown-title error");
const genericPlayingQuery = "What is playing at Mall of the Emirates tomorrow at 6 PM?";
const genericPlayingSignal = extractDiscoveryPreferencePatch(genericPlayingQuery, { cinemas, movies: [], now: NOW });
assert.deepEqual(genericPlayingSignal.patch, {
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-15",
  dateSignal: "tomorrow",
  preferredTime: "18:00",
}, "a generic playing question must retain its supplied cinema, date, and time");
assert.equal(unresolvedMovieTitleCandidate(genericPlayingQuery, genericPlayingSignal), null, "`What is playing` must remain generic discovery instead of becoming an unknown movie title");
const genericPlayingPreferences = mergeDiscoveryPreferences({}, genericPlayingSignal).preferences;
assert.equal(genericPlayingPreferences.movieTitle, null, "generic discovery must not set movieTitle");
const genericPlayingResults = filterDiscoveryResults({ movies, sessions, cinemas, preferences: genericPlayingPreferences });
assert.equal(genericPlayingResults.time.exactTimeMatch, true, "the supplied 6 PM must drive showtime filtering");
assert.ok(genericPlayingResults.sessions.some((session) => session.sessionId === "t2"), "the exact 6 PM Mall of the Emirates session must be returned");
assert.ok(genericPlayingResults.sessions.every((session) => session.cinemaId === "0002" && session.programmingDate === "2026-07-15"), "all nearby options must retain the supplied cinema and date");
assert.ok(genericPlayingResults.sessions.every((session) => !["c2", "r1", "r2"].includes(session.sessionId)), "distant, wrong-date, and unrelated-time sessions must stay filtered out");
const authoritativeContext = buildAuthoritativeDiscoveryContext({
  cinema: { name: "Mall of the Emirates" },
  selectedDate: "2026-07-15",
  movies: genericPlayingResults.movies.map((movie) => ({
    title: movie.title,
    showtimes: genericPlayingResults.sessions
      .filter((session) => session.scheduledFilmId === movie.id)
      .map((session) => ({ time: session.time, experience: session.exp })),
  })),
});
assert.match(authoritativeContext, /Mall of the Emirates on 2026-07-15/);
assert.match(authoritativeContext, /Toy Story 5: 18:00 IMAX/);
assert.match(authoritativeContext, /Recommend or describe only these supplied movie titles and showtimes by name/);
assert.doesNotMatch(authoritativeContext, /Secret Life of Pets|Rise of Gru/, "agent context must not introduce titles absent from the filtered result");
assert.match(authoritativeContext, /none is selected unless a separate confirmed-selection update/, "displaying cards must not be mistaken for selecting a movie");

const emptyAuthoritativeContext = buildAuthoritativeDiscoveryContext({
  cinema: { name: "Mall of the Emirates" },
  selectedDate: "2026-07-17",
  preferences: { genre: "Action", audience: "kids_family" },
  movies: [],
});
assert.match(emptyAuthoritativeContext, /ZERO matching movie cards/i);
assert.match(emptyAuthoritativeContext, /Retained filters: Action, kids\/family/i);
assert.match(emptyAuthoritativeContext, /Do not say that options, choices, or a movie list are on screen/i);
assert.match(emptyAuthoritativeContext, /do not call show_showtimes/i);
const missingPreferenceContext = buildAuthoritativeDiscoveryContext({
  shown: "discovery question",
  missing: ["preference"],
  movies: [],
});
assert.match(missingPreferenceContext, /required information is missing \(preference\)/i);
assert.match(missingPreferenceContext, /Ask only for preference/i);
assert.equal(isAmbiguousMovieSelectionUtterance("The chosen movies."), true);
assert.equal(isAmbiguousMovieSelectionUtterance("those options"), true);
assert.equal(isAmbiguousMovieSelectionUtterance("this one"), true);
assert.equal(isAmbiguousMovieSelectionUtterance("that one"), true);
assert.equal(isAmbiguousMovieSelectionUtterance("Toy Story 5"), false, "an exact title must remain eligible for normal fuzzy-title resolution");
const emptySelectionGrounding = buildMovieSelectionGroundingContext({
  text: "The chosen movies.",
  stage: { view: "movies", movies: [], error: "No movies match all of your preferences." },
});
assert.match(emptySelectionGrounding, /zero movie cards are visible/i);
assert.match(emptySelectionGrounding, /do not say 'great choice'/i);
assert.match(emptySelectionGrounding, /do not ask for a showtime/i);
const visibleSelectionGrounding = buildMovieSelectionGroundingContext({
  text: "the shown movies",
  stage: { view: "movies", movies: [{ title: "Toy Story 5" }, { title: "Desert Race" }] },
});
assert.match(visibleSelectionGrounding, /Toy Story 5, Desert Race/);
assert.match(visibleSelectionGrounding, /no movie is selected/i);
assert.match(buildMovieSelectionGroundingContext({
  text: "the chosen movies",
  stage: { view: "loading" },
}), /results are still loading/i);
assert.match(buildMovieSelectionGroundingContext({
  text: "the chosen movies",
  stage: { view: "discovery", question: "What kind of movie would you like?" },
}), /more information is required/i);
assert.equal(buildMovieSelectionGroundingContext({
  text: "the shown movies",
  stage: { view: "showtimes", movie: { title: "Toy Story 5" } },
}), "", "a confirmed movie stage must not be overwritten by the ambiguity guard");
assert.equal(unresolvedMovieTitleCandidate("I want Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("I want Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), null, "a cinema/date-only turn must ask for a preference, not treat the cinema as a title");
assert.equal(unresolvedMovieTitleCandidate("I want Dubai tomorrow", extractDiscoveryPreferencePatch("I want Dubai tomorrow", { cinemas, movies: [], now: NOW })), null, "a city/date-only turn must not become a title");
assert.equal(unresolvedMovieTitleCandidate("I want Toy Story around 6 PM at Mall of the Emirates tomorrow", extractDiscoveryPreferencePatch("I want Toy Story around 6 PM at Mall of the Emirates tomorrow", { cinemas, movies: [], now: NOW })), "Toy Story", "a combined title and preferred-time turn must retain the title");
assert.equal(unresolvedMovieTitleCandidate("I want Toy Story in IMAX", extractDiscoveryPreferencePatch("I want Toy Story in IMAX", { cinemas, movies: [], now: NOW })), "Toy Story", "a combined title and experience turn must retain the title");
assert.equal(unresolvedMovieTitleCandidate("Watch Toy Storey 5 around 8 PM", extractDiscoveryPreferencePatch("Watch Toy Storey 5 around 8 PM", { cinemas, movies: [], now: NOW })), "Toy Storey 5", "an ASR-like title must survive time-criterion subtraction");
assert.equal(unresolvedMovieTitleCandidate("أريد فيلماً في مول الإمارات غداً الساعة 6 مساءً", extractDiscoveryPreferencePatch("أريد فيلماً في مول الإمارات غداً الساعة 6 مساءً", { cinemas, movies: [], now: NOW })), null, "a broad Arabic cinema/date/time request must not become an unknown title");
assert.equal(unresolvedMovieTitleCandidate("أريد فيلم توي ستوري 5 في مول الإمارات غداً", extractDiscoveryPreferencePatch("أريد فيلم توي ستوري 5 في مول الإمارات غداً", { cinemas, movies: [], now: NOW })), "توي ستوري 5", "an Arabic named-title phrase must survive the location boundary for deferred matching");
assert.equal(resolveDiscoveryMovieCandidate(movies, "Toy Story"), movies[0], "partial titles must reuse the protected fuzzy resolver after catalog load");
assert.equal(resolveDiscoveryMovieCandidate(movies, "Toy Storey 5"), movies[0], "ASR-like title variants must resolve when the best candidate is unambiguous");
assert.equal(resolveDiscoveryMovieCandidate([{ id: "a", title: "Toy Story 5" }, { id: "b", title: "Toy Story Classics" }], "Toy Story"), null, "ambiguous partial titles must request clarification");
assert.equal(await resolveBilingualDiscoveryMovieCandidate(movies, "توي ستوري 5"), movies[0], "an Arabic transliteration must resolve the matching English catalog title");
assert.equal((await resolveBilingualDiscoveryMovieCandidate([{ id: "moana", title: "Moana" }], "موانا"))?.id, "moana", "a one-word Arabic transliteration must resolve only when the whole title shape matches");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "moana", title: "Moana" }], "موان"), null, "a truncated Arabic title must not resolve");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "moana", title: "Moana" }], "موانا 2"), null, "a sequel number mismatch must not resolve the original title");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "a", title: "Toy Story 5" }, { id: "b", title: "Toy Story Classics" }], "توي ستوري"), null, "a cross-script partial title shared by two films must remain ambiguous");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "moana", title: "Moana" }], "افاتار"), null, "an unknown Arabic title must not fall back to the only catalog movie");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "moana", title: "Moana" }], "مين"), null, "a short phonetic collision must not resolve Moana");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "dune", title: "Dune" }], "دين"), null, "a short phonetic collision must not resolve Dune");
assert.equal(await resolveBilingualDiscoveryMovieCandidate([{ id: "lenin", title: "Lenin" }], "لين"), null, "a truncated phonetic collision must not resolve Lenin");
assert.equal((await resolveBilingualDiscoveryMovieCandidate([{ id: "alpha", title: "Alpha" }], "الفا"))?.id, "alpha", "a common ph transliteration must resolve Alpha");
assert.equal((await resolveBilingualDiscoveryMovieCandidate([{ id: "spider", title: "Spider-Man: Brand New Day" }], "سبايدر مان"))?.id, "spider", "a distinctive cross-script partial title must resolve a unique longer title");
for (const [title, alias] of [
  ["Sakr w Canaria", "صقر و كناريا"],
  ["The Odyssey", "الأوديسة"],
  ["El Gawahergy", "الجواهرجي"],
  ["Khali Balak Min Nafsik", "خلي بالك من نفسك"],
  ["Shamshoun w Dalila", "شمشون و دليلة"],
]) {
  assert.equal(
    (await resolveBilingualDiscoveryMovieCandidate([{ id: "current", title }], alias))?.id,
    "current",
    `${alias}: a curated current-title alias must resolve the official English catalog title`,
  );
}

const imaxSignal = extractDiscoveryPreferencePatch("IMAX", { movies, now: NOW });
assert.equal(shouldTreatAsDiscoveryFilterTurn("IMAX", { view: "movies", signal: imaxSignal }), true, "a bare criterion in active discovery must update results");
assert.equal(shouldTreatAsDiscoveryFilterTurn("I want IMAX", { view: "seatmap", signal: extractDiscoveryPreferencePatch("I want IMAX", { movies, now: NOW }) }), true, "an explicit experience change must update an active booking journey");
assert.equal(shouldTreatAsDiscoveryFilterTurn("Is IMAX wheelchair accessible?", { view: "seatmap", signal: extractDiscoveryPreferencePatch("Is IMAX wheelchair accessible?", { movies, now: NOW }) }), false, "an accessibility FAQ must not clear seat state merely because it names an experience");
assert.equal(shouldTreatAsDiscoveryFilterTurn("Does Mall of the Emirates cinema have parking?", { view: "movies", signal: extractDiscoveryPreferencePatch("Does Mall of the Emirates cinema have parking?", { cinemas, movies, now: NOW }) }), false, "a cinema policy FAQ must not mutate retained discovery criteria");
assert.equal(shouldTreatAsDiscoveryFilterTurn("Does Mall of the Emirates have parking?", { view: "showtimes", signal: extractDiscoveryPreferencePatch("Does Mall of the Emirates have parking?", { cinemas, movies, now: NOW }) }), false, "a named cinema inside a parking question must not replace verified showtimes");
assert.equal(shouldTreatAsDiscoveryFilterTurn("What Arabic movies are showing tonight?", { view: "empty", signal: extractDiscoveryPreferencePatch("What Arabic movies are showing tonight?", { movies, now: NOW }) }), true, "a question-shaped discovery request must still route when it asks what is showing");
assert.equal(shouldTreatAsDiscoveryFilterTurn("What is playing at Mall of the Emirates tomorrow at 6 PM?", { view: "showtimes", signal: extractDiscoveryPreferencePatch("What is playing at Mall of the Emirates tomorrow at 6 PM?", { cinemas, movies, now: NOW }) }), true, "a genuine question-shaped cinema, date, and time discovery request must still update results");

const arabicComedy = extractDiscoveryPreferencePatch("I want an Arabic comedy around 8 PM", { movies, now: NOW });
assert.equal(arabicComedy.patch.genre, "Comedy");
assert.equal(arabicComedy.patch.language, "Arabic");
assert.equal(arabicComedy.patch.preferredTime, "20:00");
assert.equal(
  extractDiscoveryPreferencePatch("around 8 p.m.", { now: NOW }).patch.preferredTime,
  "20:00",
  "punctuated speech-to-text meridiems must normalize consistently",
);
assert.equal(extractDiscoveryPreferencePatch("18:30", { now: NOW }).patch.preferredTime, "18:30");
assert.equal(extractDiscoveryPreferencePatch("8", { now: NOW, expectingTime: true }).patch.preferredTime, "08:00");

for (const [request, start, end] of [
  ["around 8 to 10 at night", "20:00", "22:00"],
  ["from 8 pm to 10 pm", "20:00", "22:00"],
  ["between eight and ten at night", "20:00", "22:00"],
  ["11 pm to 1 am", "23:00", "01:00"],
]) {
  const range = extractDiscoveryPreferencePatch(request, { now: NOW });
  assert.equal(range.patch.timeRangeStart, start, `${request}: the range start must be retained`);
  assert.equal(range.patch.timeRangeEnd, end, `${request}: the range end must be retained`);
  assert.equal(range.patch.preferredTime, undefined, `${request}: a range must not collapse to a midpoint`);
}
const retainedRangePreference = { timeRangeStart: "18:00", timeRangeEnd: "20:00" };
assert.equal(hasDiscoveryTimePreference(retainedRangePreference), true, "a complete time range must satisfy the narrowing-time requirement");
assert.equal(formatDiscoveryTimePreference(retainedRangePreference), "18:00 to 20:00", "English context must retain both range boundaries");
assert.equal(formatDiscoveryTimePreference(retainedRangePreference, { locale: "ar" }), "18:00 إلى 20:00", "Arabic UI context must retain both range boundaries");
assert.equal(hasDiscoveryTimePreference({ timeRangeStart: "18:00" }), false, "an incomplete range must not be treated as a usable time criterion");
assert.equal(extractDiscoveryPreferencePatch("الساعة ١٠ مساء", { now: NOW }).patch.preferredTime, "22:00");
assert.equal(extractDiscoveryPreferencePatch("الساعة عشرة مساء", { now: NOW }).patch.preferredTime, "22:00");
assert.equal(extractDiscoveryPreferencePatch("الساعة واحدة ليلا", { now: NOW }).patch.preferredTime, "01:00");
assert.equal(extractDiscoveryPreferencePatch("twelve at night", { now: NOW }).patch.preferredTime, "00:00");

const exact = filterDiscoveryResults({
  movies,
  sessions,
  cinemas,
  preferences: combined.patch,
});
assert.deepEqual(exact.movies.map((movie) => movie.id), ["toy"]);
assert.deepEqual(exact.sessions.map((session) => session.sessionId), ["t2"]);
assert.equal(exact.time.exactTimeMatch, true);
assert.equal(exact.time.usedNearestFallback, false);
assert.equal(exact.time.matchKind, "exact");

const nearest = filterDiscoveryResults({
  movies,
  sessions,
  cinemas,
  preferences: {
    cinemaId: "0002",
    date: "2026-07-15",
    genre: "Comedy",
    language: "Arabic",
    preferredTime: "18:00",
  },
});
assert.deepEqual(nearest.movies.map((movie) => movie.id), ["laugh"]);
assert.deepEqual(nearest.sessions.map((session) => session.sessionId), ["c1"]);
assert.equal(nearest.time.exactTimeMatch, false);
assert.equal(nearest.time.usedNearestFallback, true);
assert.equal(nearest.time.closestDeltaMinutes, 35);
assert.deepEqual(nearest.time.closestTimes, ["18:35"]);

const rangeSessions = ["19:30", "20:00", "21:00", "22:00", "22:30"].map((time, index) => ({
  sessionId: `range-${index}`,
  scheduledFilmId: "toy",
  cinemaId: "0002",
  date: "2026-07-15",
  time,
}));
const ranged = filterDiscoveryResults({
  movies,
  sessions: rangeSessions,
  cinemas,
  preferences: { cinemaId: "0002", date: "2026-07-15", movieId: "toy", timeRangeStart: "20:00", timeRangeEnd: "22:00" },
});
assert.deepEqual(ranged.sessions.map((session) => session.time), ["20:00", "21:00", "22:00"], "a time range must include every visible session within its endpoints");
assert.equal(ranged.time.matchKind, "range");
assert.equal(ranged.time.rangeSessionCount, 3);
assert.equal(ranged.time.usedNearestFallback, false);

const rangeNearest = filterDiscoveryResults({
  movies,
  sessions: rangeSessions,
  cinemas,
  preferences: { cinemaId: "0002", date: "2026-07-15", movieId: "toy", timeRangeStart: "18:00", timeRangeEnd: "19:00" },
});
assert.deepEqual(rangeNearest.sessions.map((session) => session.time), ["19:30", "20:00"], "an empty time range must return the closest options ranked from the nearest boundary");
assert.equal(rangeNearest.time.usedNearestFallback, true);
assert.equal(rangeNearest.time.closestDeltaMinutes, 30);

const overnightSessions = ["22:30", "23:00", "00:30", "01:00", "01:30"].map((time, index) => ({
  sessionId: `overnight-${index}`,
  scheduledFilmId: "toy",
  cinemaId: "0002",
  date: "2026-07-15",
  time,
}));
const overnightRange = filterDiscoveryResults({
  movies,
  sessions: overnightSessions,
  cinemas,
  preferences: { cinemaId: "0002", date: "2026-07-15", movieId: "toy", timeRangeStart: "23:00", timeRangeEnd: "01:00" },
});
assert.deepEqual(overnightRange.sessions.map((session) => session.time), ["23:00", "00:30", "01:00"], "a spoken range crossing midnight must follow the cinema programming day");

const kidsOnly = filterDiscoveryResults({ movies, sessions, cinemas, preferences: { audience: "kids_family", date: "2026-07-15" } });
assert.deepEqual(kidsOnly.movies.map((movie) => movie.id), ["toy"], "kids/family discovery must exclude unrelated adult catalog entries");
assert.ok(kidsOnly.sessions.every((session) => session.scheduledFilmId === "toy"));

const experienceOnly = filterDiscoveryResults({ movies, sessions, cinemas, preferences: { cinemaId: "0002", date: "2026-07-15", experience: "4DX" } });
assert.deepEqual(experienceOnly.movies.map((movie) => movie.id), ["race"]);
assert.deepEqual(experienceOnly.sessions.map((session) => session.sessionId), ["r1"]);

const specificOnly = filterDiscoveryResults({ movies, sessions, cinemas, preferences: { movieTitle: "Toy Story 5", cinemaId: "0002", date: "2026-07-15" } });
assert.deepEqual(specificOnly.movies.map((movie) => movie.id), ["toy"]);
assert.ok(specificOnly.sessions.every((session) => session.scheduledFilmId === "toy"));

const cityOnly = filterDiscoveryResults({ movies, sessions, cinemas, preferences: { city: "Abu Dhabi", date: "2026-07-15" } });
assert.deepEqual(cityOnly.sessions.map((session) => session.sessionId), ["t3"]);

const initial = createDiscoveryPreferences({ cinemaId: "0002", cinemaName: "Mall of the Emirates", date: "2026-07-15", genre: "Comedy", experience: "STANDARD" });
const changedGenre = parseAndMergeDiscoveryPreferences(initial, "Actually, make that action", { movies, now: NOW });
assert.equal(changedGenre.preferences.genre, "Action");
assert.equal(changedGenre.preferences.cinemaId, "0002", "unmentioned criteria must persist");
assert.equal(changedGenre.preferences.date, "2026-07-15");
assert.equal(changedGenre.invalidates.movieResults, true);
assert.equal(changedGenre.invalidates.seatSelection, true);

const changedExperience = parseAndMergeDiscoveryPreferences(changedGenre.preferences, "IMAX instead", { movies, now: NOW });
assert.equal(changedExperience.preferences.experience, "IMAX");
assert.equal(changedExperience.preferences.genre, "Action");
assert.equal(changedExperience.invalidates.pricing, true);
for (const request of ["Show me IMAX instead", "Show me IMAX only", "اعرض آيماكس بدلاً", "اعرض آيماكس فقط"]) {
  const signal = extractDiscoveryPreferencePatch(request, { cinemas, movies, now: NOW });
  assert.equal(signal.patch.experience, "IMAX", `${request}: the replacement experience must be retained`);
  assert.equal(unresolvedMovieTitleCandidate(request, signal), null, `${request}: a replacement modifier must not become an unresolved movie title`);
}

const replacementSeed = createDiscoveryPreferences({
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-15",
  dateSignal: "tomorrow",
  preferredTime: "20:00",
  genre: "Drama",
  language: "Tamil",
  experience: "IMAX",
  movieId: "old-title",
  movieTitle: "Old Title",
  audience: "kids_family",
  openChoice: true,
  recommendationIntent: "educational",
});
const explicitContentReplacement = parseAndMergeDiscoveryPreferences(
  replacementSeed,
  "I changed my mind. I want to go for an English movie",
  { movies: [minionsMovie], now: NOW },
);
assert.equal(explicitContentReplacement.update.replacementIntent, "content", "changed my mind must expose a safe explicit content-replacement signal");
assert.equal(explicitContentReplacement.preferences.language, "English", "the new explicit language must win over the cleared stale language");
for (const key of ["genre", "experience", "movieId", "movieTitle", "audience", "openChoice", "recommendationIntent"]) {
  assert.equal(explicitContentReplacement.preferences[key], null, `${key} must be cleared by an explicit content replacement`);
}
assert.equal(explicitContentReplacement.preferences.cinemaId, "0002", "a content replacement must retain the established cinema");
assert.equal(explicitContentReplacement.preferences.date, "2026-07-15", "a content replacement must retain the established date");
assert.equal(explicitContentReplacement.preferences.preferredTime, "20:00", "a content replacement must retain the established time unless the guest changes it");
assert.equal(extractDiscoveryPreferencePatch("I've changed my mind", { movies, now: NOW }).replacementIntent, "content", "apostrophized voice or text phrasing must expose the same replacement signal after normalization");

const mallJuly17 = createDiscoveryPreferences({
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-17",
});
const familyEducational = parseAndMergeDiscoveryPreferences(mallJuly17, "For family and education", { movies, now: NOW });
assert.equal(familyEducational.preferences.audience, "kids_family", "the initial family request must be retained as an audience filter");
const actionAfterFamily = parseAndMergeDiscoveryPreferences(familyEducational.preferences, "Can you suggest my, uh, action movies?", { movies, now: NOW });
assert.equal(actionAfterFamily.preferences.genre, "Action");
assert.equal(actionAfterFamily.preferences.audience, null, "a later genre-only request must replace the stale family audience filter");
assert.equal(actionAfterFamily.preferences.cinemaId, "0002", "the content-preference change must retain the selected cinema");
assert.equal(actionAfterFamily.preferences.date, "2026-07-17", "the content-preference change must retain the selected date");
const actionAfterFamilyResults = filterDiscoveryResults({ movies, sessions, cinemas, preferences: actionAfterFamily.preferences });
assert.deepEqual(actionAfterFamilyResults.movies.map((movie) => movie.id), ["race"], "the Mall of the Emirates July 17 transition must show action results instead of an empty family/action intersection");
assert.deepEqual(actionAfterFamilyResults.sessions.map((session) => session.sessionId), ["r3"]);

const familyAfterAction = parseAndMergeDiscoveryPreferences(actionAfterFamily.preferences, "Show me family movies", { movies, now: NOW });
assert.equal(familyAfterAction.preferences.audience, "kids_family");
assert.equal(familyAfterAction.preferences.genre, null, "a later family-only request must replace the stale genre filter");
const explicitFamilyAction = parseAndMergeDiscoveryPreferences(mallJuly17, "Show me family action movies", { movies, now: NOW });
assert.equal(explicitFamilyAction.preferences.genre, "Action");
assert.equal(explicitFamilyAction.preferences.audience, "kids_family", "criteria explicitly combined in one turn must remain combined");
const explicitFamilyActionResults = filterDiscoveryResults({ movies, sessions, cinemas, preferences: explicitFamilyAction.preferences });
assert.deepEqual(explicitFamilyActionResults.movies.map((movie) => movie.id), ["race"], "a verified KIDS session must satisfy an explicit family/action request");
assert.deepEqual(explicitFamilyActionResults.sessions.map((session) => session.sessionId), ["r3"]);
const emptyFamilyComedy = filterDiscoveryResults({
  movies,
  sessions,
  cinemas,
  preferences: { cinemaId: "0002", date: "2026-07-17", genre: "Comedy", audience: "kids_family" },
});
assert.equal(emptyFamilyComedy.noResultsReason, "no_results_for_criteria", "an empty criteria intersection must expose its deterministic reason");
const emptyMorningBand = filterDiscoveryResults({
  movies,
  sessions,
  cinemas,
  preferences: { cinemaId: "0002", date: "2026-07-17", timeBand: "morning" },
});
assert.equal(emptyMorningBand.sessions.length, 0, "the unavailable morning band fixture must return no sessions");
assert.equal(emptyMorningBand.noResultsReason, "no_suitable_time", "a time-band-only miss must be classified as a time miss");
assert.equal(emptyMorningBand.counts.sessionsBeforeTimeFilter, 1, "time-band classification must preserve the number of sessions before time filtering");

const changedBookingContext = mergeDiscoveryPreferences(
  { cinemaId: "0002", date: "2026-07-15", preferredTime: "18:00" },
  { patch: { cinemaId: "0012", date: "2026-07-16", preferredTime: "20:00" } },
);
assert.equal(changedBookingContext.invalidates.sessionSelection, true);
assert.equal(changedBookingContext.invalidates.seatSelection, true);
assert.equal(changedBookingContext.invalidates.pricing, true, "cinema/date/time changes must invalidate seats and related pricing");

const tonight = extractDiscoveryPreferencePatch("What Arabic movies are showing tonight?", { movies, now: NOW });
assert.equal(tonight.patch.language, "Arabic");
assert.equal(tonight.patch.date, "2026-07-14");
assert.equal(tonight.patch.timeBand, "evening");

const clearedTime = parseAndMergeDiscoveryPreferences({ ...changedExperience.preferences, preferredTime: "18:00" }, "Any time is fine", { now: NOW });
assert.equal(clearedTime.preferences.preferredTime, null);
assert.equal(clearedTime.preferences.experience, "IMAX");
assert.deepEqual(clearedTime.clearedKeys, ["preferredTime"]);

const clearedLanguage = parseAndMergeDiscoveryPreferences({ ...changedExperience.preferences, language: "French" }, "Any language is fine", { now: NOW });
assert.equal(clearedLanguage.preferences.language, null, "an explicit any-language reply must remove the retained movie-language filter");
assert.equal(clearedLanguage.preferences.experience, "IMAX", "clearing movie language must retain unrelated criteria");
assert.equal(clearedLanguage.preferences.movieTitle, null, "an explicit any-language reply must not become a movie title");

const replacementMovieSeed = {
  cinemaId: "0002",
  cinemaName: "Mall of the Emirates",
  city: "Dubai",
  date: "2026-07-23",
  movieId: "toy",
  movieTitle: "Toy Story 5",
  genre: "Animation",
  language: "English",
  experience: "IMAX",
};
for (const [request, retainedTime] of [
  ["Show me new movies", { preferredTime: "09:30" }],
  ["Show me different movies", { timeBand: "evening" }],
]) {
  const replacement = parseAndMergeDiscoveryPreferences({ ...replacementMovieSeed, ...retainedTime }, request, { cinemas, movies, now: NOW });
  assert.equal(replacement.preferences.movieId, null, `${request}: the previous movie id must be cleared`);
  assert.equal(replacement.preferences.movieTitle, null, `${request}: the previous movie title must be cleared`);
  assert.equal(replacement.preferences.preferredTime, null, `${request}: the previous exact time must be cleared`);
  assert.equal(replacement.preferences.timeBand, null, `${request}: the previous time band must be cleared`);
  assert.deepEqual(
    {
      cinemaId: replacement.preferences.cinemaId,
      cinemaName: replacement.preferences.cinemaName,
      city: replacement.preferences.city,
      date: replacement.preferences.date,
      genre: replacement.preferences.genre,
      language: replacement.preferences.language,
      experience: replacement.preferences.experience,
    },
    {
      cinemaId: replacementMovieSeed.cinemaId,
      cinemaName: replacementMovieSeed.cinemaName,
      city: replacementMovieSeed.city,
      date: replacementMovieSeed.date,
      genre: replacementMovieSeed.genre,
      language: replacementMovieSeed.language,
      experience: replacementMovieSeed.experience,
    },
    `${request}: cinema, date, and unrelated filters must survive the replacement request`,
  );
  assert.equal(replacement.invalidates.sessionSelection, true, `${request}: the old session must be invalidated`);
  assert.equal(replacement.invalidates.seatSelection, true, `${request}: old seats must be invalidated`);
  assert.equal(replacement.invalidates.pricing, true, `${request}: old pricing must be invalidated`);
}

const suppliedWins = mergeDiscoveryPreferences(
  { genre: "Comedy", language: "Arabic" },
  { clear: ["genre", "language"], patch: { genre: "Action" } },
);
assert.equal(suppliedWins.preferences.genre, "Action", "a value explicitly supplied in the same turn must win over a clear signal");
assert.equal(suppliedWins.preferences.language, null);

const rawShape = filterDiscoveryResults({
  movies: [{ code: "raw", title: "Raw Film", genres: ["Comedy"], languages: ["English"] }],
  sessions: [{ sessionId: "raw-session", code: "raw", cinemaCode: "0002", programmingDate: "2026-07-15", showtime: "2026-07-15T18:25:00+04:00", experience: "STANDARD" }],
  cinemas,
  preferences: { cinemaId: "0002", date: "2026-07-15", genre: "Comedy", preferredTime: "18:00" },
});
assert.deepEqual(rawShape.movies.map((movie) => movie.code), ["raw"]);
assert.equal(rawShape.time.usedNearestFallback, true);
assert.equal(rawShape.time.closestDeltaMinutes, 25);

const discoveryPreferencesSource = await readFile(new URL("../src/lib/discoveryPreferences.js", import.meta.url), "utf8");
assert.doesNotMatch(discoveryPreferencesSource, /^import .*crossScriptMovieTitles/m, "cross-script title data must not enter the initial discovery bundle through a static import");
assert.match(discoveryPreferencesSource, /await import\("\.\/crossScriptMovieTitles\.js"\)/, "the bilingual fallback must load cross-script title data on demand");

console.log("Validated persistent discovery preferences, combined filtering, and nearest-showtime fallback.");
