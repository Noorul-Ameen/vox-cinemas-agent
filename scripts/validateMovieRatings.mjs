import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAuthoritativeDiscoveryContext } from "../src/lib/discoveryResultContext.js";
import { filterDiscoveryResults, shouldTreatAsDiscoveryFilterTurn } from "../src/lib/discoveryPreferences.js";
import {
  buildAuthoritativeMovieRatingContext,
  buildMovieRatingAnswer,
  evaluateMovieAdmission,
  extractViewerAge,
  isMovieRatingQuestion,
  normalizeMovieRating,
  ratingPolicyForCode,
  resolveMovieForInformationQuestion,
  resolveRatingMeaning,
} from "../src/lib/movieRating.js";
import { VOXI_AGENT_PROMPT } from "../src/lib/voxiSession.js";

const FORBIDDEN_DASH = /[\u2013\u2014]/u;

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const discoveryContextSource = readFileSync(new URL("../src/lib/discoveryResultContext.js", import.meta.url), "utf8");
const discoveryPreferencesSource = readFileSync(new URL("../src/lib/discoveryPreferences.js", import.meta.url), "utf8");

const ezma = Object.freeze({
  id: "ezma",
  title: "Ezma",
  rating: "PG15",
  genres: ["Drama", "Romance"],
  language: "Arabic",
});
const moana = Object.freeze({
  id: "moana",
  title: "Moana",
  rating: "PG",
  genres: ["Animation", "Family"],
  language: "English",
});
const odyssey = Object.freeze({
  id: "odyssey",
  title: "The Odyssey",
  rating: "15+",
  genres: ["Adventure"],
  language: "English",
});
const minions = Object.freeze({
  id: "minions",
  title: "Minions & Monsters",
  rating: "PG",
  genres: ["Animation", "Comedy", "Family"],
  language: "English",
});
const wake = Object.freeze({ id: "wake", title: "Wake", rating: "18TC", language: "English", genres: ["Horror"] });

function assertNoForbiddenDash(value, message) {
  assert.doesNotMatch(String(value ?? ""), FORBIDDEN_DASH, message);
}

function ratingFacts(context) {
  const prefix = "AUTHORITATIVE MOVIE RATING FACTS: ";
  const firstLine = String(context || "").split("\n", 1)[0];
  assert.ok(firstLine.startsWith(prefix), "rating context must begin with structured authoritative facts");
  return JSON.parse(firstLine.slice(prefix.length));
}

// Canonical certificates must survive casing, punctuation, object fields,
// spoken spacing, common voice number words, and Arabic voice forms.
const normalizationCases = [
  ["G", "G"],
  ["g", "G"],
  ["PG", "PG"],
  ["p g", "PG"],
  ["PG13", "PG13"],
  ["PG-13", "PG13"],
  ["PG 13", "PG13"],
  ["P G 13", "PG13"],
  ["P G thirteen", "PG13"],
  ["PG15", "PG15"],
  ["PG-15", "PG15"],
  ["P G fifteen", "PG15"],
  ["15+", "15+"],
  ["+15", "15+"],
  ["15 plus", "15+"],
  ["fifteen plus", "15+"],
  ["18+", "18+"],
  ["18 plus", "18+"],
  ["eighteen plus", "18+"],
  ["21+", "21+"],
  ["twenty one plus", "21+"],
  ["18TC", "18TC"],
  ["18 TC", "18TC"],
  ["eighteen T C", "18TC"],
  [{ Rating: "PG15" }, "PG15"],
  ["\u0628\u064a \u062c\u064a 13", "PG13"],
  ["\u0628\u064a \u062c\u064a 15", "PG15"],
  ["\u0641\u0648\u0642 18", "18+"],
];
for (const [input, expected] of normalizationCases) {
  assert.equal(normalizeMovieRating(input), expected, `${JSON.stringify(input)} must normalize to ${expected}`);
}
for (const input of [null, "", "TBC", "Not rated", "R", "PG12", "18"]) {
  assert.equal(normalizeMovieRating(input), null, `${JSON.stringify(input)} must remain an unknown UAE certificate`);
}

