import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalDeterministicToolAuthorization, shouldBlockConcurrentDeterministicToolCall } from "../src/lib/deterministicToolRouting.js";
import { resolveVisibleMovieSelectionTurn, routePendingVisibleMovie } from "../src/lib/movieSelectionRouting.js";
import { resolveVisibleShowtimeSelectionTurn } from "../src/lib/showtimeSelectionRouting.js";

const movies = [
  { id: "ezma", title: "Ezma" },
  { id: "supergirl", title: "Supergirl" },
];
const stage = { view: "movies", movies };
const ampersandStage = { view: "movies", movies: [{ id: "minions", title: "Minions & Monsters" }] };
const bilingualStage = { view: "movies", movies: [{ id: "toy", title: "Toy Story 5" }] };

assert.equal((await resolveVisibleMovieSelectionTurn({ text: "Ezma", stage }))?.id, "ezma");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "I choose Ezma", stage }))?.id, "ezma");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "اخترت Ezma", stage }))?.id, "ezma");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "أريد Ezma", stage }))?.id, "ezma");
assert.equal(await resolveVisibleMovieSelectionTurn({ text: "the chosen movies", stage }), null);
assert.equal(await resolveVisibleMovieSelectionTurn({ text: "Tell me about Ezma", stage }), null);
assert.equal(await resolveVisibleMovieSelectionTurn({ text: "I want details about Ezma", stage }), null);
assert.equal(
  await resolveVisibleMovieSelectionTurn({ text: "ما تصنيف فيلم Minions & Monsters؟", stage: ampersandStage }),
  null,
  "an Arabic age-rating question containing an exact visible title must stay informational",
);
assert.equal(
  await resolveVisibleMovieSelectionTurn({ text: "What is the age rating for Minions & Monsters?", stage: ampersandStage }),
  null,
  "an English age-rating question containing an exact visible title must stay informational",
);
for (const informationQuery of [
  "ما تقييم فيلم Minions & Monsters؟",
  "ما مدة فيلم Minions & Monsters؟",
  "ما لغة فيلم Minions & Monsters؟",
  "ما قصة فيلم Minions & Monsters؟",
  "هل فيلم Minions & Monsters مناسب للأطفال؟",
]) {
  assert.equal(
    await resolveVisibleMovieSelectionTurn({ text: informationQuery, stage: ampersandStage }),
    null,
    `${informationQuery}: an Arabic information question containing a visible title must stay read-only`,
  );
}
assert.equal(await resolveVisibleMovieSelectionTurn({ text: "Arabic movies", stage }), null);
assert.equal(await resolveVisibleMovieSelectionTurn({ text: "Unknown title", stage }), null);
assert.equal(await resolveVisibleMovieSelectionTurn({ text: "Ezma", stage: { view: "showtimes", movies } }), null);
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "Minions and Monsters", stage: ampersandStage }))?.id, "minions", "spoken and must select a visible title published with an ampersand");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "Minions & Monsters", stage: ampersandStage }))?.id, "minions", "the published ampersand title must remain selectable");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "I want Minions and Monsters", stage: ampersandStage }))?.id, "minions");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "I choose Minions and Monsters", stage: ampersandStage }))?.id, "minions");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "I'd like Minions and Monsters", stage: ampersandStage }))?.id, "minions");
assert.equal((await resolveVisibleMovieSelectionTurn({ text: "توي ستوري 5", stage: bilingualStage }))?.id, "toy", "an Arabic title reply must select its visible English catalog movie");

const titleFirstResult = await routePendingVisibleMovie({
  result: { shown: "filtered movie list", movies: ampersandStage.movies },
  text: "Minions & Monsters",
  route: async (movie) => ({
    movie,
    result: { showtimes: [{ sessionId: "minions-premier-1020", time: "10:20", exp: "PREMIER" }] },
  }),
});
assert.equal(titleFirstResult?.selectedMovie?.id, "minions", "a resolved title-first request must advance directly from its filtered movie result");
assert.equal(titleFirstResult?.shown, "showtimes", "a resolved title-first request must render its verified showtimes without asking for the title again");

const rapidMovie = {
  ...ampersandStage.movies[0],
  relevantSessions: [
    { sessionId: "minions-kids-2010", time: "20:10", exp: "KIDS", date: "2026-07-23" },
    { sessionId: "minions-premier-2115", time: "21:15", exp: "PREMIER", date: "2026-07-23" },
  ],
};
const rapidMovieSelection = await resolveVisibleMovieSelectionTurn({
  text: "Minions and Monsters",
  stage: { view: "movies", movies: [rapidMovie] },
});
assert.equal(rapidMovieSelection?.id, "minions", "a rapid bare-title reply must advance the single visible ampersand title");
const rapidShowtimeSelection = resolveVisibleShowtimeSelectionTurn({
  text: "8:10 pm",
  stage: { view: "showtimes", movie: rapidMovieSelection, sessions: rapidMovie.relevantSessions },
});
assert.equal(rapidShowtimeSelection?.sessionId, "minions-kids-2010", "the next rapid time reply must resolve against the showtimes produced by the movie choice");

