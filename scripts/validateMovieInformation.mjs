import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyMovieInformationQuestion,
  isLikelyMovieInformationQuestion,
  resolveMovieInformationTurn,
} from "../src/lib/movieInformation.js";

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
  ["ما مدة فيلم Ezma؟", "runtime"],
  ["ما قصة فيلم Ezma؟", "synopsis"],
];
for (const [query, topic] of cases) {
  assert.equal(classifyMovieInformationQuestion(query), topic, `${query} must classify as ${topic}`);
  assert.equal(isLikelyMovieInformationQuestion(query), true);
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
assert.match(appSource, /movieInformation\?\.handled/);
assert.match(appSource, /synopsis\|plot\|story\|storyline/);
assert.match(appSource, /movieRating:\s*movie\?\.rating/);
assert.match(appSource, /movieRating:\s*movie\.rating/);
assert.match(appSource, /pendingAuthoritativeMovieAnswerRef/);
assert.match(appSource, /movieInformationMovieRef\.current = movieInformation\.movie/);
assert.match(appSource, /visibleMovies\.length \? null : movieInformationMovieRef\.current/);
assert.match(appSource, /movieInformationMovieRef\.current = null/);
assert.match(appSource, /read-only movie-information turn/);
assert.match(appSource, /already displayed this exact answer for the typed turn/);
assert.match(appSource, /Keep the current .* panel and every retained booking field unchanged/);

console.log("Movie-information validation passed: 41 deterministic text, voice-context, Arabic, metadata, ambiguity, filter-routing, and state-continuity assertions.");
