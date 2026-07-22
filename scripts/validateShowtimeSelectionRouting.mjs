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

const spokenLateHourStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "late-ten", time: "22:00", exp: "PREMIER" },
    { sessionId: "late-eleven", time: "23:00", exp: "THEATRE" },
    { sessionId: "late-nine", time: "21:20", exp: "IMAX" },
  ],
};

const englishHourWords = [
  ["one", 13],
  ["two", 14],
  ["three", 15],
  ["four", 16],
  ["five", 17],
  ["six", 18],
  ["seven", 19],
  ["eight", 20],
  ["nine", 21],
  ["ten", 22],
  ["eleven", 23],
  ["twelve", 12],
];
for (const [word, hour] of englishHourWords) {
  const sessionId = `word-${word}`;
  const wordStage = {
    view: "showtimes",
    sessions: [{ sessionId, time: `${String(hour).padStart(2, "0")}:25`, exp: "PREMIER" }],
  };
  assert.equal(
    resolveVisibleShowtimeSelectionTurn({ text: word, stage: wordStage })?.sessionId,
    sessionId,
    `${word}: a bare English number-word hour must ground against the only visible 24-hour session`,
  );
  assert.equal(
    resolveVisibleShowtimeSelectionTurn({ text: `${word} PM`, stage: wordStage })?.sessionId,
    sessionId,
    `${word} PM: an English number-word hour with meridiem must ground against the visible 24-hour session`,
  );
}
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "ten", stage: spokenLateHourStage })?.sessionId, "late-ten");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "eleven", stage: spokenLateHourStage })?.sessionId, "late-eleven");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "eleven PM", stage: spokenLateHourStage })?.sessionId, "late-eleven");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "the eleven one", stage: spokenLateHourStage })?.sessionId, "late-eleven");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "nine PM", stage: spokenLateHourStage })?.sessionId, "late-nine");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "eleven p m", stage: spokenLateHourStage })?.sessionId, "late-eleven");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "eleven pee em", stage: spokenLateHourStage })?.sessionId, "late-eleven");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "nine p.m.", stage: spokenLateHourStage })?.sessionId, "late-nine");
assert.equal(
  resolveVisibleShowtimeSelectionTurn({
    text: "eleven ay em",
    stage: { view: "showtimes", sessions: [{ sessionId: "morning-eleven", time: "11:10", exp: "PREMIER" }] },
  })?.sessionId,
  "morning-eleven",
);
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "22:00", stage: spokenLateHourStage })?.sessionId, "late-ten");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "23:00", stage: spokenLateHourStage })?.sessionId, "late-eleven");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "ten at night", stage: spokenLateHourStage })?.sessionId, "late-ten");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "الساعة ١٠ مساء", stage: spokenLateHourStage })?.sessionId, "late-ten");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "الساعة عشرة مساء", stage: spokenLateHourStage })?.sessionId, "late-ten");

const afterMidnightStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "midnight", time: "00:00", exp: "PREMIER" },
    { sessionId: "one-at-night", time: "01:20", exp: "THEATRE" },
    { sessionId: "five-at-night", time: "05:15", exp: "IMAX" },
  ],
};
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "twelve at night", stage: afterMidnightStage })?.sessionId, "midnight");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "one at night", stage: afterMidnightStage })?.sessionId, "one-at-night");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "five at night", stage: afterMidnightStage })?.sessionId, "five-at-night");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "الساعة اثنا عشر ليلا", stage: afterMidnightStage })?.sessionId, "midnight");
assert.equal(resolveVisibleShowtimeSelectionTurn({ text: "الساعة واحدة ليلا", stage: afterMidnightStage })?.sessionId, "one-at-night");

const spokenHourAmbiguityStage = {
  view: "showtimes",
  sessions: [
    { sessionId: "morning-eleven", time: "11:00", exp: "PREMIER" },
    { sessionId: "late-ten-imax", time: "22:00", exp: "IMAX" },
    { sessionId: "late-ten-theatre", time: "22:00", exp: "THEATRE" },
    { sessionId: "late-eleven-imax", time: "23:00", exp: "IMAX" },
    { sessionId: "late-eleven-theatre", time: "23:00", exp: "THEATRE" },
  ],
};
assert.equal(
  resolveVisibleShowtimeSelectionTurn({ text: "eleven", stage: spokenHourAmbiguityStage }),
  null,
  "a word-form hour must preserve AM, PM, and experience ambiguity",
);
assert.deepEqual(
  visibleShowtimeSelectionCandidates({ text: "the eleven one", stage: spokenHourAmbiguityStage }).map((session) => session.sessionId),
  ["morning-eleven", "late-eleven-imax", "late-eleven-theatre"],
  "a conversational word-form choice must expose every matching visible candidate",
);
assert.equal(
  resolveVisibleShowtimeSelectionTurn({ text: "eleven PM", stage: spokenHourAmbiguityStage }),
  null,
  "an explicit PM hour must remain unresolved when multiple experiences share the visible time",
);
assert.deepEqual(
  visibleShowtimeSelectionCandidates({ text: "22:00", stage: spokenHourAmbiguityStage }).map((session) => session.sessionId),
  ["late-ten-imax", "late-ten-theatre"],
  "an explicit 22:00 choice must preserve visible experience ambiguity",
);
assert.equal(
  resolveVisibleShowtimeSelectionTurn({ text: "22:00", stage: spokenHourAmbiguityStage }),
  null,
  "an explicit 22:00 choice must not guess between visible experiences",
);
assert.deepEqual(
  visibleShowtimeSelectionCandidates({ text: "23:00", stage: spokenHourAmbiguityStage }).map((session) => session.sessionId),
  ["late-eleven-imax", "late-eleven-theatre"],
  "an explicit 24-hour time must stay grounded in every visible matching experience",
);
assert.deepEqual(
  visibleShowtimeSelectionCandidates({ text: "What is at eleven?", stage: spokenHourAmbiguityStage }),
  [],
  "a word-form information question must not select a showtime",
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