const latestMovieAuthorization = createLocalDeterministicToolAuthorization({
  toolName: "show_showtimes",
  turnSequence: 2,
  journeyId: "rapid-minions",
});
assert.equal(shouldBlockConcurrentDeterministicToolCall({
  activeAuthorization: latestMovieAuthorization,
  presentedAuthorization: null,
  toolName: "show_showtimes",
}), true, "a late showtimes tool call from the prior agent turn must not race the latest local movie selection");
assert.equal(shouldBlockConcurrentDeterministicToolCall({
  activeAuthorization: latestMovieAuthorization,
  presentedAuthorization: latestMovieAuthorization,
  toolName: "show_showtimes",
}), false, "the latest authorized local movie selection must be allowed to load showtimes");
const latestShowtimeAuthorization = createLocalDeterministicToolAuthorization({
  toolName: "show_seat_map",
  turnSequence: 3,
  journeyId: "rapid-minions",
});
assert.equal(shouldBlockConcurrentDeterministicToolCall({
  activeAuthorization: latestShowtimeAuthorization,
  presentedAuthorization: null,
  toolName: "show_seat_map",
}), true, "a late seat-map tool call from the prior agent turn must not race the latest local showtime selection");

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.doesNotMatch(app, /^import .*movieSelectionRouting/m, "the initial App module must not statically import visible movie selection routing");
assert.match(app, /await import\("\.\/lib\/movieSelectionRouting\.js"\)/, "visible movie selection routing must load only when a user turn needs it");
assert.match(app, /await resolveVisibleMovieSelectionTurnLazy\(\s*\{ text: safeMessage, stage: stageRef\.current \},\s*\{ isCurrent: voiceTurnIsCurrent \}/, "voice transcripts must resolve explicit visible movie selection through the guarded lazy route");
assert.match(app, /await resolveVisibleMovieSelectionTurnLazy\(\s*\{ text: value, stage: stageRef\.current \},\s*\{ isCurrent: typedTurnIsCurrent \}/, "typed turns must resolve explicit visible movie selection through the guarded lazy route");
assert.match(app, /const explicitMovieSelectionTurn = discoveryPreferencesRef\.current\.movieTitle \|\| pendingMovieSelectionTurn;[\s\S]*routePendingVisibleMovieLazy\(\{[\s\S]*text: explicitMovieSelectionTurn/, "a resolved title-first discovery request must advance directly to verified showtimes");
assert.ok((app.match(/routeVisibleMovieSelection\(directMovieSelection\)/g) || []).length >= 2, "text and voice must both open verified showtimes deterministically");
assert.match(app, /const pauseRenderingForUnrelatedTurn[\s\S]*directMovieSelection[\s\S]*\|\| directMovieSelection/, "an exact visible-movie choice must stay transactional instead of pausing its movie panel before showtimes load");
assert.ok((app.match(/directMovieSelection,\s*\n\s*directShowtimeSelection,/g) || []).length >= 2, "text and voice must preserve the visible movie stage while their deterministic selection route runs");
assert.match(app, /show_showtimes: async[\s\S]*preserveLatestLocalDeterministicRouteForTool\("show_showtimes", localAuthorization\)[\s\S]*beginAsyncRequest\(\)/, "a prior agent showtimes call must be rejected before it can invalidate the latest local request epoch");
assert.match(app, /show_seat_map: async[\s\S]*preserveLatestLocalDeterministicRouteForTool\("show_seat_map", localAuthorization\)[\s\S]*beginAsyncRequest\(\)/, "a prior agent seat-map call must be rejected before it can invalidate the latest local request epoch");
assert.match(app, /show_showtimes: async \(\{ movieId, movieTitle, date, displayDate, scheduleDate: toolDate \} = \{\}\) => \{\s*const localAuthorization = localDeterministicToolInvocationRef\.current;\s*if \(localAuthorization\?\.toolName === "show_showtimes"\) localDeterministicToolInvocationRef\.current = null;/, "the showtimes handler must preserve its public contract while synchronously consuming only the local invocation handoff");
assert.match(app, /show_seat_map: async \(\{ movieTitle, sessionId, showtime, ticketQuantity: requestedQuantity, date, displayDate, scheduleDate: toolDate \} = \{\}\) => \{\s*const localAuthorization = localDeterministicToolInvocationRef\.current;\s*if \(localAuthorization\?\.toolName === "show_seat_map"\) localDeterministicToolInvocationRef\.current = null;/, "the seat-map handler must preserve its public contract while synchronously consuming only the local invocation handoff");
assert.match(app, /const routeVisibleMovieSelection = async[\s\S]*createLocalDeterministicToolAuthorization[\s\S]*localDeterministicToolInvocationRef\.current = authorization;[\s\S]*routePromise = clientTools\.show_showtimes\(\{ movieId: movie\.id, movieTitle: movie\.title \}\);[\s\S]*rawResult = await routePromise;[\s\S]*localDeterministicToolAuthorizationRef\.current === authorization/, "text and voice movie choices must synchronously hand off exactly one local showtimes invocation and clear its active lock safely");
assert.match(app, /const routeVisibleShowtimeSelection = async[\s\S]*createLocalDeterministicToolAuthorization[\s\S]*localDeterministicToolInvocationRef\.current = authorization;[\s\S]*routePromise = clientTools\.show_seat_map\([\s\S]*rawResult = await routePromise;[\s\S]*localDeterministicToolAuthorizationRef\.current === authorization/, "text and voice showtime choices must synchronously hand off exactly one local seat-map invocation and clear its active lock safely");

console.log("Validated deterministic English and Arabic visible-movie selection for text and voice.");