// Viewer ages must be extracted from natural text without misreading the
// digits inside PG13, PG15, 15+, 18+, 21+, or 18TC as the guest's age.
const ageCases = [
  ["Can my 10-year-old watch Ezma?", 10],
  ["My child is 10. Can we watch this movie?", 10],
  ["Can my ten year old watch Exma?", 10],
  ["A guest aged 18 wants this film", 18],
  ["\u0637\u0641\u0644\u064a \u0639\u0645\u0631\u0647 10 \u0633\u0646\u0648\u0627\u062a", 10],
  ["\u0637\u0641\u0644\u064a \u0639\u0645\u0631\u0647 \u0661\u0660 \u0633\u0646\u0648\u0627\u062a", 10],
];
for (const [input, expected] of ageCases) {
  assert.equal(extractViewerAge(input), expected, `${input}: viewer age must be extracted deterministically`);
}
for (const input of ["Is this PG13?", "Show 15+ movies", "What does 18TC mean?", "18+", "PG15"]) {
  assert.equal(extractViewerAge(input), null, `${input}: certificate digits must not become a viewer age`);
}

// The word rating can mean a legal age certificate or a review score. The
// assistant must clarify a generic use and must never invent a review score.
const meaningCases = [
  ["What is the age rating for this movie?", "certificate"],
  ["Can my child watch this PG15 movie?", "certificate"],
  ["What does eighteen plus mean?", "certificate"],
  ["\u0645\u0627 \u0627\u0644\u062a\u0635\u0646\u064a\u0641 \u0627\u0644\u0639\u0645\u0631\u064a \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u064a\u0644\u0645\u061f", "certificate"],
  ["ما تصنيف فيلم Minions & Monsters؟", "certificate"],
  ["What is its IMDb score?", "review"],
  ["How many stars did this movie get?", "review"],
  ["What is the rating?", "ambiguous"],
  ["\u0645\u0627 \u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0641\u064a\u0644\u0645\u061f", "ambiguous"],
];
for (const [input, expected] of meaningCases) {
  assert.equal(resolveRatingMeaning(input), expected, `${input}: rating meaning must be ${expected}`);
  assert.equal(isMovieRatingQuestion(input), true, `${input}: rating information must route before movie selection`);
}
assert.equal(isMovieRatingQuestion("Can my ten year old watch Exma?"), true, "a voice-style child suitability question must be recognized");
assert.equal(isMovieRatingQuestion("ما تصنيف فيلم Minions & Monsters؟"), true, "a mixed-title Arabic rating question must route before visible-title selection");
assert.equal(isMovieRatingQuestion("Show me Arabic movies"), false, "a movie-language request must not become an age-rating question");
assert.equal(isMovieRatingQuestion("Switch the interface to Arabic"), false, "a language-switch request must not become an age-rating question");
assert.equal(resolveRatingMeaning("ما تصنيف النوع لفيلم Ezma؟"), null, "an Arabic genre classification question must remain outside age-rating handling");

// Policy codes are deliberately distinct. PG15 is accompaniment guidance;
// 15+ is restricted admission, even with a parent.
const policyCases = [
  ["G", "general", 0, null, false, false],
  ["PG", "parental_guidance", 0, null, false, false],
  ["PG13", "accompanied_guidance", 0, 13, false, false],
  ["PG15", "accompanied_guidance", 0, 15, false, false],
  ["15+", "restricted", 15, null, true, false],
  ["18+", "restricted", 18, null, true, false],
  ["21+", "restricted", 21, null, true, false],
  ["18TC", "provisional_restricted", 18, null, true, true],
];
for (const [code, category, minimumAge, companionMinimumAge, restricted, provisional] of policyCases) {
  const policy = ratingPolicyForCode(code);
  assert.equal(policy.code, code);
  assert.equal(policy.kind, category, `${code}: policy category must remain distinct`);
  assert.equal(policy.minimumAge, minimumAge, `${code}: minimum age must match the UAE rule`);
  assert.equal(policy.accompanimentAge, companionMinimumAge, `${code}: companion rule must match the UAE rule`);
  assert.equal(policy.kind === "restricted" || policy.kind === "provisional_restricted", restricted, `${code}: restricted kind must be deterministic`);
  assert.equal(policy.provisional, provisional, `${code}: provisional flag must be deterministic`);
}
assert.equal(ratingPolicyForCode("TBC").kind, "unknown", "unpublished certificates must have an explicit unknown policy");

