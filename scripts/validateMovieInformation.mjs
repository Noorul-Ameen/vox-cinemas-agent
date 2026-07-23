import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMovieTitleClarification,
  classifyMovieInformationQuestion,
  isLikelyMovieInformationQuestion,
  resolveMovieInformationTurn,
} from "../src/lib/movieInformation.js";
import { loadMovieInformationCatalog, mergeMovieInformationCatalog } from "../src/lib/movieInformationCatalog.js";
import { isExplicitMovieTransactionTurn, isPotentialMovieInformationTurn } from "../src/lib/movieInformationPrefilter.js";

const ezma = {
  id: "HO00015828",
  title: "Ezma",
  rating: "PG15",
  runtime: 105,
  language: "Arabic",
  genres: ["Drama", "Romance"],
  subtitles: [],
  synopsis: "Issa follows videotaped clues from his younger self and reconnects with his passion for filmmaking.",
  relevantSessions: [{ sessionId: "ezma-1755", time: "17:55", exp: "PREMIER" }],
};
const family = { id: "family", title: "Family Quest", rating: "PG", runtime: 96, language: "English", genres: ["Animation", "Family"] };
const minions = {
  id: "minions",
  title: "Minions & Monsters",
  rating: "PG",
  runtime: 100,
  language: "English",
  genres: ["Animation", "Comedy", "Family"],
};

const repositoryInformationCatalog = await loadMovieInformationCatalog([]);
assert.ok(repositoryInformationCatalog.length >= 80, "the runtime loader must expose a substantial current official information catalog");
const variantInformationCatalog = mergeMovieInformationCatalog([], [
  { id: "HO00015542", title: "Jana Nayagan", languageName: "Tamil", rating: "15+", runtime: 195 },
  { id: "HO00015544", title: "Jana Nayagan", languageName: "Hindi", rating: "15+", runtime: 0 },
  { id: "HO00015725", title: "Toxic", languageName: "Kannada", rating: "18TC", runtime: 150 },
  { id: "HO00015727", title: "Toxic", languageName: "Hindi", rating: "18TC", runtime: 150 },
  { id: "HO00015731", title: "Toxic", languageName: "Tamil", rating: "18TC", runtime: 150 },
  { id: "HO00015757", title: "Toxic", languageName: "Malayalam", rating: "18TC", runtime: 150 },
]);
const behaviorInformationCatalog = mergeMovieInformationCatalog(repositoryInformationCatalog, [ezma]);
const janaNayaganVariants = variantInformationCatalog.filter((movie) => movie.title === "Jana Nayagan");
assert.deepEqual(janaNayaganVariants.map((movie) => movie.languageName), ["Tamil", "Hindi"], "the runtime information catalog must preserve both Jana Nayagan language variants");
const toxicVariants = variantInformationCatalog.filter((movie) => movie.title === "Toxic");
assert.deepEqual(toxicVariants.map((movie) => movie.languageName), ["Kannada", "Hindi", "Tamil", "Malayalam"], "the runtime information catalog must preserve all Toxic language variants");
const janaLanguageAnswer = resolveMovieInformationTurn({ query: "What language is Jana Nayagan?", locale: "en", movies: variantInformationCatalog });
assert.equal(janaLanguageAnswer.movie, null, "a title-level language question must not silently choose one official variant");
assert.match(janaLanguageAnswer.answer, /Tamil and Hindi/, "Jana Nayagan language guidance must report both current variants");
const toxicLanguageAnswer = resolveMovieInformationTurn({ query: "What language is Toxic?", locale: "en", movies: variantInformationCatalog });
assert.match(toxicLanguageAnswer.answer, /Kannada, Hindi, Tamil, and Malayalam/, "Toxic language guidance must report every current variant");
const toxicRuntimeClarification = resolveMovieInformationTurn({ query: "How long is Toxic?", locale: "en", movies: variantInformationCatalog });
assert.equal(toxicRuntimeClarification.movie, null, "a variant-specific fact must not use an arbitrary same-title record");
assert.match(toxicRuntimeClarification.answer, /include the language version/i, "a variant-specific fact must request the exact language version");
const toxicHindiRuntime = resolveMovieInformationTurn({ query: "How long is Toxic in Hindi?", locale: "en", movies: variantInformationCatalog });
assert.equal(toxicHindiRuntime.movie?.id, "HO00015727", "an explicitly named language variant must resolve by official code");
assert.match(toxicHindiRuntime.answer, /150 minutes/, "the selected Toxic Hindi variant must use its official runtime");
const unrelatedHindiContext = resolveMovieInformationTurn({
  query: "How long is Jana Nayagan?",
  locale: "en",
  currentMovie: { id: "other-hindi", title: "Another Movie", languageName: "Hindi", runtime: 100 },
  movies: variantInformationCatalog,
});
assert.equal(unrelatedHindiContext.movie, null, "an unrelated current movie language must not select a same-title variant");
assert.match(unrelatedHindiContext.answer, /include the language version/i, "an unqualified Jana Nayagan fact must clarify the variant");
const explicitHindiOverCurrentTamil = resolveMovieInformationTurn({
  query: "How long is Jana Nayagan in Hindi?",
  locale: "en",
  currentMovie: janaNayaganVariants.find((movie) => movie.languageName === "Tamil"),
  movies: variantInformationCatalog,
});
assert.equal(explicitHindiOverCurrentTamil.movie?.id, "HO00015544", "an explicitly requested language must override a different current variant");
const arabicJanaLanguageAnswer = resolveMovieInformationTurn({ query: "ما لغة فيلم Jana Nayagan؟", locale: "ar", movies: variantInformationCatalog });
assert.equal(isPotentialMovieInformationTurn("ما لغة فيلم Jana Nayagan؟"), true, "the App prefilter must route a mixed Latin-title Arabic language question into the local movie-information resolver");
assert.match(arabicJanaLanguageAnswer.answer, /Tamil وHindi/u, "Arabic language guidance must retain both Jana Nayagan variants");
const fresherEzma = { ...ezma, rating: "PG", runtime: 106, synopsis: "", genres: [] };
const mergedInformationCatalog = mergeMovieInformationCatalog([fresherEzma], [ezma]);
assert.equal(mergedInformationCatalog.find((movie) => movie.title === "Ezma")?.rating, "PG", "current schedule metadata must override the information-only reference record with the same title");
assert.equal(mergedInformationCatalog.find((movie) => movie.title === "Ezma")?.synopsis, ezma.synopsis, "empty schedule metadata must not erase a useful official fallback synopsis");
assert.deepEqual(mergedInformationCatalog.find((movie) => movie.title === "Ezma")?.genres, ezma.genres, "empty schedule arrays must not erase useful official fallback genres");

