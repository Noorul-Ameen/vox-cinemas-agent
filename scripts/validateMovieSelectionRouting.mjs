import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveVisibleMovieSelectionTurn } from "../src/lib/movieSelectionRouting.js";

const movies = [
  { id: "ezma", title: "Ezma" },
  { id: "supergirl", title: "Supergirl" },
];
const stage = { view: "movies", movies };

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

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(app, /resolveVisibleMovieSelectionTurn\(\{ text: safeMessage, stage: stageRef\.current \}\)/, "voice transcripts must resolve explicit visible movie selection");
assert.match(app, /resolveVisibleMovieSelectionTurn\(\{ text: value, stage: stageRef\.current \}\)/, "typed turns must resolve explicit visible movie selection");
assert.ok((app.match(/routeVisibleMovieSelection\(directMovieSelection\)/g) || []).length >= 2, "text and voice must both open verified showtimes deterministically");
assert.match(app, /const pauseRenderingForUnrelatedTurn[\s\S]*directMovieSelection[\s\S]*\|\| directMovieSelection/, "an exact visible-movie choice must stay transactional instead of pausing its movie panel before showtimes load");
assert.ok((app.match(/directMovieSelection,\s*\n\s*directShowtimeSelection,/g) || []).length >= 2, "text and voice must preserve the visible movie stage while their deterministic selection route runs");

console.log("Validated deterministic English and Arabic visible-movie selection for text and voice.");
