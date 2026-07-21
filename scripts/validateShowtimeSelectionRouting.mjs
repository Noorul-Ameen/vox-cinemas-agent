import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveVisibleShowtimeSelectionTurn } from "../src/lib/showtimeSelectionRouting.js";

const sessions = [
  { sessionId: "s1", time: "15:35", exp: "PREMIER" },
  { sessionId: "s2", time: "17:55", exp: "PREMIER" },
  { sessionId: "s3", time: "20:00", exp: "IMAX" },
  { sessionId: "s4", time: "20:00", exp: "THEATRE" },
];
const stage = { view: "showtimes", sessions };

assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "5:55 PM", stage })?.sessionId, "s2");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "I want the 5:55 PM show", stage })?.sessionId, "s2");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "أريد عرض الساعة 5:55 مساء", stage })?.sessionId, "s2");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "8 PM IMAX", stage })?.sessionId, "s3");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "8 PM", stage }), null, "same-time experiences must remain ambiguous");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "What is at 5:55 PM?", stage }), null, "a time question must not select a session");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "5:55 PM", stage: { view: "movies", sessions } }), null);

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(app, /resolveVisibleShowtimeSelectionTurn\(\{ text: safeMessage, stage: stageRef\.current \}\)/, "voice transcripts must resolve a visible showtime choice");
assert.match(app, /resolveVisibleShowtimeSelectionTurn\(\{ text: value, stage: stageRef\.current \}\)/, "typed turns must resolve a visible showtime choice");
assert.ok((app.match(/routeVisibleShowtimeSelection\(directShowtimeSelection\)/g) || []).length >= 2, "text and voice must both open the seat map deterministically");
assert.match(app, /const pauseRenderingForUnrelatedTurn[\s\S]*directShowtimeSelection[\s\S]*\|\| directShowtimeSelection/, "a visible showtime choice must remain transactional while the seat map loads");

console.log("Validated deterministic English and Arabic visible-showtime selection for text and voice.");