const cases = [
  ["Can I take my 10 year old to Exma?", "rating"],
  ["What is Ezma about?", "synopsis"],
  ["What language is Ezma?", "language"],
  ["Does Ezma have subtitles?", "subtitles"],
  ["How long is Ezma?", "runtime"],
  ["What genre is Ezma?", "genre"],
  ["Who is in the cast of Ezma?", "cast"],
  ["Show me the trailer for Ezma", "trailer"],
  ["What is the release date for Ezma?", "release"],
  ["Tell me about Ezma", "details"],
  ["ما تصنيف فيلم Ezma لطفل عمره 10 سنوات؟", "rating"],
  ["ما تصنيف فيلم Minions & Monsters؟", "rating"],
  ["ما مدة فيلم Ezma؟", "runtime"],
  ["ما قصة فيلم Ezma؟", "synopsis"],
];
for (const [query, topic] of cases) {
  assert.equal(classifyMovieInformationQuestion(query), topic, `${query} must classify as ${topic}`);
  assert.equal(isLikelyMovieInformationQuestion(query), true);
}
assert.equal(classifyMovieInformationQuestion("ما تصنيف النوع لفيلم Ezma؟"), "genre", "an Arabic genre question must not be mistaken for an age-rating question");

const arabicMinionsRating = resolveMovieInformationTurn({
  query: "ما تصنيف فيلم Minions & Monsters؟",
  locale: "ar",
  movies: [ezma, family, minions],
  visibleMovies: [minions],
});
assert.equal(arabicMinionsRating.handled, true, "a mixed-title Arabic rating question must be answered locally");
assert.equal(arabicMinionsRating.topic, "rating");
assert.equal(arabicMinionsRating.movie?.id, "minions");
assert.match(arabicMinionsRating.answer, /تصنيف فيلم Minions & Monsters هو PG/u);

