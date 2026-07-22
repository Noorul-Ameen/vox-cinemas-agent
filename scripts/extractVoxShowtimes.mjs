#!/usr/bin/env node
/**
 * Extract the complete currently published VOX UAE schedule and first-party media.
 *
 * The public website uses a rotating browser API key and a one-hour anonymous guest
 * token. Both are discovered at runtime and are deliberately never logged or saved.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createAtomicAssetTransaction } from "./lib/atomicAssetTransaction.mjs";
import {
  MOVIE_INFORMATION_FORMAT,
  MOVIE_INFORMATION_PAGE_URL,
  MOVIE_INFORMATION_SOURCE_URL,
  validateMovieInformationCatalog,
} from "./lib/movieInformationCatalogValidation.mjs";

const SITE = "https://uae.voxcinemas.com";
const API_HOST = "https://uae-apife.voxcinemas.com";
const BASE = `${API_HOST}/v1/vox2-0`;
const AUTH_URL = `${API_HOST}/groups/authToken`;
const REGION = "UAE";
const FORBIDDEN_CUSTOMER_DASHES = new RegExp(
  `[${String.fromCodePoint(0x2013)}${String.fromCodePoint(0x2014)}]`,
  "gu",
);
const DEFAULT_WORKERS = 2;
const STAGGER_MS = 220;
const RETRIES = 3;
const BACKOFF_MS = 900;
const TIMEOUT_MS = 30000;
const MOVIE_DETAIL_WORKERS = 4;
const MOVIE_DETAIL_RETRIES = 2;
const MOVIE_DETAIL_TIMEOUT_MS = 12000;
const MOVIE_DETAIL_TOTAL_TIMEOUT_MS = 120000;
const LANGUAGE_NAMES = { ENG: "English", EN: "English", ARA: "Arabic", AR: "Arabic", HIN: "Hindi", HI: "Hindi", MAL: "Malayalam", ML: "Malayalam", TAM: "Tamil", TM: "Tamil", TA: "Tamil", TEL: "Telugu", TE: "Telugu", TUR: "Turkish", TR: "Turkish", KOR: "Korean", KO: "Korean", KAN: "Kannada", KN: "Kannada", SPA: "Spanish", ES: "Spanish" };
const BROWSER_HEADERS = {
  accept: "application/json",
  "accept-language": "en-US,en;q=0.9",
  origin: SITE,
  referer: `${SITE}/`,
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const normalizeCustomerFacingPunctuation = (value) => {
  if (typeof value === "string") return value.replace(FORBIDDEN_CUSTOMER_DASHES, "-");
  if (Array.isArray(value)) return value.map(normalizeCustomerFacingPunctuation);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeCustomerFacingPunctuation(item)]),
    );
  }
  return value;
};
const text = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return String(value.title ?? value.name ?? value.label ?? value.code ?? "").trim();
  return String(value).trim();
};
const list = (value) => {
  if (Array.isArray(value)) return value.flatMap((item) => list(item)).filter(Boolean);
  if (typeof value === "string" && value.includes(",")) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return text(value) ? [text(value)] : [];
};
const asset = (value) => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return text(value.url ?? value.assetUrl ?? value.src ?? value.path);
};
const absoluteSiteUrl = (value, fallback = "") => {
  const candidate = asset(value) || fallback;
  if (!candidate) return "";
  try { return new URL(candidate, SITE).href; } catch { return ""; }
};

export function parseArgs(argv) {
  const args = {
    startDate: null,
    output: "data/vox_showtimes_full.json",
    movieInformationOutput: "data/vox_movie_information_catalog.json",
    previousMovieInformation: null,
    maxDays: 31,
    workers: DEFAULT_WORKERS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (["--start-date", "--output", "--movie-information-output", "--previous-movie-information", "--max-days", "--workers"].includes(flag)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${flag} requires a value`);
      if (flag === "--start-date") args.startDate = value;
      if (flag === "--output") args.output = value;
      if (flag === "--movie-information-output") args.movieInformationOutput = value;
      if (flag === "--previous-movie-information") args.previousMovieInformation = value;
      if (flag === "--max-days") args.maxDays = Number(value);
      if (flag === "--workers") args.workers = Number(value);
      index += 1;
    } else if (flag === "--help") {
      console.log("node scripts/extractVoxShowtimes.mjs [--start-date YYYY-MM-DD] [--max-days 31] [--workers 2] [--output FILE] [--movie-information-output FILE] [--previous-movie-information FILE]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!Number.isInteger(args.maxDays) || args.maxDays < 1 || args.maxDays > 90) throw new Error("--max-days must be an integer from 1 to 90");
  if (!Number.isInteger(args.workers) || args.workers < 1 || args.workers > 4) throw new Error("--workers must be an integer from 1 to 4");
  return args;
}

export function uaeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(value, count) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function fetchPublicResource(url, options, label) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await sleep(BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  throw new Error(`${label} failed after 3 attempts: ${lastError?.message || "unknown error"}`);
}

async function discoverPublicApiKey() {
  if (process.env.VOX_PUBLIC_API_KEY) return process.env.VOX_PUBLIC_API_KEY;
  const pageUrl = `${SITE}/movies/whatson`;
  const response = await fetchPublicResource(pageUrl, { headers: { ...BROWSER_HEADERS, accept: "text/html" } }, "API bootstrap page");
  if (!response.ok) throw new Error(`API bootstrap page: HTTP ${response.status}`);
  const html = await response.text();
  const direct = html.match(/apiKey\s*:\s*["']([A-Za-z0-9_-]{24,})["']/)?.[1];
  if (direct) return direct;
  const scriptUrls = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map((match) => absoluteSiteUrl(match[1]))
    .filter(Boolean);
  let cursor = 0;
  let discovered = "";
  async function worker() {
    while (!discovered && cursor < scriptUrls.length) {
      const url = scriptUrls[cursor];
      cursor += 1;
      try {
        const scriptResponse = await fetchWithTimeout(url, { headers: { ...BROWSER_HEADERS, accept: "*/*" } });
        if (!scriptResponse.ok) continue;
        const script = await scriptResponse.text();
        const match = script.match(/apiKey\s*:\s*["']([A-Za-z0-9_-]{24,})["']/);
        if (match) discovered = match[1];
      } catch {
        // A single nonessential bundle failure must not abort key discovery.
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  if (!discovered) throw new Error("Could not discover the current public VOX browser key. Retry later or set VOX_PUBLIC_API_KEY for this run only.");
  return discovered;
}

export class VoxClient {
  constructor() {
    this.apiKey = "";
    this.token = "";
  }

  async authenticate({ rediscoverKey = false } = {}) {
    if (rediscoverKey) this.apiKey = "";
    this.apiKey ||= await discoverPublicApiKey();
    const response = await fetchWithTimeout(AUTH_URL, { headers: { ...BROWSER_HEADERS, "x-api-key": this.apiKey } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.access_token) throw new Error(`Anonymous VOX guest authentication failed with HTTP ${response.status}`);
    this.token = payload.access_token;
  }

  async fetchJson(url, label, { authAttempt = 0 } = {}) {
    if (!this.token) await this.authenticate();
    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        const response = await fetchWithTimeout(url, {
          headers: {
            ...BROWSER_HEADERS,
            authorization: `Bearer ${this.token}`,
            "x-api-key": this.apiKey,
            "x-auth-type": "Oauth",
          },
        });
        if (response.status === 401 && authAttempt < 2) {
          // First renew the short-lived guest token. If that is still rejected,
          // rediscover the rotating public browser key and obtain one final token.
          await this.authenticate({ rediscoverKey: authAttempt === 1 });
          return this.fetchJson(url, label, { authAttempt: authAttempt + 1 });
        }
        if (!response.ok) {
          const error = Object.assign(new Error(`${label}: HTTP ${response.status}`), { status: response.status, retryAfter: response.headers.get("retry-after") });
          throw error;
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        if ([401, 403].includes(error?.status)) throw new Error(`${label}: authentication was rejected. Retry from a normal network without logging or committing guest credentials.`);
        if (error?.status && error.status < 500 && error.status !== 429) throw error;
        if (attempt < RETRIES) {
          const retryAfterMs = Number(error?.retryAfter) * 1000;
          const jitter = Math.floor(Math.random() * 250);
          await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : BACKOFF_MS * 2 ** attempt + jitter);
        }
      }
    }
    throw new Error(`${label} failed after ${RETRIES + 1} attempts: ${lastError?.message}`);
  }
}

