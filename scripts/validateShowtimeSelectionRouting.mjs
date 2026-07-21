import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveVisibleShowtimeSelectionTurn, visibleShowtimeSelectionCandidates } from "../src/lib/showtimeSelectionRouting.js";

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

const uniqueHourStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "morning-930", time: "09:30", exp: "PREMIER" },
    { sessionId: "morning-1130", time: "11:30", exp: "THEATRE" },
  ],
};
assert.equal(
  resolveVisibleShowtimeSelectionTurn({ text: "9", stage: uniqueHourStage })?.sessionId,
  "morning-930",
  "a bare hour must select the only visible showtime within that hour",
);

const ambiguousHourStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "morning-915", time: "09:15", exp: "PREMIER" },
    { sessionId: "morning-930", time: "09:30", exp: "THEATRE" },
  ],
};
assert.equal(
  resolveVisibleShowtimeSelectionTurn({ text: "9", stage: ambiguousHourStage }),
  null,
  "a bare hour with multiple visible showtimes in that hour must remain unresolved",
);
assert.deepEqual(
  visibleShowtimeSelectionCandidates({ text: "9", stage: ambiguousHourStage }).map((session) => session.sessionId),
  ["morning-915", "morning-930"],
  "an ambiguous bare hour must expose only the matching visible candidates for clarification",
);
assert.deepEqual(
  visibleShowtimeSelectionCandidates({ text: "What is at 9?", stage: ambiguousHourStage }),
  [],
  "a question about a time must not be converted into showtime candidates",
);

for (const informationTurn of ["ما الساعة 9", "ماذا يعرض الساعة 9", "هل يوجد عرض الساعة 9"]) {
  assert.deepEqual(
    visibleShowtimeSelectionCandidates({ text: informationTurn, stage: uniqueHourStage }),
    [],
    `${informationTurn}: an Arabic information question without punctuation must not select a visible showtime`,
  );
}

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(app, /resolveVisibleShowtimeSelectionTurn\(\{ text: safeMessage, stage: stageRef\.current \}\)/, "voice transcripts must resolve a visible showtime choice");
assert.match(app, /resolveVisibleShowtimeSelectionTurn\(\{ text: value, stage: stageRef\.current \}\)/, "typed turns must resolve a visible showtime choice");
assert.ok((app.match(/routeVisibleShowtimeSelection\(directShowtimeSelection\)/g) || []).length >= 2, "text and voice must both open the seat map deterministically");
assert.match(app, /const pauseRenderingForUnrelatedTurn[\s\S]*directShowtimeSelection[\s\S]*\|\| directShowtimeSelection/, "a visible showtime choice must remain transactional while the seat map loads");
assert.ok((app.match(/ambiguousShowtimeCandidates\.length > 1/g) || []).length >= 2, "text and voice must identify an ambiguous visible hour without leaving the showtime view");
assert.ok((app.match(/Ask only which exact time and experience they want/g) || []).length >= 2, "text and voice must ask a grounded clarification for ambiguous visible showtimes");

console.log("Validated deterministic English and Arabic visible-showtime selection for text and voice.");