const transactionalTitleCollisions = [
  "I need three tickets for Toy Story 5 at Mall of the Emirates tomorrow at 8:45 PM",
  "Book three tickets for Toy Story 5 at Mall of the Emirates tomorrow at 8:45 PM",
  "Book Chennai Love Story tomorrow",
  "I want The India Story at 8 PM",
  "Book The Dog Stars",
  "Show me Dog Stars tomorrow",
  "Cancel Toy Story 5",
  "I choose Toy Story 5",
  "Select Chennai Love Story",
];
for (const query of transactionalTitleCollisions) {
  assert.equal(isExplicitMovieTransactionTurn(query), true, `${query}: explicit booking or discovery intent must win over title words`);
  assert.equal(isPotentialMovieInformationTurn(query), false, `${query}: the shared App prefilter must not route a transaction as movie information`);
  assert.equal(classifyMovieInformationQuestion(query), null, `${query}: the shared text and voice classifier must preserve the transaction`);
  assert.equal(resolveMovieInformationTurn({ query, movies: behaviorInformationCatalog }).handled, false, `${query}: movie information resolution must leave the transaction untouched`);
}

for (const [query, expectedTopic] of [
  ["What is the story of Toy Story 5?", "synopsis"],
  ["What is Chennai Love Story about?", "synopsis"],
  ["What is the plot of The India Story?", "synopsis"],
  ["What is the rating of The Dog Stars?", "rating"],
  ["Show me the trailer for Toy Story 5", "trailer"],
  ["How long is Chennai Love Story?", "runtime"],
  ["What language is The India Story?", "language"],
  ["Tell me about Toy Story 5", "details"],
  ["I want to know how long Toy Story 5 is", "runtime"],
  ["I need a review score for Toy Story 5", "rating"],
  ["I am looking for information about Toy Story 5", "details"],
  ["Tell me how long Chennai Love Story is", "runtime"],
  ["Show me how long Toy Story 5 is", "runtime"],
  ["Could you show me the trailer for Toy Story 5?", "trailer"],
  ["I want to watch the trailer for Toy Story 5", "trailer"],
  ["Can I see the trailer for Toy Story 5?", "trailer"],
  ["Please play the trailer for Toy Story 5", "trailer"],
  ["Would you tell me the story of Chennai Love Story?", "synopsis"],
]) {
  assert.equal(isExplicitMovieTransactionTurn(query), false, `${query}: a direct information question must not become a transaction`);
  assert.equal(isPotentialMovieInformationTurn(query), true, `${query}: the App prefilter must retain the direct information question`);
  assert.equal(classifyMovieInformationQuestion(query), expectedTopic, `${query}: the requested information topic must be preserved`);
}

assert.equal(classifyMovieInformationQuestion("Show me PG movies tomorrow"), null, "rating-code discovery must remain a filter request");
for (const filterTurn of [
  "any language is fine",
  "no genre preference",
  "show me English language movies",
  "I want comedy genre movies",
  "what Arabic language films are showing tonight",
]) {
  assert.equal(classifyMovieInformationQuestion(filterTurn), null, `${filterTurn}: discovery filters must not become movie-information questions`);
}

const ageAnswer = resolveMovieInformationTurn({ query: "Can I take my 10 year old to Exma?", locale: "en", visibleMovies: [ezma, family] });
assert.equal(ageAnswer.handled, true);
assert.equal(ageAnswer.movie.title, "Ezma");
assert.match(ageAnswer.answer, /PG15/);
assert.match(ageAnswer.answer, /10/);
assert.match(ageAnswer.answer, /15 or older/i);
assert.doesNotMatch(ageAnswer.answer, /check (?:the|its) rating|look elsewhere/i);
assert.match(ageAnswer.context, /AUTHORITATIVE MOVIE RATING FACTS/);