const admissionCases = [
  ["G", 4, "allowed"],
  ["PG", 4, "allowed"],
  ["PG13", 10, "requires_accompaniment"],
  ["PG13", 14, "allowed"],
  ["PG15", 10, "requires_accompaniment"],
  ["PG15", 16, "allowed"],
  ["15+", 14, "not_allowed"],
  ["15+", 15, "allowed"],
  ["18+", 17, "not_allowed"],
  ["18+", 18, "allowed"],
  ["21+", 20, "not_allowed"],
  ["21+", 21, "allowed"],
  ["18TC", 17, "not_allowed"],
  ["18TC", 18, "allowed"],
];
for (const [rating, viewerAge, expected] of admissionCases) {
  assert.equal(
    evaluateMovieAdmission({ rating, viewerAge }).status,
    expected,
    `${rating} at age ${viewerAge} must evaluate as ${expected}`,
  );
}
assert.equal(evaluateMovieAdmission({ rating: "PG15", viewerAge: 10 }).requiresAccompaniment, true);
assert.equal(evaluateMovieAdmission({ rating: "15+", viewerAge: 10 }).status, "not_allowed", "15+ must never inherit PG15 accompaniment");
assert.equal(ratingPolicyForCode("18TC").provisional, true, "18TC must remain provisional while applying the 18+ restriction");
assert.equal(evaluateMovieAdmission({ rating: "TBC", viewerAge: 10 }).status, "unknown", "unknown data must never produce an eligibility guess");
assert.equal(evaluateMovieAdmission({ rating: "PG15" }).status, "age_required", "a known certificate without a supplied age must not invent an age");

// Information resolution must use the authoritative current, visible, or
// paused movie, support the exact Exma to Ezma correction, and remain pure.
const visibleStage = { view: "movies", movies: [ezma, moana, odyssey] };
assert.equal(
  resolveMovieForInformationQuestion({ query: "Can my 10-year-old watch Exma?", stage: visibleStage }).movie?.id,
  "ezma",
  "the reported Exma pronunciation or typo must resolve to the visible Ezma card",
);
assert.equal(
  resolveMovieForInformationQuestion({ query: "What is Moana rated?", stage: visibleStage }).movie?.id,
  "moana",
  "an exact visible title must resolve without selecting it",
);
for (const query of ["Can I take a 10-year-old?", "Could I bring my child?", "How long is it?", "Show me the trailer."]) {
  assert.equal(
    resolveMovieForInformationQuestion({ query, movies: [ezma, wake, moana] }).movie,
    null,
    `${query}: generic information words must not fuzzily resolve to Wake or another title`,
  );
}
assert.equal(
  resolveMovieForInformationQuestion({
    query: "\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0635\u0637\u062d\u0627\u0628 \u0637\u0641\u0644 \u0639\u0645\u0631\u0647 10 \u0633\u0646\u0648\u0627\u062a\u061f",
    movies: [ezma, wake, moana],
  }).movie,
  null,
  "a generic Arabic suitability question must wait for a movie title",
);
assert.equal(
  resolveMovieForInformationQuestion({
    query: "Can my child watch Minions?",
    movies: [ezma, moana, odyssey, minions],
  }).movie?.id,
  "minions",
  "an unambiguous partial title must ground child suitability against the full catalog",
);
assert.equal(
  resolveMovieForInformationQuestion({
    query: "Is Minions and Monsters suitable for children?",
    movies: [minions],
  }).movie?.id,
  "minions",
  "spoken and and an ampersand in the authoritative title must be equivalent",
);
const minionsAmbiguity = resolveMovieForInformationQuestion({
  query: "Can my child watch Minions?",
  movies: [minions, { ...minions, id: "minions-return", title: "Minions Return" }],
});
assert.equal(minionsAmbiguity.movie, null, "a partial title shared by two catalog entries must not be guessed");
assert.deepEqual(minionsAmbiguity.candidates.map((movie) => movie.id), ["minions", "minions-return"]);
assert.equal(
  resolveMovieForInformationQuestion({
    query: "What is this movie's age rating?",
    stage: { view: "showtimes", movie: ezma, sessions: [{ movieId: "ezma", time: "17:55" }] },
  }).movie?.id,
  "ezma",
  "a current selected movie must answer a referential rating question",
);
assert.equal(
  resolveMovieForInformationQuestion({
    query: "What is this movie rated?",
    stage: { view: "faq" },
    pausedStage: { view: "showtimes", movie: ezma, sessions: [{ movieId: "ezma", time: "17:55" }] },
  }).movie?.id,
  "ezma",
  "a hidden paused movie must remain the authoritative referent during an FAQ detour",
);
assert.equal(
  resolveMovieForInformationQuestion({ query: "What are the ratings?", stage: visibleStage }).movie,
  null,
  "a generic question over several visible movies must not guess or select one title",
);
const immutableInput = {
  query: "Can my 10-year-old watch Exma?",
  stage: { view: "movies", movies: [structuredClone(ezma), structuredClone(moana)] },
  pausedStage: { view: "showtimes", movie: structuredClone(odyssey) },
};
const immutableBefore = structuredClone(immutableInput);
resolveMovieForInformationQuestion(immutableInput);
assert.deepEqual(immutableInput, immutableBefore, "information resolution must not mutate selection, visible cards, or paused state");

