#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, uaeToday, validate as validateExtraction } from "./extractVoxShowtimes.mjs";

const HOUR_MS = 60 * 60 * 1000;

export function validateShowtimeRefresh(data, { previous = null, now = new Date() } = {}) {
  validateExtraction(data);
  const tomorrow = addDays(uaeToday(now), 1);
  const extractedAt = new Date(data.extractedAt);
  assert.ok(Number.isFinite(extractedAt.valueOf()), "extractedAt must be a valid timestamp");
  const ageHours = (now.valueOf() - extractedAt.valueOf()) / HOUR_MS;
  assert.ok(ageHours >= -0.25 && ageHours <= 30, `extraction must be less than 30 hours old; age is ${ageHours.toFixed(1)} hours`);
  assert.equal(data.crawl?.startDate, tomorrow, `crawl must start tomorrow in UAE (${tomorrow})`);
  assert.ok(data.programmingDates.includes(tomorrow), `tomorrow ${tomorrow} must contain published sessions`);
  assert.equal(data.crawl?.lastAvailableDate, data.programmingDates.at(-1), "lastAvailableDate must match the latest extracted programming date");
  assert.deepEqual(data.crawl?.discoveredProgrammingDates, [...data.crawl.discoveredProgrammingDates].sort(), "discovered programming dates must be sorted");
  assert.ok(data.crawl?.complete === true, "crawl must be marked complete");
  assert.ok(Number(data.crawl?.requestedSessionCalls) > 0, "crawl must record successful session requests");
  assert.equal(data.sessions.length + Number(data.crawl?.duplicateCount || 0), Number(data.crawl?.rawSessionCount), "raw and deduplicated session counts must reconcile");
  assert.ok(Object.keys(data.cinemas).length >= 20, "refresh must retain the nationwide cinema catalogue");
  assert.ok(data.sessions.length >= 500, "refresh session count is implausibly small");

  const catalogCodes = new Set(data.catalog.map((movie) => movie.code));
  const keys = new Set();
  let tomorrowSessions = 0;
  let afterMidnightSessions = 0;
  for (const session of data.sessions) {
    assert.ok(catalogCodes.has(session.code), `session movie ${session.code} is missing from the catalog`);
    assert.ok(data.cinemas[session.cinemaCode], `session cinema ${session.cinemaCode} is missing from the cinema map`);
    assert.ok(session.sessionId && session.experience && session.time, "session identifiers, experience and time are required");
    assert.equal(session.date, String(session.showtime).slice(0, 10), "performance date must match the official showtime");
    assert.equal(session.time, String(session.showtime).slice(11, 16), "display time must preserve the official wall clock");
    assert.ok(session.programmingDate <= session.date, "programming date cannot follow the performance date");
    const key = [session.code, session.cinemaCode, session.sessionId, session.showtime].join("\u001f");
    assert.ok(!keys.has(key), `duplicate official session key: ${key}`);
    keys.add(key);
    if (session.programmingDate === tomorrow) tomorrowSessions += 1;
    if (session.programmingDate !== session.date) afterMidnightSessions += 1;
  }
  assert.ok(tomorrowSessions > 0, `tomorrow ${tomorrow} must have sessions`);
  assert.ok(afterMidnightSessions >= 0, "after-midnight programming-date accounting must remain valid");

  for (const movie of data.catalog) {
    assert.ok(/^https:\/\//.test(movie.posterUrl || ""), `movie ${movie.code} is missing an official HTTPS poster`);
  }
  for (const item of [...(data.experienceMedia || []), ...(data.offerMedia || [])]) {
    for (const value of [item.imageUrl, item.backdropUrl, item.heroUrl, item.promoUrl, item.mobileUrl].filter(Boolean)) {
      assert.ok(/^https:\/\//.test(value), `media URL must use HTTPS: ${value}`);
    }
  }

  if (previous?.sessions?.length) {
    const minimumSessions = Math.floor(previous.sessions.length * 0.6);
    const minimumFilms = Math.floor((previous.catalog?.length || 0) * 0.6);
    const minimumCinemas = Math.floor(Object.keys(previous.cinemas || {}).length * 0.85);
    assert.ok(data.sessions.length >= minimumSessions, `session count dropped more than 40% (${previous.sessions.length} to ${data.sessions.length})`);
    assert.ok(data.catalog.length >= minimumFilms, `scheduled-film count dropped more than 40% (${previous.catalog.length} to ${data.catalog.length})`);
    assert.ok(Object.keys(data.cinemas).length >= minimumCinemas, "cinema coverage dropped unexpectedly");
  }

  return {
    tomorrow,
    tomorrowSessions,
    firstDate: data.programmingDates[0],
    lastDate: data.programmingDates.at(-1),
    cinemas: Object.keys(data.cinemas).length,
    films: data.catalog.length,
    sessions: data.sessions.length,
    ageHours,
  };
}

async function main() {
  const inputPath = resolve(process.argv[2] || "data/vox_showtimes_full.json");
  const previousPath = process.argv[3] ? resolve(process.argv[3]) : null;
  const data = JSON.parse(await readFile(inputPath, "utf8"));
  const previous = previousPath && existsSync(previousPath) ? JSON.parse(await readFile(previousPath, "utf8")) : null;
  const now = process.env.VOX_REFRESH_NOW ? new Date(process.env.VOX_REFRESH_NOW) : new Date();
  const result = validateShowtimeRefresh(data, { previous, now });
  console.log(`Validated fresh VOX UAE schedule: ${result.sessions} sessions, ${result.films} films, ${result.cinemas} cinemas, ${result.firstDate}..${result.lastDate}; tomorrow ${result.tomorrow} has ${result.tomorrowSessions} sessions.`);
}

if (resolve(process.argv[1] || "") === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`FATAL: ${error.message}`);
    process.exitCode = 1;
  });
}