for (const query of [
  "Can I take a 10-year-old to Ezma?",
  "Could my 10-year-old see Ezma?",
  "Is Ezma suitable for my ten year old?",
  "Can my ten year old watch Exma?",
]) {
  const result = resolveMovieInformationTurn({ query, locale: "en", movies: behaviorInformationCatalog });
  assert.equal(result.handled, true, `${query}: the fresh-session App catalog must handle the rating turn locally`);
  assert.equal(result.movie?.title, "Ezma", `${query}: exact and voice-like title forms must resolve to Ezma`);
  assert.match(result.answer, /Ezma is rated PG15/i, query);
  assert.match(result.answer, /aged 10[\s\S]*only with someone aged 15 or older/i, query);
  assert.doesNotMatch(result.answer, /Which movie do you mean/i, query);
}

const arabicFreshEzma = resolveMovieInformationTurn({
  query: "\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0635\u0637\u062d\u0627\u0628 \u0637\u0641\u0644 \u0639\u0645\u0631\u0647 10 \u0633\u0646\u0648\u0627\u062a \u0625\u0644\u0649 Ezma\u061f",
  locale: "ar",
  movies: behaviorInformationCatalog,
});
assert.equal(arabicFreshEzma.handled, true, "the equivalent fresh-session Arabic suitability question must be handled");
assert.equal(arabicFreshEzma.movie?.title, "Ezma");
assert.match(arabicFreshEzma.answer, /Ezma/u);
assert.match(arabicFreshEzma.answer, /PG15/u);
assert.match(arabicFreshEzma.answer, /10/u);
assert.match(arabicFreshEzma.answer, /15/u);
assert.match(arabicFreshEzma.answer, /\u0628\u0631\u0641\u0642\u0629/u, "the Arabic answer must state the accompaniment requirement");

const englishClarificationQuestion = "Can I take a 10-year-old?";
const englishClarification = resolveMovieInformationTurn({
  query: englishClarificationQuestion,
  locale: "en",
  movies: behaviorInformationCatalog,
});
assert.equal(englishClarification.movie, null);
assert.equal(englishClarification.topic, "rating");
assert.equal(englishClarification.viewerAge, 10, "the title clarification result must expose the original viewer age for the App pending state");
assert.match(englishClarification.answer, /Which movie do you mean/i);
const englishClarificationAnswer = resolveMovieInformationTurn({
  query: `${englishClarificationQuestion} Ezma`,
  forcedTopic: englishClarification.topic,
  viewerAge: englishClarification.viewerAge,
  locale: "en",
  movies: behaviorInformationCatalog,
});
assert.equal(englishClarificationAnswer.movie?.title, "Ezma");
assert.match(englishClarificationAnswer.answer, /Ezma is rated PG15/i);
assert.match(englishClarificationAnswer.answer, /aged 10[\s\S]*only with someone aged 15 or older/i, "the second turn must retain age 10 rather than falling back to generic PG15 guidance");

for (const query of [
  "Could I bring my 10-year-old?",
  "Can my child watch it?",
  "How long is it?",
  "Show me the trailer.",
]) {
  const result = resolveMovieInformationTurn({ query, locale: "en", movies: behaviorInformationCatalog });
  assert.equal(result.movie, null, `${query}: information wording must not fuzzily select an unrelated catalog title`);
  assert.match(result.answer, /Which movie do you mean/i, `${query}: a missing title must produce a clarification`);
}

