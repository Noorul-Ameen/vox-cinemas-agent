import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveFilmCandidate } from "../src/lib/fuzzyResolvers.js";
import { resolveProgrammingDateSelection, resolveVisibleSelectionProgrammingDate } from "../src/lib/programmingDateSelection.js";
import * as vista from "../src/vistaClient.js";

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

assert.deepEqual(
  resolveVisibleSelectionProgrammingDate({
    availableDates: ["2026-07-15", "2026-07-16"],
    toolRequestedDate: "2026-07-16",
    selectedDate: "2026-07-15",
    visibleDate: "2026-07-15",
    hasVisibleSelection: true,
  }),
  { date: "2026-07-15", unavailableDate: null, source: "visible", blocked: false },
  "an agent date must not move a movie away from the visible tomorrow list before resolving it",
);

assert.equal(
  resolveVisibleSelectionProgrammingDate({
    availableDates: ["2026-07-15", "2026-07-16"],
    userRequestedDate: "2026-07-16",
    toolRequestedDate: "2026-07-15",
    selectedDate: "2026-07-15",
    visibleDate: "2026-07-15",
    hasVisibleSelection: true,
  }).date,
  "2026-07-16",
  "a fresh explicit guest date must remain stronger than the old visible list",
);

const deiraTomorrowMovies = await vista.getScheduledFilms("0001", "2026-07-15");
const visibleToyStory = resolveFilmCandidate(deiraTomorrowMovies, "Toy Story 5");
assert.equal(visibleToyStory?.id, "HO00015756", "Toy Story 5 must resolve from the displayed City Centre Deira tomorrow list");
const toyStorySessions = await vista.getSessions("0001", visibleToyStory.id, "2026-07-15");
assert.deepEqual(toyStorySessions.map((session) => session.time), ["12:00", "14:10", "16:15", "18:30"], "the displayed Toy Story 5 fixture must retain its real tomorrow sessions");

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(app, /const userRequestedDateRef = useRef\(null\)/, "the widget must retain an unresolved guest date across client-tool calls");
assert.equal((app.match(/resolveClientToolProgrammingDate\(/g) || []).length, 1, "movie-list loading must use the guarded general date resolver");
assert.equal((app.match(/resolveVisibleSelectionProgrammingDate\(/g) || []).length, 2, "movie and session selection must bind to their visible list date");
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
assert.match(showShowtimesTool, /const visibleMovie = resolveFilm\(movieId\) \|\| resolveFilm\(movieTitle\)/, "show_showtimes must resolve the requested title from the visible list before loading another date");
assert.match(showShowtimesTool, /resolveVisibleSelectionProgrammingDate\(\{[\s\S]*visibleDate:\s*filmsDateRef\.current[\s\S]*hasVisibleSelection/, "show_showtimes must retain the displayed movie list date");
assert.ok(showShowtimesTool.indexOf("const visibleMovie") < showShowtimesTool.indexOf("await ensureFilms"), "visible title resolution must happen before any film-list reload");
const typedMessageFlow = app.slice(app.indexOf("const sendText"), app.indexOf("const sendUiTurn"));
assert.match(typedMessageFlow, /if \(unavailableDate\) \{[\s\S]*sendContextualUpdate[\s\S]*return;/, "a deterministic unavailable typed request must stop before an agent can claim fallback movies were shown");

console.log("Validated explicit programming-date precedence and no-substitution behavior.");