function normalizeImages(matrixImages, catalogImage) {
  const matrix = matrixImages && typeof matrixImages === "object" ? matrixImages : {};
  const catalog = catalogImage && typeof catalogImage === "object" ? catalogImage : {};
  return {
    large: absoluteSiteUrl(matrix.large || catalog.urlWeb),
    medium: absoluteSiteUrl(matrix.medium || catalog.urlWebSmall || catalog.urlWeb),
    thumbnail: absoluteSiteUrl(matrix.thumbnail || catalog.thumbnail),
    largeMobile: absoluteSiteUrl(matrix.largeMobile || catalog.urlMobile),
    mediumMobile: absoluteSiteUrl(matrix.mediumMobile || catalog.urlMobileSmall || catalog.urlMobile),
  };
}

function officialMoviePage(value) {
  const route = text(value).replace(/^\/+|\/+$/gu, "");
  if (!route) return "";
  return absoluteSiteUrl(route.startsWith("movies/") ? `/${route}` : `/movies/${route}`);
}

export function normalizeMovieInformationCatalog(contentCatalog, fetchedAt = new Date().toISOString()) {
  const source = Array.isArray(contentCatalog) ? contentCatalog : contentCatalog?.movies || [];
  const movies = source.map((movie) => {
    const code = text(movie.hoCode || movie.code || movie.id);
    const language = text(movie.language);
    const movieUrl = text(movie.urlDetails || movie.movieUrl);
    return {
      code,
      title: text(movie.title),
      rating: text(movie.rating),
      language,
      languageName: text(movie.languageName) || LANGUAGE_NAMES[language] || language,
      runtime: Number(movie.runtime ?? movie.runTime ?? movie.duration) || 0,
      genres: list(movie.genres),
      synopsis: text(movie.description || movie.synopsis),
      subtitles: list(movie.subtitles),
      released: text(movie.releaseDate),
      movieUrl,
      sourcePageUrl: officialMoviePage(movieUrl),
      sourceUrl: MOVIE_INFORMATION_SOURCE_URL,
    };
  }).filter((movie) => movie.code && movie.title)
    .sort((left, right) => left.title.localeCompare(right.title) || left.code.localeCompare(right.code));

  return normalizeCustomerFacingPunctuation({
    format: MOVIE_INFORMATION_FORMAT,
    extractedAt: fetchedAt,
    region: REGION,
    sourceUrl: MOVIE_INFORMATION_SOURCE_URL,
    sourcePageUrl: MOVIE_INFORMATION_PAGE_URL,
    movies,
  });
}