const arabicClarificationQuestion = "\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0635\u0637\u062d\u0627\u0628 \u0637\u0641\u0644 \u0639\u0645\u0631\u0647 10 \u0633\u0646\u0648\u0627\u062a\u061f";
const arabicClarification = resolveMovieInformationTurn({
  query: arabicClarificationQuestion,
  locale: "ar",
  movies: behaviorInformationCatalog,
});
assert.equal(arabicClarification.movie, null);
assert.equal(arabicClarification.topic, "rating");
assert.equal(arabicClarification.viewerAge, 10);
const arabicClarificationAnswer = resolveMovieInformationTurn({
  query: `${arabicClarificationQuestion} Ezma`,
  forcedTopic: arabicClarification.topic,
  viewerAge: arabicClarification.viewerAge,
  locale: "ar",
  movies: behaviorInformationCatalog,
});
assert.equal(arabicClarificationAnswer.movie?.title, "Ezma");
assert.match(arabicClarificationAnswer.answer, /PG15/u);
assert.match(arabicClarificationAnswer.answer, /10/u);
assert.match(arabicClarificationAnswer.answer, /15/u);
assert.match(arabicClarificationAnswer.answer, /\u0628\u0631\u0641\u0642\u0629/u, "the Arabic second turn must retain the age-specific accompaniment answer");

for (const query of [
  "\u0647\u0644 \u064a\u0645\u0643\u0646\u0646\u064a \u0627\u0635\u0637\u062d\u0627\u0628 \u0637\u0641\u0644 \u0639\u0645\u0631\u0647 10 \u0633\u0646\u0648\u0627\u062a\u061f",
  "\u0645\u0627 \u0645\u062f\u0629 \u0627\u0644\u0641\u064a\u0644\u0645\u061f",
]) {
  const result = resolveMovieInformationTurn({ query, locale: "ar", movies: behaviorInformationCatalog });
  assert.equal(result.movie, null, `${query}: Arabic information wording must not fuzzily select an unrelated catalog title`);
}

const runtimeClarification = resolveMovieInformationTurn({ query: "How long is it?", locale: "en", movies: behaviorInformationCatalog });
const runtimeClarificationAnswer = resolveMovieInformationTurn({
  query: "How long is it? Ezma",
  forcedTopic: runtimeClarification.topic,
  locale: "en",
  movies: behaviorInformationCatalog,
});
assert.equal(runtimeClarification.topic, "runtime", "the structured pending state must retain non-rating information topics too");
assert.match(runtimeClarificationAnswer.answer, /105 minutes/i);

const minionsChildSuitability = resolveMovieInformationTurn({
  query: "Can my child watch Minions?",
  locale: "en",
  visibleMovies: [],
  movies: [ezma, family, minions],
});
assert.equal(minionsChildSuitability.handled, true, "a title-specific child question must remain an information turn");
assert.equal(minionsChildSuitability.movie?.id, "minions", "an unambiguous partial catalog title must resolve even when it is not the current visible card");
assert.match(minionsChildSuitability.answer, /Minions & Monsters is rated PG/i);
assert.match(minionsChildSuitability.answer, /parental guidance/i);
assert.doesNotMatch(minionsChildSuitability.answer, /Which movie do you mean/i);

const spokenMinionsTitle = resolveMovieInformationTurn({
  query: "Is Minions and Monsters suitable for children?",
  locale: "en",
  movies: [minions],
});
assert.equal(spokenMinionsTitle.movie?.id, "minions", "spoken and must match the ampersand in a catalog title for information questions");
assert.match(spokenMinionsTitle.answer, /rated PG/i);

const clarifiedMinionsRating = resolveMovieInformationTurn({
  query: "Minions and Monsters",
  forcedTopic: "rating",
  locale: "en",
  movies: [minions],
});
assert.equal(clarifiedMinionsRating.movie?.id, "minions", "a bare title must complete the pending movie-information question without becoming a booking selection");
assert.equal(clarifiedMinionsRating.topic, "rating");
assert.match(clarifiedMinionsRating.answer, /rated PG/i);

const ambiguousMinions = resolveMovieInformationTurn({
  query: "Can my child watch Minions?",
  locale: "en",
  movies: [minions, { ...minions, id: "minions-return", title: "Minions Return" }],
});
assert.equal(ambiguousMinions.movie, null, "a shared partial title must not be guessed");
assert.match(ambiguousMinions.answer, /Which movie do you mean: Minions & Monsters, Minions Return\?/i);
assert.equal(
  buildMovieTitleClarification({ locale: "en", candidates: [minions, { id: "minions-return", title: "Minions Return" }] }),
  "Which movie do you mean: Minions & Monsters, Minions Return? Please say one title.",
  "the pure clarification helper must ground the follow-up in the ambiguous catalog titles",
);