// Exact reported journey: Ezma is PG15, so a 10-year-old may attend only
// with someone aged 15 or older. The answer must not claim a 15+ restriction.
const ezmaResolution = resolveMovieForInformationQuestion({
  query: "Can my 10-year-old watch Exma?",
  stage: visibleStage,
});
const ezmaAnswer = buildMovieRatingAnswer({
  query: "Can my 10-year-old watch Exma?",
  movie: ezmaResolution.movie,
  sessions: [
    { movieId: "ezma", time: "17:55", experience: "STANDARD" },
    { movieId: "ezma", time: "17:55", experience: "STANDARD" },
    { movieId: "ezma", time: "20:10", experience: "GOLD" },
  ],
  locale: "en",
});
assert.match(ezmaAnswer, /Ezma is rated PG15/i);
assert.match(ezmaAnswer, /aged 10[\s\S]*only with someone aged 15 or older/i);
assert.match(ezmaAnswer, /17:55, 20:10/);
assert.doesNotMatch(ezmaAnswer, /under 15 (?:is|are) not admitted/i, "PG15 must not be described as restricted 15+");
assertNoForbiddenDash(ezmaAnswer, "the exact Ezma answer must contain no Unicode dash punctuation");

const ezmaArabicAnswer = buildMovieRatingAnswer({
  query: "\u0647\u0644 \u064a\u0645\u0643\u0646 \u0644\u0637\u0641\u0644\u064a \u0648\u0639\u0645\u0631\u0647 10 \u0633\u0646\u0648\u0627\u062a \u0645\u0634\u0627\u0647\u062f\u0629 Ezma\u061f",
  movie: ezma,
  locale: "ar",
});
assert.match(ezmaArabicAnswer, /Ezma/u);
assert.match(ezmaArabicAnswer, /PG15/u);
assert.match(ezmaArabicAnswer, /10/u);
assert.match(ezmaArabicAnswer, /15/u);
assert.match(ezmaArabicAnswer, /\u0628\u0631\u0641\u0642\u0629/u, "the Arabic answer must state the accompaniment requirement");
assertNoForbiddenDash(ezmaArabicAnswer, "the Arabic rating answer must contain no Unicode dash punctuation");

const unknownAnswer = buildMovieRatingAnswer({
  query: "Can my 10-year-old watch Mystery Film?",
  movie: { id: "mystery", title: "Mystery Film", rating: "TBC" },
  locale: "en",
});
assert.match(unknownAnswer, /does not provide a verified age rating/i);
assert.match(unknownAnswer, /cannot confirm child admission/i);
assert.doesNotMatch(unknownAnswer, /rated (?:G|PG|PG13|PG15|15\+|18\+|21\+|18TC)/i, "unknown metadata must not be inferred from title or genre");

const minionsChildAnswer = buildMovieRatingAnswer({
  query: "Can my child watch Minions?",
  movie: minions,
  locale: "en",
});
assert.match(minionsChildAnswer, /Minions & Monsters is rated PG/i);
assert.match(minionsChildAnswer, /parental guidance/i);
assertNoForbiddenDash(minionsChildAnswer, "the Minions child-suitability answer must contain no Unicode dash punctuation");

const ambiguousAnswer = buildMovieRatingAnswer({ query: "What is its rating?", movie: ezma, locale: "en" });
assert.match(ambiguousAnswer, /age rating[\s\S]*review score/i);
assert.match(ambiguousAnswer, /will not invent a review score/i);
assert.doesNotMatch(ambiguousAnswer, /Ezma is rated PG15/i, "an ambiguous meaning must be clarified before asserting the certificate as the requested answer");

