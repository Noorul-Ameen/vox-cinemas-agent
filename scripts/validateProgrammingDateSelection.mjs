import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveProgrammingDateSelection } from "../src/lib/programmingDateSelection.js";

const published = ["2026-07-14", "2026-07-15"];

assert.deepEqual(
  resolveProgrammingDateSelection({
    availableDates: published,
    userRequestedDate: "2026-07-13",
    toolRequestedDate: "2026-07-14",
    selectedDate: "2026-07-14",
  }),
  {
    date: null,
    unavailableDate: "2026-07-13",
    source: "user",
    blocked: true,
  },
  "an unavailable guest request must outrank an agent-proposed fallback date",
);

assert.deepEqual(
  resolveProgrammingDateSelection({
    availableDates: ["2026-07-13", ...published],
    userRequestedDate: "2026-07-13",
    toolRequestedDate: "2026-07-14",
    selectedDate: "2026-07-14",
  }),
  {
    date: "2026-07-13",
    unavailableDate: null,
    source: "user",
    blocked: false,
  },
  "the retained guest date must be used when a newly selected cinema publishes it",
);

assert.deepEqual(
  resolveProgrammingDateSelection({
    availableDates: published,
    toolRequestedDate: "2026-07-13",
    selectedDate: "2026-07-14",
  }),
  {
    date: null,
    unavailableDate: "2026-07-13",
    source: "tool",
    blocked: true,
  },
  "an explicitly requested unpublished tool date must not fall back to the selected date",
);

assert.equal(
  resolveProgrammingDateSelection({ availableDates: published, selectedDate: "2026-07-14" }).date,
  "2026-07-14",
  "a normal date-less browse may retain the selected published date",
);

assert.equal(
  resolveProgrammingDateSelection({ availableDates: published }).date,
  "2026-07-14",
  "a normal date-less browse may use the first published date when no date was selected",
);

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(app, /const userRequestedDateRef = useRef\(null\)/, "the widget must retain an unresolved guest date across client-tool calls");
assert.equal(
  (app.match(/resolveClientToolProgrammingDate\(/g) || []).length,
  3,
  "all three date-sensitive client tools must use the guarded date resolver",
);
assert.equal(
  (app.match(/captureUserProgrammingDate\(/g) || []).length,
  2,
  "typed and voice-transcribed guest messages must capture the same explicit date constraint",
);
const cinemaSelection = app.slice(app.indexOf("const chooseCinema"), app.indexOf("const chooseDate"));
assert.match(cinemaSelection, /if \(dateDecision\.blocked\)/, "tapping a cinema must retain an unresolved guest date");
assert.match(cinemaSelection, /showUnavailableProgrammingDate\(dateDecision\.unavailableDate\)/, "tapping a cinema must not render fallback-date movies when the guest date is unavailable");
const unavailablePresentation = app.slice(app.indexOf("const showUnavailableProgrammingDate"), app.indexOf("const resolveClientToolProgrammingDate"));
assert.match(unavailablePresentation, /view:\s*"movies",\s*movies:\s*\[\],\s*error:/, "an unavailable date must replace stale movie or showtime results with an explicit empty state");
assert.match(unavailablePresentation, /errorCode:\s*"date_unavailable"/, "the date-unavailable state must remain distinguishable from a provider loading error");
const showShowtimesTool = app.slice(app.indexOf("show_showtimes:"), app.indexOf("show_seat_map:"));
assert.match(showShowtimesTool, /const requestedDateText = toolDate \|\| displayDate \|\| date;/, "show_showtimes must derive its optional date only from declared date fields");
assert.match(showShowtimesTool, /resolveClientToolProgrammingDate\(requestedDateText, availableDates\)/, "show_showtimes must pass only the explicit date constraint to the resolver");
assert.doesNotMatch(showShowtimesTool, /resolveClientToolProgrammingDate\([^\n]*movieTitle/, "a movie title must never be interpreted as a programming date");
const typedMessageFlow = app.slice(app.indexOf("const sendText"), app.indexOf("const sendUiTurn"));
assert.match(typedMessageFlow, /if \(unavailableDate\) \{[\s\S]*sendContextualUpdate[\s\S]*return;/, "a deterministic unavailable typed request must stop before an agent can claim fallback movies were shown");

console.log("Validated explicit programming-date precedence and no-substitution behavior.");