function decodeHtmlText(value) {
  return String(value || "")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/gu, " ")
    .trim();
}

function durationMinutes(hours, minutes) {
  const hourValue = Number(hours) || 0;
  const minuteValue = Number(minutes) || 0;
  const total = hourValue * 60 + minuteValue;
  return total > 0 && total < 600 ? total : 0;
}

export function parseOfficialMovieRuntime(html) {
  const visibleText = decodeHtmlText(html);
  const hourMinute = visibleText.match(/\bRunning\s*Time\s*:?[\s-]*(?:(\d{1,2})\s*h(?:ours?)?)?\s*(\d{1,2})\s*m(?:in(?:ute)?s?)?\b/iu);
  if (hourMinute) return durationMinutes(hourMinute[1], hourMinute[2]);
  const minutesOnly = visibleText.match(/\bRunning\s*Time\s*:?[\s-]*(\d{2,3})\s*(?:minutes?|mins?)\b/iu);
  if (minutesOnly) return durationMinutes(0, minutesOnly[1]);
  const serialized = String(html || "").match(/"(?:runningTime|runtime)"\s*:\s*"(?:(\d{1,2})\s*h)?\s*(\d{1,3})\s*m(?:in(?:ute)?s?)?"/iu);
  return serialized ? durationMinutes(serialized[1], serialized[2]) : 0;
}

async function fetchOfficialMovieDetailPage(url, { deadline = Date.now() + MOVIE_DETAIL_TOTAL_TIMEOUT_MS } = {}) {
  let lastError;
  for (let attempt = 0; attempt < MOVIE_DETAIL_RETRIES; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error("movie detail enrichment deadline exceeded");
    try {
      const response = await fetchWithTimeout(url, {
        headers: { ...BROWSER_HEADERS, accept: "text/html,application/xhtml+xml" },
      }, Math.min(MOVIE_DETAIL_TIMEOUT_MS, remainingMs));
      if (response.ok) return await response.text();
      if (response.status < 500 && response.status !== 429) throw new Error(`HTTP ${response.status}`);
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < MOVIE_DETAIL_RETRIES) {
      const remainingAfterAttempt = deadline - Date.now();
      if (remainingAfterAttempt <= 0) break;
      await sleep(Math.min(BACKOFF_MS * 2 ** attempt, remainingAfterAttempt));
    }
  }
  throw new Error(lastError?.message || "official movie detail page request failed");
}