const reviewAnswer = buildMovieRatingAnswer({ query: "What is Ezma's IMDb score?", movie: ezma, locale: "en" });
assert.match(reviewAnswer, /do not have a verified review score/i);
assert.match(reviewAnswer, /VOX age rating is PG15/i);
assert.doesNotMatch(reviewAnswer, /\b\d(?:\.\d)?\s*\/\s*10\b/, "a review question must never receive an invented numeric score");

// The structured context must use only the relevant current movie sessions.
// It must not leak a different movie's time from the same visible result set.
const relevantSessionContext = buildAuthoritativeMovieRatingContext({
  query: "Can my 10-year-old watch Exma?",
  stage: {
    view: "showtimes",
    movie: ezma,
    sessions: [
      { movieId: "ezma", scheduledFilmId: "ezma", time: "17:55", exp: "STANDARD" },
      { movieId: "moana", scheduledFilmId: "moana", time: "18:30", exp: "IMAX" },
    ],
  },
  visibleMovies: [ezma, moana],
  locale: "en",
});
const relevantFacts = ratingFacts(relevantSessionContext);
assert.equal(relevantFacts.movieId, "ezma");
assert.equal(relevantFacts.movieTitle, "Ezma");
assert.equal(relevantFacts.rating, "PG15");
assert.equal(relevantFacts.viewerAge, 10);
assert.equal(relevantFacts.admissionStatus, "requires_accompaniment");
assert.deepEqual(relevantFacts.showtimes, ["17:55"], "only current Ezma sessions must be formatted in rating context");
assert.match(relevantSessionContext, /17:55/);
assert.doesNotMatch(relevantSessionContext, /18:30/, "another visible movie's session must not leak into the Ezma answer");
assertNoForbiddenDash(relevantSessionContext, "authoritative rating context must contain no Unicode dash punctuation");

// A rating question is informational. It must be recognized before discovery
// or exact-title selection can mutate the active movie journey.
assert.equal(
  shouldTreatAsDiscoveryFilterTurn("What is Ezma rated?", { view: "movies", signal: { patch: { movieTitle: "Ezma" }, hasDiscoverySignal: true } }),
  false,
  "a direct rating question must not become a discovery filter mutation",
);
assert.match(appSource, /resolveMovieInformation\(safeMessage, \{ isCurrent: voiceTurnIsCurrent \}\)/, "voice routing must resolve information with the current guest-turn guard before exact movie selection");
assert.match(appSource, /resolveMovieInformation\(value, \{ isCurrent: typedTurnIsCurrent \}\)/, "text routing must resolve information with the current guest-turn guard before exact movie selection");
const directSelectionDeclarations = [...appSource.matchAll(/(?:const|let) directMovieSelection\s*=([\s\S]{0,360}?);/g)];
assert.ok(directSelectionDeclarations.length >= 2, "text and voice must each declare guarded direct movie selection");
for (const [index, match] of directSelectionDeclarations.entries()) {
  assert.match(
    match[1],
    /!movieInformation\?\.handled/,
    `direct movie selection route ${index + 1} must explicitly exclude informational rating turns`,
  );
}