const questions = [
  ["What is Ezma about?", /videotaped clues/i],
  ["What language is Ezma?", /Arabic/],
  ["Does Ezma have subtitles?", /does not specify subtitles/i],
  ["How long is Ezma?", /105 minutes/i],
  ["What genre is Ezma?", /Drama, Romance/i],
  ["Tell me about Ezma", /PG15.*Drama, Romance.*Arabic.*105 minutes/i],
  ["Who is in the cast of Ezma?", /will not guess/i],
  ["Show me the trailer for Ezma", /not available/i],
  ["What is the release date for Ezma?", /does not provide a verified release date/i],
];
for (const [query, expected] of questions) {
  const result = resolveMovieInformationTurn({ query, locale: "en", visibleMovies: [ezma, family] });
  assert.equal(result.handled, true, query);
  assert.equal(result.movie?.title, "Ezma", query);
  assert.match(result.answer, expected, query);
  assert.doesNotMatch(result.answer, /[\u2013\u2014]/u, query);
}

const review = resolveMovieInformationTurn({ query: "What is the IMDb rating for Ezma?", visibleMovies: [ezma] });
assert.match(review.answer, /do not have a verified review score/i);
assert.match(review.answer, /PG15/);
const ambiguous = resolveMovieInformationTurn({ query: "What is Ezma's rating?", visibleMovies: [ezma] });
assert.match(ambiguous.answer, /age rating.*review score/i);

const plural = resolveMovieInformationTurn({ query: "What are their ratings?", visibleMovies: [ezma, family] });
assert.match(plural.answer, /Ezma: PG15/);
assert.match(plural.answer, /Family Quest: PG/);

const paused = resolveMovieInformationTurn({
  query: "How long is this movie?",
  pausedStage: { view: "checkout", movie: ezma, order: { movieId: ezma.id, movieTitle: ezma.title, movieRating: ezma.rating } },
});
assert.equal(paused.movie?.title, "Ezma");
assert.match(paused.answer, /105 minutes/i);

const implicitCurrent = resolveMovieInformationTurn({ query: "What is the story?", currentMovie: ezma, movies: [ezma, family] });
assert.equal(implicitCurrent.movie?.title, "Ezma");
assert.match(implicitCurrent.answer, /videotaped clues/i);

const arabic = resolveMovieInformationTurn({ query: "هل يمكن لطفل عمره 10 سنوات مشاهدة Ezma؟", locale: "ar", visibleMovies: [ezma] });
assert.match(arabic.answer, /PG15/);
assert.match(arabic.answer, /15/);

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const movieInformationPrefilterSource = await readFile(new URL("../src/lib/movieInformationPrefilter.js", import.meta.url), "utf8");
assert.match(appSource, /movieInformation\?\.handled/);
assert.match(movieInformationPrefilterSource, /synopsis\|plot\|story\|storyline/);
assert.match(appSource, /resolveMovieInformation\(safeMessage, \{ isCurrent: voiceTurnIsCurrent \}\)/, "voice turns must use the guarded shared movie-information route");
assert.match(appSource, /resolveMovieInformation\(value, \{ isCurrent: typedTurnIsCurrent \}\)/, "typed turns must use the guarded shared movie-information route");
for (const [queryName, resolveName] of [
  ["safeMessage", "voiceTurnIsCurrent"],
  ["value", "typedTurnIsCurrent"],
]) {
  const selectionPattern = new RegExp(`await resolveVisibleMovieSelectionTurnLazy\\(\\s*\\{ text: ${queryName}, stage: stageRef\\.current \\},\\s*\\{ isCurrent: ${resolveName} \\}`);
  const informationNeedle = `resolveMovieInformation(${queryName}, { isCurrent: ${resolveName} })`;
  const selectionIndex = appSource.search(selectionPattern);
  const informationIndex = appSource.indexOf(informationNeedle, selectionIndex);
  assert.ok(selectionIndex >= 0 && informationIndex > selectionIndex, `${queryName}: exact visible movie selection must be checked before movie-information routing`);
}
assert.equal((appSource.match(/!directCancellation && !preInformationMovieSelection/g) || []).length, 2, "text and voice must suppress movie information for cancellation and exact visible-title continuations");
const ticketQuantityBody = appSource.match(/function extractTicketQuantity\(text\) \{[\s\S]+?\n\}\n\nconst cancellationBookingSummary/u)?.[0]
  ?.replace(/\n\nconst cancellationBookingSummary$/u, "");
