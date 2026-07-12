import assert from "node:assert/strict";
import { CINEMAS, DATA_DATES, DATA_STATS, FILMS, SESSIONS } from "../src/mockVistaData.js";
import { resolveFilmCandidate } from "../src/lib/fuzzyResolvers.js";
import { remapDemoDate, uaeCalendarDate } from "../src/lib/demoDates.js";

assert.equal(DATA_STATS.rawSessionCount, 6501);
assert.equal(DATA_STATS.duplicateCount, 1);
assert.equal(SESSIONS.length, 6500);
assert.equal(CINEMAS.length, 22);
assert.equal(new Set(FILMS.map((film) => film.ScheduledFilmId)).size, 41);
assert.equal(DATA_DATES.length, 8);
assert.equal(DATA_STATS.experiences.length, 13);
assert.ok(FILMS.every((film) => film.Rating && film.Genres?.length && film.Synopsis), "all movie metadata must be complete");
assert.ok(FILMS.every((film) => film.LanguageName), "all movie language names must be explicit");
assert.ok(FILMS.every((film) => Array.isArray(film.Subtitles)), "subtitle metadata must retain its source shape");
assert.ok(FILMS.every((film) => film.Synopsis.length >= 80), "synopses must not be listing-card fragments");
assert.ok(FILMS.every((film) => /[.!?…][”"']?$/.test(film.Synopsis)), "synopses must not end mid-sentence");

const keys = SESSIONS.map((session) => [
  session.Showtime.slice(0, 10),
  session.ScheduledFilmId,
  session.CinemaId,
  session.SessionAttributesNames[0],
  session.Showtime.slice(11, 16),
].join("|"));
assert.equal(new Set(keys).size, SESSIONS.length, "session keys must be deduplicated");
assert.equal(SESSIONS.filter((session) => session.SourceProgrammingDate === "2026-07-15").length, DATA_STATS.sessionsByDate["2026-07-15"], "late-night sessions remain attached to their programming day");
assert.equal(Object.values(DATA_STATS.sessionsByDate).reduce((sum, count) => sum + count, 0), 6500, "all sessions are reachable through the eight programming dates");

const sampleFilms = [{ id: "HO-MINIONS", title: "Minions & Monsters" }, { id: "HO-OTHER", title: "The Accountant" }];
assert.equal(resolveFilmCandidate(sampleFilms, "the minions one")?.id, "HO-MINIONS", "filler words must not break title resolution");
assert.equal(resolveFilmCandidate(sampleFilms, "HO-MINIONS")?.title, "Minions & Monsters", "exact film IDs remain authoritative");
assert.equal(uaeCalendarDate(new Date("2026-07-11T21:30:00.000Z")), "2026-07-12", "Dubai date must not use UTC midnight");
assert.equal(remapDemoDate("2026-07-12", "2026-07-12", DATA_DATES), "2026-07-12", "covered dates remain exact");
assert.equal(remapDemoDate("2026-07-20", "2026-07-20", DATA_DATES), "2026-07-08", "outside dates roll onto the extraction window");

console.log("Validated 22 cinemas, 41 films, 6,500 sessions, eight dates, and complete movie metadata.");