export async function enrichMovieInformationRuntimes(
  catalog,
  {
    workers = MOVIE_DETAIL_WORKERS,
    totalTimeoutMs = MOVIE_DETAIL_TOTAL_TIMEOUT_MS,
    fetchPage = fetchOfficialMovieDetailPage,
  } = {},
) {
  const movies = (catalog?.movies || []).map((movie) => ({
    ...movie,
    runtimeStatus: Number(movie.runtime) > 0 ? "content_api" : "not_published",
    runtimeSourceUrl: Number(movie.runtime) > 0 ? MOVIE_INFORMATION_SOURCE_URL : "",
    runtimeVerifiedAt: Number(movie.runtime) > 0 ? catalog.extractedAt : "",
  }));
  const pending = movies
    .map((movie, index) => ({ movie, index }))
    .filter(({ movie }) => !Number(movie.runtime) && movie.sourcePageUrl);
  const deadline = Date.now() + totalTimeoutMs;
  let cursor = 0;
  let enrichedCount = 0;
  let failedCount = 0;
  let timedOutCount = 0;

  async function worker(workerIndex) {
    if (workerIndex) await sleep(workerIndex * 80);
    while (cursor < pending.length) {
      const pendingIndex = cursor;
      cursor += 1;
      const { movie, index } = pending[pendingIndex];
      if (Date.now() >= deadline) {
        movies[index] = { ...movie, runtimeStatus: "deadline_exceeded" };
        timedOutCount += 1;
        continue;
      }
      try {
        const html = await fetchPage(movie.sourcePageUrl, { deadline });
        const runtime = parseOfficialMovieRuntime(html);
        if (runtime) {
          movies[index] = {
            ...movie,
            runtime,
            runtimeStatus: "official_detail_page",
            runtimeSourceUrl: movie.sourcePageUrl,
            runtimeVerifiedAt: catalog.extractedAt,
          };
          enrichedCount += 1;
        } else {
          movies[index] = { ...movie, runtimeStatus: "not_published" };
        }
      } catch (error) {
        const deadlineExceeded = Date.now() >= deadline || /deadline|abort/iu.test(String(error?.message || ""));
        movies[index] = { ...movie, runtimeStatus: deadlineExceeded ? "deadline_exceeded" : "fetch_failed" };
        if (deadlineExceeded) timedOutCount += 1;
        else failedCount += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, MOVIE_DETAIL_WORKERS)) }, (_, index) => worker(index)));
  return normalizeCustomerFacingPunctuation({
    ...catalog,
    movies,
    detailPageRuntimeEnrichment: {
      requestedCount: pending.length,
      enrichedCount,
      failedCount,
      timedOutCount,
      retainedCount: 0,
      workers: Math.max(1, Math.min(workers, MOVIE_DETAIL_WORKERS)),
      retries: MOVIE_DETAIL_RETRIES,
      totalTimeoutMs,
      source: "official VOX UAE movie detail pages",
    },
  });
}

