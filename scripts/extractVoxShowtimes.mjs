#!/usr/bin/env node
/** Extract the complete eight-day VOX UAE schedule using only Node 18+ built-ins. */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = "https://uae-apife.voxcinemas.com/v1/vox2-0";
const REGION = "UAE";
const WORKERS = 3;
const STAGGER_MS = 120;
const RETRIES = 2;
const BACKOFF_MS = 1200;
const TIMEOUT_MS = 20000;
const HEADERS = {
  accept: "application/json",
  origin: "https://uae.voxcinemas.com",
  referer: "https://uae.voxcinemas.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};
const LANGUAGE_NAMES = { ENG: "English", ARA: "Arabic", HIN: "Hindi", MAL: "Malayalam", TAM: "Tamil", TEL: "Telugu", TUR: "Turkish", KOR: "Korean" };

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const text = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return String(value.title ?? value.name ?? value.label ?? value.code ?? "").trim();
  return String(value).trim();
};
const list = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : []);

function parseArgs(argv) {
  const args = { startDate: null, output: "data/vox_showtimes_full.json" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--start-date" || flag === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${flag} requires a value`);
      args[flag === "--start-date" ? "startDate" : "output"] = value;
      index += 1;
    } else if (flag === "--help") {
      console.log("node scripts/extractVoxShowtimes.mjs [--start-date YYYY-MM-DD] [--output FILE]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

function uaeToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value, count) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

async function fetchJson(url, label) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
      if (!response.ok) throw Object.assign(new Error(`${label}: HTTP ${response.status}`), { status: response.status });
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error?.status === 503) throw new Error(`${label}: HTTP 503. VOX commonly blocks datacenter IPs; run from a residential/office network or an approved browser context.`);
      if (attempt < RETRIES) await sleep(BACKOFF_MS);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${label} failed after ${RETRIES + 1} attempts: ${lastError?.message}`);
}

async function getCatalog() {
  const payload = await fetchJson(`${BASE}/content/movies?region=${REGION}`, "movie catalog");
  const source = Array.isArray(payload) ? payload : payload?.movies || [];
  const byCode = new Map();
  for (const movie of source) {
    if (movie?.isActive !== true || movie?.isComingSoon !== false) continue;
    const code = text(movie.hoCode);
    if (!code || byCode.has(code)) continue;
    const language = text(movie.language);
    byCode.set(code, {
      code,
      title: text(movie.title),
      rating: text(movie.rating),
      language,
      languageName: text(movie.languageName) || LANGUAGE_NAMES[language] || language,
      runtime: Number(movie.runtime ?? movie.runTime) || 0,
      genres: list(movie.genres),
      synopsis: text(movie.description),
      subtitles: list(movie.subtitles),
      released: text(movie.releaseDate),
      sourceUrl: `${BASE}/content/movies?region=${REGION}`,
    });
  }
  return [...byCode.values()].sort((a, b) => a.title.localeCompare(b.title));
}

async function crawl(catalog, programmingDates) {
  const jobs = catalog.flatMap((movie) => programmingDates.map((programmingDate) => ({ code: movie.code, programmingDate })));
  const results = new Array(jobs.length);
  let cursor = 0;
  const failures = [];

  async function worker(workerIndex) {
    if (workerIndex) await sleep(workerIndex * STAGGER_MS);
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      try {
        results[index] = { ...job, payload: await fetchJson(`${BASE}/groups/api/Sessions/${REGION}/${encodeURIComponent(job.code)}/${job.programmingDate}`, `${job.code}/${job.programmingDate}`) };
      } catch (error) {
        failures.push({ ...job, error: error.message });
      }
      await sleep(STAGGER_MS);
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, (_, index) => worker(index)));
  if (failures.length) throw new Error(`${failures.length} session calls failed; first: ${failures[0].error}`);
  return results;
}

function flatten(responses) {
  const cinemas = new Map();
  const sessions = new Map();
  let duplicates = 0;
  for (const { code, programmingDate, payload } of responses) {
    for (const cinema of Array.isArray(payload?.cinemas) ? payload.cinemas : []) {
      const cinemaCode = text(cinema.cinemaCode);
      if (!cinemaCode) continue;
      cinemas.set(cinemaCode, text(cinema.cinemaName));
      for (const group of Array.isArray(cinema.sessionGroups) ? cinema.sessionGroups : []) {
        const experience = text(group.experience);
        for (const session of Array.isArray(group.sessions) ? group.sessions : []) {
          const showtime = text(session.showtime);
          const date = showtime.slice(0, 10);
          const time = showtime.slice(11, 16);
          const key = [date, code, cinemaCode, experience, time].join("\u001f");
          if (sessions.has(key)) { duplicates += 1; continue; }
          sessions.set(key, { programmingDate, date, code, cinemaCode, experience, time, timeSlot: text(session.filter), status: text(session.status) });
        }
      }
    }
  }
  return {
    cinemas: Object.fromEntries([...cinemas].sort(([left], [right]) => left.localeCompare(right))),
    sessions: [...sessions.values()].sort((a, b) => a.programmingDate.localeCompare(b.programmingDate) || a.cinemaCode.localeCompare(b.cinemaCode) || a.code.localeCompare(b.code) || a.time.localeCompare(b.time)),
    duplicates,
  };
}

function validate(data) {
  const errors = [];
  if (data.catalog.length < 35 || data.catalog.length > 50) errors.push(`unexpected catalog size ${data.catalog.length}`);
  if (Object.keys(data.cinemas).length !== 22) errors.push(`expected 22 cinemas, got ${Object.keys(data.cinemas).length}`);
  if (new Set(data.sessions.map((session) => session.programmingDate)).size !== 8) errors.push("expected eight programming dates");
  if (data.sessions.length < 5000) errors.push(`implausibly low session count ${data.sessions.length}`);
  if (data.catalog.some((movie) => !movie.code || !movie.title || !movie.rating || !movie.genres.length || !movie.synopsis || !movie.languageName || !Array.isArray(movie.subtitles))) errors.push("catalog metadata is incomplete");
  const firstDate = data.programmingDates[0];
  const firstDateCodes = new Set(data.sessions.filter((session) => session.programmingDate === firstDate).map((session) => session.code));
  const missing = data.catalog.filter((movie) => !firstDateCodes.has(movie.code));
  if (missing.length) errors.push(`${missing.length} catalog films have no sessions on ${firstDate}`);
  if (errors.length) throw new Error(`Extraction validation failed:\n- ${errors.join("\n- ")}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.startDate || uaeToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("--start-date must use YYYY-MM-DD");
  const programmingDates = Array.from({ length: 8 }, (_, index) => addDays(startDate, index));
  console.error(`Extracting ${programmingDates[0]} through ${programmingDates.at(-1)} with ${WORKERS} workers`);
  const catalog = await getCatalog();
  const responses = await crawl(catalog, programmingDates);
  const { cinemas, sessions, duplicates } = flatten(responses);
  const output = { extractedAt: new Date().toISOString(), region: REGION, programmingDates, catalog, cinemas, sessions };
  validate(output);
  const destination = resolve(args.output);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.error(`Wrote ${sessions.length} sessions (${duplicates} duplicates removed), ${catalog.length} films and ${Object.keys(cinemas).length} cinemas to ${destination}`);
}

main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });

