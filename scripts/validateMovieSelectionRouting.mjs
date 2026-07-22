import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalDeterministicToolAuthorization, shouldBlockConcurrentDeterministicToolCall } from "../src/lib/deterministicToolRouting.js";
import { resolveVisibleMovieSelectionTurn } from "../src/lib/movieSelectionRouting.js";
import { resolveVisibleShowtimeSelectionTurn } from "../src/lib/showtimeSelectionRouting.js";

const movies = [
  { id: "ezma", title: "Ezma" },
  { id: "supergirl", title: "Supergirl" },
];
const stage = { view: "movies", movies };
const ampersandStage = { view: "movies", movies: [{ id: "minions", title: "Minions & Monsters" }] };

assert.equal(resolveVisibleMovieSelectionTurn({ text: "Ezma", stage })?.id, "ezma");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "I choose Ezma", stage })?.id, "ezma");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "اخترت Ezma", stage })?.id, "ezma");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "أريد Ezma", stage })?.id, "ezma");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "the chosen movies", stage }), null);
assert.equal(resolveVisibleMovieSelectionTurn({ text: "Tell me about Ezma", stage }), null);
assert.equal(resolveVisibleMovieSelectionTurn({ text: "I want details about Ezma", stage }), null);
assert.equal(resolveVisibleMovieSelectionTurn({ text: "Arabic movies", stage }), null);
assert.equal(resolveVisibleMovieSelectionTurn({ text: "Unknown title", stage }), null);
assert.equal(resolveVisibleMovieSelectionTurn({ text: "Ezma", stage: { view: "showtimes", movies } }), null);
assert.equal(resolveVisibleMovieSelectionTurn({ text: "Minions and Monsters", stage: ampersandStage })?.id, "minions", "spoken and must select a visible title published with an ampersand");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "Minions & Monsters", stage: ampersandStage })?.id, "minions", "the published ampersand title must remain selectable");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "I want Minions and Monsters", stage: ampersandStage })?.id, "minions");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "I choose Minions and Monsters", stage: ampersandStage })?.id, "minions");
assert.equal(resolveVisibleMovieSelectionTurn({ text: "I'd like Minions and Monsters", stage: ampersandStage })?.id, "minions");

const rapidMovie = {
  ...ampersandStage.movies[0],
  relevantSessions: [
    { sessionId: "minions-kids-2010", time: "20:10", exp: "KIDS", date: "2026-07-23" },
    { sessionId: "minions-premier-2115", time: "21:15", exp: "PREMIER", date: "2026-07-23" },
  ],
};
const rapidMovieSelection = resolveVisibleMovieSelectionTurn({
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
assert.match(app, /resolveVisibleMovieSelectionTurn\(\{ text: safeMessage, stage: stageRef\.current \}\)/, "voice transcripts must resolve explicit visible movie selection");
assert.match(app, /resolveVisibleMovieSelectionTurn\(\{ text: value, stage: stageRef\.current \}\)/, "typed turns must resolve explicit visible movie selection");
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