export function retainPreviouslyVerifiedRuntimes(catalog, previousCatalog) {
  const previousByCode = new Map((previousCatalog?.movies || []).map((movie) => [movie.code, movie]));
  let retainedCount = 0;
  const movies = (catalog?.movies || []).map((movie) => {
    if (Number(movie.runtime) > 0) return movie;
    const previous = previousByCode.get(movie.code);
    const runtimeSourceUrl = String(previous?.runtimeSourceUrl || "");
    if (!Number(previous?.runtime) || !/^https:\/\/uae\.voxcinemas\.com\/movies\//u.test(runtimeSourceUrl)) return movie;
    retainedCount += 1;
    return {
      ...movie,
      runtime: previous.runtime,
      runtimeStatus: "retained_official_detail_page",
      runtimeSourceUrl,
      runtimeVerifiedAt: previous.runtimeVerifiedAt || previousCatalog.extractedAt || "",
    };
  });
  return {
    ...catalog,
    movies,
    detailPageRuntimeEnrichment: {
      ...(catalog.detailPageRuntimeEnrichment || {}),
      retainedCount,
    },
  };
}

export async function getCatalogBundle(client, fetchedAt = new Date().toISOString()) {
  const [nowShowing, advanceBooking, contentCatalog] = await Promise.all([
    client.fetchJson(`${BASE}/groups/api/MovieMatrix/NowShowingByFilter?region=${REGION}`, "now-showing matrix"),
    client.fetchJson(`${BASE}/groups/api/MovieMatrix/AdvanceBookingByFilter?Region=${REGION}`, "advance-booking matrix"),
    client.fetchJson(`${BASE}/content/movies?region=${REGION}`, "movie content catalog"),
  ]);
  const content = Array.isArray(contentCatalog) ? contentCatalog : contentCatalog?.movies || [];
  const contentByCode = new Map(content.map((movie) => [text(movie.hoCode || movie.code), movie]));
  const byCode = new Map();
  for (const [category, source] of [["NowShowing", nowShowing], ["AdvanceBooking", advanceBooking]]) {
    for (const movie of Array.isArray(source) ? source : source?.items || []) {
      const code = text(movie.code || movie.hoCode);
      if (!code) continue;
      const detail = contentByCode.get(code) || {};
      const existing = byCode.get(code);
      const images = normalizeImages(movie.images, detail.image);
      const posterUrl = images.medium || images.thumbnail || images.mediumMobile || images.large;
      const language = text(detail.language) || list(movie.languages)[0] || "";
      const categories = [...new Set([...(existing?.categories || []), category])];
      byCode.set(code, {
        code,
        title: text(movie.title || detail.title),
        rating: text(movie.rating || detail.rating),
        language,
        languageName: text(detail.languageName) || LANGUAGE_NAMES[language] || list(movie.languages).join(", ") || language,
        languages: list(movie.languages || detail.language),
        runtime: Number(movie.runTime ?? detail.runtime ?? detail.runTime) || 0,
        genres: list(movie.genres || detail.genres),
        synopsis: text(detail.description || movie.description),
        subtitles: list(movie.subtitles || detail.subtitles),
        released: text(movie.releaseDate || detail.releaseDate),
        movieUrl: text(movie.movieUrl || detail.urlDetails),
        sourcePageUrl: absoluteSiteUrl(`/movies/${text(movie.movieUrl || detail.urlDetails)}`),
        sourceUrl: `${BASE}/groups/api/MovieMatrix/${category}ByFilter?region=${REGION}`,
        categories,
        experiences: list(movie.experiences),
        images,
        posterUrl,
        posterStatus: posterUrl ? "official" : "missing_at_source",
        backdropUrl: images.large || images.largeMobile || images.medium,
      });
    }
  }
  const movieInformationCatalog = await enrichMovieInformationRuntimes(
    normalizeMovieInformationCatalog(contentCatalog, fetchedAt),
  );
  return {
    catalogCandidates: [...byCode.values()].sort((a, b) => a.title.localeCompare(b.title)),
    movieInformationCatalog,
  };
}

export async function getCatalog(client) {
  return (await getCatalogBundle(client)).catalogCandidates;
}

async function runJobs(jobs, workers, task) {
  const results = new Array(jobs.length);
  const failures = [];
  let cursor = 0;
  async function worker(workerIndex) {
    if (workerIndex) await sleep(workerIndex * STAGGER_MS);
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      try { results[index] = await task(jobs[index], index); }
      catch (error) { failures.push({ job: jobs[index], error: error.message }); }
      await sleep(STAGGER_MS);
    }
  }
  await Promise.all(Array.from({ length: workers }, (_, index) => worker(index)));
  if (failures.length) throw new Error(`${failures.length} official VOX calls failed; first: ${failures[0].error}`);
  return results;
}

export async function discoverAvailableDates(client, catalog, startDate, maxDays, workers) {
  const jobs = catalog.flatMap((movie) => movie.categories.map((category) => ({ movie, category })));
  const responses = await runJobs(jobs, workers, async ({ movie, category }) => {
    const url = `${BASE}/groups/groups/${category}/region/${REGION}/movie/${encodeURIComponent(movie.code)}/availableDays`;
    const payload = await client.fetchJson(url, `${movie.code}/${category} available days`);
    const values = Array.isArray(payload) ? payload : payload?.availableDays || [];
    return { code: movie.code, category, dates: values.map((value) => text(value).slice(0, 10)).filter(isIsoDate) };
  });
  const maxDate = addDays(startDate, maxDays - 1);
  const datesByCode = new Map();
  let dateBeyondCap = "";
  for (const response of responses) {
    const dates = datesByCode.get(response.code) || new Set();
    for (const date of response.dates) {
      if (date < startDate) continue;
      if (date > maxDate) { if (!dateBeyondCap || date < dateBeyondCap) dateBeyondCap = date; continue; }
      dates.add(date);
    }
    datesByCode.set(response.code, dates);
  }
  if (dateBeyondCap) throw new Error(`VOX advertises showtimes through at least ${dateBeyondCap}, beyond --max-days ${maxDays}. Increase the cap so the crawl is not truncated.`);
  return new Map([...datesByCode].map(([code, dates]) => [code, [...dates].sort()]));
}