assert.ok(ticketQuantityBody, "the conversational ticket-target extractor must remain available");
const extractTicketQuantity = Function("MAX_TICKETS", `${ticketQuantityBody}; return extractTicketQuantity;`)(10);
for (const query of transactionalTitleCollisions.slice(0, 2)) {
  assert.equal(extractTicketQuantity(query), 3, `${query}: the booking route must retain the conversational target of three seats`);
}
assert.match(appSource, /movieRating:\s*movie\?\.rating/);
assert.match(appSource, /movieRating:\s*movie\.rating/);
assert.match(appSource, /pendingAuthoritativeMovieAnswerRef/);
assert.match(appSource, /movieInformationMovieRef\.current = movieInformation\.movie/);
assert.match(appSource, /visibleMovies\.length \? null : movieInformationMovieRef\.current/);
assert.match(appSource, /movieInformationMovieRef\.current = null/);
assert.match(appSource, /loadMovieInformationCatalog\(\[/, "App must load its information-only reference catalog before resolving a fresh-session title question");
assert.match(appSource, /resolveFilmCandidate\(movieInformationCatalog, query\)/, "title-only clarification continuations must use the same information catalog");
assert.match(appSource, /movies:\s*movieInformationCatalog/, "direct movie-information turns must use the merged information catalog");
assert.match(appSource, /pendingMovieInformationRef = useRef\(null\)/, "movie-information clarification must use a structured one-turn pending ref");
for (const field of ["topic", "query", "viewerAge", "locale", "turnSequence", "expiresAt"]) {
  assert.match(appSource, new RegExp(`${field}:`), `the structured pending information ref must retain ${field}`);
}
assert.match(appSource, /pendingInformation\.expiresAt <= Date\.now\(\)/, "expired title clarifications must clear before routing another turn");
assert.match(appSource, /userTurnSequenceRef\.current > pendingInformation\.turnSequence \+ 1/, "a title clarification must not survive beyond the immediately following user turn");
assert.match(appSource, /forcedTopic: continuationMovie \? pendingInformation\.topic : null/, "a grounded bare title must answer the retained information topic");
assert.match(appSource, /viewerAge: continuationMovie \? pendingInformation\.viewerAge : undefined/, "the title continuation must retain the original viewer age");
assert.match(appSource, /`\$\{pendingInformation\.query\} \$\{query\}`/, "the title continuation must retain other facts from the original information question");
assert.match(appSource, /pendingMovieInformationRef\.current = requiresMovieTitle[\s\S]{0,500}viewerAge: result\.viewerAge \?\? null/, "the pending ref must store structured facts and clear after a grounded answer");
assert.match(appSource, /pendingMovieInformationRef\.current = null;[\s\S]{0,160}return null;/, "cancelled or unmatched one-turn clarifications must clear safely");
const abandonJourneySource = appSource.slice(appSource.indexOf("const abandonActiveBookingJourney"), appSource.indexOf("const beginReplacementBookingJourney"));
assert.match(abandonJourneySource, /pendingMovieInformationRef\.current = null/, "cancelling an active journey must also clear a pending movie-information clarification");
assert.match(appSource, /read-only movie-information turn/);
assert.match(appSource, /already displayed this exact answer for the typed turn/);
assert.match(appSource, /Keep the current .* panel and every retained booking field unchanged/);

console.log("Movie-information validation passed: deterministic text, voice-context, Arabic, metadata, ambiguity, filter-routing, and state-continuity assertions.");