// Tool results and discovery grounding must expose canonical movie ratings so
// the agent never answers from title memory or from a KIDS auditorium label.
const discoveryLoaderSource = appSource.slice(
  appSource.indexOf("const loadDiscoveryForCinema"),
  appSource.indexOf("const findAvailableCinemasForCriteria"),
);
assert.match(
  discoveryLoaderSource,
  /movies:\s*enrichedMovies\.map\([\s\S]{0,500}\brating\s*:/,
  "show_movie_selection results must expose each visible movie's rating",
);
const showtimesToolStart = appSource.indexOf("show_showtimes: async");
const showtimesToolEnd = appSource.indexOf("show_seat_map: async", showtimesToolStart);
assert.ok(showtimesToolStart >= 0 && showtimesToolEnd > showtimesToolStart, "show_showtimes client-tool implementation must be present");
const showtimesToolSource = appSource.slice(showtimesToolStart, showtimesToolEnd);
assert.match(showtimesToolSource, /\bmovieRating\s*:/, "show_showtimes results must expose the selected movie's rating");
assert.match(discoveryContextSource, /movie\?\.rating|movie\.rating/, "authoritative discovery context must read each movie's published rating");
const discoveryRatingContext = buildAuthoritativeDiscoveryContext({
  cinema: { id: "0002", name: "Mall of the Emirates" },
  selectedDate: "2026-07-23",
  movies: [{
    ...ezma,
    showtimes: [{ time: "17:55", experience: "STANDARD" }],
  }],
});
assert.match(discoveryRatingContext, /Ezma[\s\S]*PG15[\s\S]*17:55/);
assertNoForbiddenDash(discoveryRatingContext, "discovery rating grounding must contain no Unicode dash punctuation");

// KIDS identifies an auditorium experience, not a legal certificate or a
// family-content guarantee. An adult movie in KIDS alone must not satisfy the
// kids or family audience filter. An explicit KIDS experience request remains
// valid when the guest did not ask for family suitability.
const familyFixtureMovies = [
  { id: "adult-kids", title: "Adult Horror", rating: "18+", genres: ["Horror"], experiences: ["KIDS"] },
  { id: "family", title: "Family Adventure", rating: "PG", genres: ["Family"], experiences: ["STANDARD"] },
];
const familyFixtureSessions = [
  { sessionId: "adult-kids-session", scheduledFilmId: "adult-kids", cinemaId: "0002", programmingDate: "2026-07-23", time: "17:00", exp: "KIDS" },
  { sessionId: "family-standard", scheduledFilmId: "family", cinemaId: "0002", programmingDate: "2026-07-23", time: "17:30", exp: "STANDARD" },
];
const familyAudienceResult = filterDiscoveryResults({
  movies: familyFixtureMovies,
  sessions: familyFixtureSessions,
  cinemas: [{ id: "0002", name: "Mall of the Emirates", city: "Dubai" }],
  preferences: { cinemaId: "0002", date: "2026-07-23", audience: "kids_family" },
});
assert.deepEqual(familyAudienceResult.movies.map((movie) => movie.id), ["family"], "KIDS experience alone must not make an 18+ horror title family suitable");
const explicitKidsExperience = filterDiscoveryResults({
  movies: familyFixtureMovies,
  sessions: familyFixtureSessions,
  cinemas: [{ id: "0002", name: "Mall of the Emirates", city: "Dubai" }],
  preferences: { cinemaId: "0002", date: "2026-07-23", experience: "KIDS" },
});
assert.deepEqual(explicitKidsExperience.movies.map((movie) => movie.id), ["adult-kids"], "an explicit KIDS auditorium request is distinct from a family-suitability claim");
assert.match(discoveryPreferencesSource, /if \(rating && !\["G", "PG", "PG13"\]\.includes\(rating\)\) return false;/, "family filtering must apply an authoritative safe-rating gate before KIDS experience evidence");

// The repository prompt is the final voice contract. It must carry the same
// movie-specific rules as local text routing and preserve the active journey.
for (const [pattern, message] of [
  [/movie-specific age-rating|movie-specific rating/i, "prompt must define movie-specific rating handling"],
  [/PG13[\s\S]*PG15[\s\S]*(?:accompan|someone aged)/i, "prompt must explain accompaniment ratings"],
  [/15\+[\s\S]*18\+[\s\S]*21\+[\s\S]*(?:even with a parent|restricted)/i, "prompt must explain restricted ratings"],
  [/18TC[\s\S]*(?:provisional|final rating)[\s\S]*18\+/i, "prompt must explain provisional 18TC handling"],
  [/KIDS[\s\S]{0,300}(?:not|never)[\s\S]{0,180}(?:age certificate|age suitability|family suitability)/i, "prompt must not treat KIDS as an age guarantee"],
  [/(?:rating|suitability) question[\s\S]{0,500}(?:do not|must not|never)[\s\S]{0,180}(?:select|advance|restart)/i, "prompt must preserve booking state during a rating question"],
  [/(?:review score|IMDb)[\s\S]{0,300}(?:do not|never)[\s\S]{0,100}invent/i, "prompt must prohibit invented review scores"],
]) assert.match(VOXI_AGENT_PROMPT, pattern, message);
assertNoForbiddenDash(VOXI_AGENT_PROMPT, "movie-rating prompt rules must contain no Unicode dash punctuation");

for (const [label, value] of Object.entries({
  ezmaAnswer,
  ezmaArabicAnswer,
  unknownAnswer,
  ambiguousAnswer,
  reviewAnswer,
  relevantSessionContext,
  discoveryRatingContext,
})) assertNoForbiddenDash(value, `${label} must contain no Unicode en dash or em dash`);

console.log("Validated canonical movie ratings, age and accompaniment policy, Ezma age-10 suitability, bilingual voice forms, authoritative movie and session grounding, informational routing, family filtering, prompt parity, and punctuation safety.");