export async function crawlSessions(client, catalog, datesByCode, workers) {
  const jobs = catalog.flatMap((movie) => (datesByCode.get(movie.code) || []).map((programmingDate) => ({ code: movie.code, programmingDate })));
  if (!jobs.length) throw new Error("VOX currently exposes no bookable dates on or after the requested start date.");
  return runJobs(jobs, workers, async (job) => ({
    ...job,
    payload: await client.fetchJson(`${BASE}/groups/api/Sessions/${REGION}/${encodeURIComponent(job.code)}/${job.programmingDate}`, `${job.code}/${job.programmingDate} sessions`),
  }));
}

export function flatten(responses) {
  const cinemas = new Map();
  const sessions = new Map();
  let duplicates = 0;
  let rawSessionCount = 0;
  for (const { code, programmingDate, payload } of responses) {
    for (const cinema of Array.isArray(payload?.cinemas) ? payload.cinemas : []) {
      const cinemaCode = text(cinema.cinemaCode);
      if (!cinemaCode) continue;
      cinemas.set(cinemaCode, text(cinema.cinemaName));
      for (const group of Array.isArray(cinema.sessionGroups) ? cinema.sessionGroups : []) {
        const experience = text(group.experience);
        const experienceCode = text(group.code);
        for (const session of Array.isArray(group.sessions) ? group.sessions : []) {
          rawSessionCount += 1;
          const showtime = text(session.showtime);
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(showtime)) throw new Error(`Malformed showtime for ${code}/${cinemaCode}: ${showtime || "empty"}`);
          const date = showtime.slice(0, 10);
          const time = showtime.slice(11, 16);
          const sessionId = text(session.sessionId);
          const key = [code, cinemaCode, sessionId || `${experienceCode}:${experience}`, showtime].join("\u001f");
          if (sessions.has(key)) { duplicates += 1; continue; }
          sessions.set(key, {
            programmingDate,
            date,
            code,
            cinemaCode,
            experience,
            experienceCode,
            sessionId,
            showtime,
            time,
            timeSlot: text(session.filter),
            status: text(session.status),
            isAvailableForOffer: session.isAvailableForOffer !== false,
            comment: text(session.comment),
          });
        }
      }
    }
  }
  return {
    cinemas: Object.fromEntries([...cinemas].sort(([left], [right]) => left.localeCompare(right))),
    sessions: [...sessions.values()].sort((a, b) => a.programmingDate.localeCompare(b.programmingDate) || a.cinemaCode.localeCompare(b.cinemaCode) || a.code.localeCompare(b.code) || a.showtime.localeCompare(b.showtime)),
    duplicates,
    rawSessionCount,
  };
}

function experienceMedia(payload, fetchedAt) {
  const source = Array.isArray(payload) ? payload : payload?.items || [];
  return source.map((item) => {
    const images = normalizeImages(item.images, null);
    return {
      code: text(item.code),
      name: text(item.name),
      description: text(item.description),
      detailsUrl: text(item.detailsUrl),
      logoUrl: absoluteSiteUrl(item.logo || item.logoMobile),
      logoMobileUrl: absoluteSiteUrl(item.logoMobile || item.logo),
      imageUrl: images.medium || images.thumbnail || images.large,
      backdropUrl: images.large || images.largeMobile || images.medium,
      images,
      sourcePageUrl: absoluteSiteUrl(item.detailsUrl, `${SITE}/ways-to-watch`),
      sourceUrl: `${BASE}/groups/api/Experience?region=${REGION}`,
      fetchedAt,
    };
  }).filter((item) => item.code || item.name);
}

function offerMedia(payload, fetchedAt) {
  const source = Array.isArray(payload) ? payload : payload?.items || payload?.offers || [];
  return source.filter((item) => item?.active === true).map((item) => ({
    code: text(item.code),
    slug: text(item.slug),
    name: text(item.name),
    imageUrl: absoluteSiteUrl(item.image),
    heroUrl: absoluteSiteUrl(item.imageHeader),
    promoUrl: absoluteSiteUrl(item.imageWebsitePromo),
    mobileUrl: absoluteSiteUrl(item.imageMobileLanding),
    sourcePageUrl: `${SITE}/offers/bank-deals`,
    sourceUrl: `${BASE}/groups/groups/Offer/GetB2bOffer?region=${REGION}&type=bank`,
    fetchedAt,
  }));
}

export function validate(data) {
  const errors = [];
  const dates = data.programmingDates;
  const catalogCodes = new Set(data.catalog.map((movie) => movie.code));
  if (!dates.length) errors.push("no programming dates contain sessions");
  if (dates.some((date, index) => !isIsoDate(date) || date < data.crawl.startDate || (index && date <= dates[index - 1]))) errors.push("programming dates must be valid, unique, sorted, and on/after the requested start date");
  if (!data.sessions.length) errors.push("no sessions were extracted");
  if (!Object.keys(data.cinemas).length) errors.push("no cinemas were extracted");
  if (data.sessions.some((session) => !catalogCodes.has(session.code) || !session.cinemaCode || !session.sessionId || !session.time || !session.experience)) errors.push("session identifiers or relationships are incomplete");
  const incompleteMovies = data.catalog
    .filter((movie) => !movie.code || !movie.title)
    .map((movie) => `${movie.code || "missing-code"} (${movie.title || "missing title"})`);
  if (incompleteMovies.length) errors.push(`scheduled movie metadata is incomplete: ${incompleteMovies.join(", ")}`);
  const invalidPosterCodes = data.catalog
    .filter((movie) => movie.posterUrl && !/^https:\/\//.test(movie.posterUrl))
    .map((movie) => movie.code);
  if (invalidPosterCodes.length) errors.push(`official poster URLs must use HTTPS: ${invalidPosterCodes.join(", ")}`);
  const missingPosterCodes = data.catalog.filter((movie) => !movie.posterUrl).map((movie) => movie.code).sort();
  const recordedMissingPosterCodes = [...(data.crawl?.missingOfficialPosterCodes || [])].sort();
  if (JSON.stringify(missingPosterCodes) !== JSON.stringify(recordedMissingPosterCodes)) {
    errors.push("missing official poster codes must be recorded exactly in crawl metadata");
  }
  if (data.sessions.length + data.crawl.duplicateCount !== data.crawl.rawSessionCount) errors.push("raw session and duplicate counts do not reconcile");
  if (data.experienceMedia.some((item) => [item.logoUrl, item.imageUrl, item.backdropUrl].filter(Boolean).some((url) => !/^https:\/\//.test(url)))) errors.push("experience media contains a non-HTTPS URL");
  if (data.offerMedia.some((item) => [item.imageUrl, item.heroUrl, item.promoUrl, item.mobileUrl].filter(Boolean).some((url) => !/^https:\/\//.test(url)))) errors.push("offer media contains a non-HTTPS URL");
  if (!data.crawl.complete) errors.push("crawl is marked incomplete");
  if (errors.length) throw new Error(`Extraction validation failed:\n- ${errors.join("\n- ")}`);
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.startDate || uaeToday();
  if (!isIsoDate(startDate)) throw new Error("--start-date must be a real calendar date using YYYY-MM-DD");
  const client = new VoxClient();
  console.error(`Discovering official VOX UAE availability from ${startDate} (safety cap ${args.maxDays} days, ${args.workers} workers)`);
  const fetchedAt = new Date().toISOString();
  const bundle = await getCatalogBundle(client, fetchedAt);
  const { catalogCandidates } = bundle;
  let { movieInformationCatalog } = bundle;
  const movieInformationDestination = resolve(args.movieInformationOutput);
  const previousMovieInformationPath = resolve(args.previousMovieInformation || args.movieInformationOutput);
  if (existsSync(previousMovieInformationPath)) {
    try {
      const previousMovieInformation = JSON.parse(await readFile(previousMovieInformationPath, "utf8"));
      movieInformationCatalog = retainPreviouslyVerifiedRuntimes(movieInformationCatalog, previousMovieInformation);
    } catch (error) {
      console.error(`Previous movie runtime metadata was not retained: ${error.message}`);
    }
  }
  validateMovieInformationCatalog(movieInformationCatalog, { now: new Date(fetchedAt) });
  const datesByCode = await discoverAvailableDates(client, catalogCandidates, startDate, args.maxDays, args.workers);
  const responses = await crawlSessions(client, catalogCandidates, datesByCode, args.workers);
  const [experiencesPayload, offersPayload] = await Promise.all([
    client.fetchJson(`${BASE}/groups/api/Experience?region=${REGION}`, "experience catalog"),
    client.fetchJson(`${BASE}/groups/groups/Offer/GetB2bOffer?region=${REGION}&type=bank`, "bank-offer catalog"),
  ]);
  const { cinemas, sessions, duplicates, rawSessionCount } = flatten(responses);
  const scheduledCodes = new Set(sessions.map((session) => session.code));
  const catalog = catalogCandidates.filter((movie) => scheduledCodes.has(movie.code));
  const missingOfficialPosterCodes = catalog.filter((movie) => !movie.posterUrl).map((movie) => movie.code).sort();
  const programmingDates = [...new Set(sessions.map((session) => session.programmingDate))].sort();
  const discoveredProgrammingDates = [...new Set([...datesByCode.values()].flat())].sort();
  const extractedExperienceMedia = experienceMedia(experiencesPayload, fetchedAt);
  const extractedOfferMedia = offerMedia(offersPayload, fetchedAt);
  const output = normalizeCustomerFacingPunctuation({
    extractedAt: fetchedAt,
    region: REGION,
    programmingDates,
    catalog,
    cinemas,
    sessions,
    experienceMedia: extractedExperienceMedia,
    offerMedia: extractedOfferMedia,
    crawl: {
      startDate,
      maxDays: args.maxDays,
      discoveredProgrammingDates,
      lastAvailableDate: programmingDates.at(-1),
      stopReason: "official-available-days-exhausted",
      complete: true,
      candidateMovieCount: catalogCandidates.length,
      scheduledMovieCount: catalog.length,
      requestedSessionCalls: responses.length,
      rawSessionCount,
      duplicateCount: duplicates,
      sourceMissingOfficialPosterCodes: missingOfficialPosterCodes,
      missingOfficialPosterCodes,
      retainedMoviePosterCodes: [],
      retainedMoviePosterCount: 0,
      freshExperienceMediaCount: extractedExperienceMedia.length,
      freshOfferMediaCount: extractedOfferMedia.length,
      experienceMediaPartialResponse: false,
      offerMediaPartialResponse: false,
      retainedExperienceMediaCount: 0,
      retainedOfferMediaCount: 0,
      sessionsByProgrammingDate: Object.fromEntries(programmingDates.map((date) => [date, sessions.filter((session) => session.programmingDate === date).length])),
    },
    provenance: {
      schedulePageUrl: `${SITE}/movies/whatson`,
      advancePageUrl: `${SITE}/movies/earlyaccesstickets`,
      experiencePageUrl: `${SITE}/ways-to-watch`,
      offerPageUrl: `${SITE}/offers/bank-deals`,
      note: "Remote artwork remains owned by its respective rights holders and is retained with first-party source attribution.",
    },
  });
  validate(output);
  const destination = resolve(args.output);
  if (destination === movieInformationDestination) throw new Error("Schedule and movie-information outputs must use different files");
  const temporary = `${destination}.tmp-${process.pid}`;
  const movieInformationTemporary = `${movieInformationDestination}.tmp-${process.pid}`;
  const backup = `${destination}.backup-${process.pid}`;
  const movieInformationBackup = `${movieInformationDestination}.backup-${process.pid}`;
  const transaction = createAtomicAssetTransaction([
    [destination, temporary, backup],
    [movieInformationDestination, movieInformationTemporary, movieInformationBackup],
  ]);
  await Promise.all([
    mkdir(dirname(destination), { recursive: true }),
    mkdir(dirname(movieInformationDestination), { recursive: true }),
  ]);
  try {
    await Promise.all([
      writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
      writeFile(movieInformationTemporary, `${JSON.stringify(movieInformationCatalog, null, 2)}\n`, "utf8"),
    ]);
    await transaction.promote();
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await Promise.all([
      rm(temporary, { force: true }).catch(() => {}),
      rm(movieInformationTemporary, { force: true }).catch(() => {}),
      rm(backup, { force: true }).catch(() => {}),
      rm(movieInformationBackup, { force: true }).catch(() => {}),
    ]);
  }
  console.error(`Wrote ${sessions.length} sessions (${duplicates} duplicates removed), ${catalog.length} scheduled films, ${Object.keys(cinemas).length} cinemas, ${output.experienceMedia.length} experiences and ${output.offerMedia.length} active offers to ${destination}`);
  console.error(`Wrote ${movieInformationCatalog.movies.length} official information-only movie records to ${movieInformationDestination}`);
  console.error(`Coverage: ${programmingDates[0]} through ${programmingDates.at(-1)} (${programmingDates.length} published programming dates)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`FATAL: ${error.message}`); process.exitCode = 1; });
}
