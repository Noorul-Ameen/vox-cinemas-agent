#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, uaeToday, validate as validateSchedule } from "./extractVoxShowtimes.mjs";
import {
  MOVIE_INFORMATION_FORMAT,
  MOVIE_INFORMATION_PAGE_URL,
  MOVIE_INFORMATION_SOURCE_URL,
  validateMovieInformationCatalog,
  validateScheduledMovieCoverage,
} from "./lib/movieInformationCatalogValidation.mjs";

const REGION = "UAE";
const SITE = "https://uae.voxcinemas.com";
const SHOWTIMES_URL = `${SITE}/showtimes`;
const REQUEST_TIMEOUT_MS = 30_000;
const EXPERIENCE_CODES = Object.freeze({
  STANDARD: "STD",
  PREMIUM: "PRM",
  THEATRE: "THR",
  KIDS: "KDS",
  GOLD: "GLD",
  IMAX: "IMX",
  MAX: "MAX",
  "4DX": "4DX",
});

function parseArgs(argv) {
  const parsed = {
    output: "data/vox_showtimes_full.json",
    movieInformationOutput: "data/vox_movie_information_catalog.json",
    previousMovieInformation: "data/vox_movie_information_catalog.json",
    previousSchedule: "data/vox_showtimes_full.json",
    maxDays: 45,
    workers: 2,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--output") parsed.output = value;
    else if (key === "--movie-information-output") parsed.movieInformationOutput = value;
    else if (key === "--previous-movie-information") parsed.previousMovieInformation = value;
    else if (key === "--previous-schedule") parsed.previousSchedule = value;
    else if (key === "--start-date") parsed.startDate = value;
    else if (key === "--max-days") parsed.maxDays = Number(value);
    else if (key === "--workers") parsed.workers = Number(value);
    else throw new Error(`Unknown argument: ${key}`);
    index += 1;
  }
  if (!Number.isInteger(parsed.maxDays) || parsed.maxDays < 2 || parsed.maxDays > 60) {
    throw new Error("--max-days must be an integer from 2 to 60");
  }
  if (!Number.isInteger(parsed.workers) || parsed.workers < 1 || parsed.workers > 4) {
    throw new Error("--workers must be an integer from 1 to 4");
  }
  return parsed;
}

function decodeHtml(value = "") {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value)
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/giu, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function plainText(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/gu, " ")).replace(/\s+/gu, " ").trim();
}

function attribute(attributes = "", name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = String(attributes).match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "iu"));
  return decodeHtml(match?.[2] || "").trim();
}

function hasClass(attributes, className) {
  return attribute(attributes, "class").split(/\s+/u).includes(className);
}

function articleBlocks(html, className) {
  const blocks = [];
  const pattern = /<article\b([^>]*)>([\s\S]*?)<\/article>/giu;
  for (const match of String(html).matchAll(pattern)) {
    if (hasClass(match[1], className)) blocks.push({ attributes: match[1], body: match[2] });
  }
  return blocks;
}

function firstTagText(html, tagName, className = "") {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "giu");
  for (const match of String(html).matchAll(pattern)) {
    if (!className || hasClass(match[1], className)) return plainText(match[2]);
  }
  return "";
}

function firstTagAttribute(html, tagName, className, name) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "giu");
  for (const match of String(html).matchAll(pattern)) {
    if (!className || hasClass(match[1], className)) return attribute(match[1], name);
  }
  return "";
}

function movieCode(value) {
  return String(value).match(/(HO\d{8})/iu)?.[1]?.toUpperCase() || "";
}

function isoDateFromCompact(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/u);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function compactDate(value) {
  return String(value).replaceAll("-", "");
}

function dateDistance(startDate, date) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
}

export function parseShowtimeDateLinks(html) {
  const dates = new Set();
  for (const match of String(html).matchAll(/<input\b([^>]*)>/giu)) {
    if (attribute(match[1], "name") !== "d") continue;
    const date = isoDateFromCompact(attribute(match[1], "value"));
    if (date) dates.add(date);
  }
  for (const match of String(html).matchAll(/<a\b([^>]*)>/giu)) {
    const href = attribute(match[1], "href");
    const compact = href.match(/[?&]d=(\d{8})(?:&|$)/u)?.[1];
    const date = isoDateFromCompact(compact);
    if (date) dates.add(date);
  }
  return [...dates].sort();
}

export function parseCinemaOptions(html) {
  const options = [];
  for (const label of String(html).matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/giu)) {
    const input = label[1].match(/<input\b([^>]*)>/iu);
    if (!input || attribute(input[1], "name") !== "c") continue;
    const slug = attribute(input[1], "value");
    const name = firstTagText(label[1], "span");
    if (slug && name) options.push({ slug, name });
  }
  return [...new Map(options.map((item) => [item.slug, item])).values()];
}

export function parseWhatsOnCatalog(html) {
  return articleBlocks(html, "movie-summary").map(({ attributes, body }) => {
    const slug = attribute(attributes, "data-slug") || firstTagAttribute(body, "a", "", "href").replace(/^\/movies\//u, "").split(/[?#]/u)[0];
    const posterUrl = firstTagAttribute(body, "img", "poster", "src");
    const languageText = firstTagText(body, "p", "language").replace(/^Language:\s*/iu, "");
    return {
      code: movieCode(posterUrl),
      slug,
      title: attribute(attributes, "data-title") || firstTagText(body, "h3"),
      rating: firstTagText(body, "span", "classification"),
      language: languageText,
      posterUrl: /^https:\/\//u.test(posterUrl) ? posterUrl : "",
    };
  }).filter((movie) => movie.code && movie.slug && movie.title);
}

export function parseMovieDetail(html, fallback = {}) {
  for (const match of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)) {
    if (attribute(match[1], "type").toLowerCase() !== "application/ld+json") continue;
    try {
      const parsed = JSON.parse(decodeHtml(match[2]).trim());
      const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed];
      const movie = candidates.find((item) => item?.["@type"] === "Movie");
      if (!movie) continue;
      const image = Array.isArray(movie.image) ? movie.image[0] : movie.image;
      const duration = String(movie.duration || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/iu);
      const runtime = duration ? (Number(duration[1] || 0) * 60) + Number(duration[2] || 0) : 0;
      const genres = (Array.isArray(movie.genre) ? movie.genre : String(movie.genre || "").split(/\s*[,/]\s*/u)).filter(Boolean);
      return {
        code: movieCode(image) || fallback.code || "",
        slug: fallback.slug || "",
        title: plainText(movie.name) || fallback.title || "",
        rating: plainText(movie.contentRating) || fallback.rating || "",
        language: plainText(movie.inLanguage) || fallback.language || "",
        runtime,
        genres: genres.map(plainText).filter(Boolean),
        synopsis: plainText(movie.description),
        posterUrl: /^https:\/\//u.test(image || "") ? image : fallback.posterUrl || "",
        detailVerified: true,
      };
    } catch {
      // Ignore unrelated or malformed structured-data blocks and continue scanning.
    }
  }
  return null;
}

function normalizeExperience(value) {
  const normalized = plainText(value).toUpperCase().replace(/\s+/gu, "_");
  if (normalized === "PREMIER") return "PREMIUM";
  return normalized || "STANDARD";
}

function parseClock(value) {
  const match = plainText(value).match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/iu);
  if (!match) return "";
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function timeSlot(time) {
  const hour = Number(String(time).slice(0, 2));
  if (hour < 5) return "LateNight";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 22) return "Primetime";
  return "LateNight";
}

export function parseShowtimePage(html, programmingDate) {
  const movies = [];
  const sessions = [];
  const cinemas = {};
  for (const { attributes, body } of articleBlocks(html, "movie-compare")) {
    const heroUrl = firstTagAttribute(body, "img", "hero", "src");
    const slug = attribute(attributes, "data-slug");
    const tags = [...String(body).matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/giu)]
      .filter((match) => hasClass(match[1], "tag"))
      .map((match) => plainText(match[2]));
    const runtime = Number(tags.find((tag) => /\bmin$/iu.test(tag))?.match(/\d+/u)?.[0] || 0);
    const language = tags.find((tag) => !/\bmin$/iu.test(tag)) || "";
    const movie = {
      code: movieCode(heroUrl),
      slug,
      title: firstTagText(body, "h2"),
      rating: firstTagText(body, "span", "classification"),
      language,
      runtime,
      heroUrl: /^https:\/\//u.test(heroUrl) ? heroUrl : "",
      experiences: new Set(),
    };
    if (!movie.code || !movie.slug || !movie.title) continue;

    const cinemaSections = body.split(/<h3\b[^>]*>([\s\S]*?)<\/h3>/giu);
    for (let sectionIndex = 1; sectionIndex + 1 < cinemaSections.length; sectionIndex += 2) {
      const cinemaName = plainText(cinemaSections[sectionIndex]);
      const section = cinemaSections[sectionIndex + 1];
      if (!cinemaName) continue;
      const experiencePattern = /<li\b[^>]*>\s*<strong\b[^>]*>([\s\S]*?)<\/strong>\s*<ol\b[^>]*>([\s\S]*?)<\/ol>\s*<\/li>/giu;
      for (const experienceMatch of section.matchAll(experiencePattern)) {
        const experience = normalizeExperience(experienceMatch[1]);
        const experienceCode = EXPERIENCE_CODES[experience] || experience.replace(/[^A-Z0-9]/gu, "").slice(0, 4) || "STD";
        movie.experiences.add(experience);
        for (const link of experienceMatch[2].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)) {
          if (!hasClass(link[1], "showtime")) continue;
          const bookingId = attribute(link[1], "data-id") || attribute(link[1], "href").match(/\/booking\/([^/?#]+)/u)?.[1] || "";
          const idMatch = bookingId.match(/^(\d{4})-(.+)$/u);
          const time = parseClock(link[2]);
          if (!idMatch || !time) continue;
          const cinemaCode = idMatch[1];
          cinemas[cinemaCode] = cinemaName;
          sessions.push({
            programmingDate,
            date: programmingDate,
            code: movie.code,
            cinemaCode,
            experience,
            experienceCode,
            sessionId: idMatch[2],
            showtime: `${programmingDate}T${time}:00+04:00`,
            time,
            timeSlot: timeSlot(time),
            status: "",
            isAvailableForOffer: false,
            comment: "",
          });
        }
      }
    }
    movies.push(movie);
  }
  return { movies, sessions, cinemas };
}

async function fetchHtml(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-AE,en;q=0.9",
          "user-agent": "VOXI-UAE-showtime-refresh/1.0",
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (!/<html\b/iu.test(html)) throw new Error("response was not an HTML page");
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolveWait) => setTimeout(resolveWait, 400 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${label} failed: ${lastError?.message || "unknown error"}`);
}

async function mapLimit(values, workers, callback) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index], index);
    }
  }));
  return results;
}

async function readJsonIfPresent(path) {
  if (!path || !existsSync(path)) return null;
  return readFile(path, "utf8").then(JSON.parse);
}

function normalizedName(value) {
  return plainText(value).toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function mergeCinemaMap(encountered, options, previous = {}) {
  const result = { ...encountered };
  const assignedNames = new Set(Object.values(result).map(normalizedName));
  const previousEntries = Object.entries(previous);
  for (const option of options) {
    const target = normalizedName(option.name);
    if (assignedNames.has(target)) continue;
    const match = previousEntries.find(([, name]) => {
      const candidate = normalizedName(name);
      return candidate === target || candidate.startsWith(target) || target.startsWith(candidate);
    });
    if (match && !result[match[0]]) {
      result[match[0]] = option.name;
      assignedNames.add(target);
    }
  }
  if (Object.keys(result).length < 20) {
    for (const [code, name] of previousEntries) if (!result[code]) result[code] = name;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function deduplicateSessions(rawSessions) {
  const sessions = new Map();
  let duplicates = 0;
  for (const session of rawSessions) {
    const key = [session.code, session.cinemaCode, session.sessionId, session.showtime].join("\u001f");
    if (sessions.has(key)) duplicates += 1;
    else sessions.set(key, session);
  }
  return {
    sessions: [...sessions.values()].sort((left, right) => left.programmingDate.localeCompare(right.programmingDate)
      || left.cinemaCode.localeCompare(right.cinemaCode)
      || left.code.localeCompare(right.code)
      || left.showtime.localeCompare(right.showtime)),
    duplicates,
  };
}

function mergeMovieInformation(previous, discoveredMovies, whatsOnMovies, fetchedAt, workers, detailFailureCount = 0) {
  const byCode = new Map();
  for (const movie of previous?.movies || []) {
    const runtime = Number(movie.runtime) || 0;
    byCode.set(movie.code, {
      ...movie,
      runtimeStatus: runtime > 0 ? "retained_official_detail_page" : "not_published",
    });
  }
  const currentMovies = new Map([...whatsOnMovies, ...discoveredMovies].map((movie) => [movie.code, movie]));
  for (const current of currentMovies.values()) {
    const prior = byCode.get(current.code);
    const movieUrl = current.slug || prior?.movieUrl || "";
    const hasFreshRuntime = current.detailVerified === true && Number(current.runtime) > 0;
    const runtime = hasFreshRuntime ? Number(current.runtime) : Number(prior?.runtime) || 0;
    byCode.set(current.code, {
      code: current.code,
      title: current.title || prior?.title || "",
      rating: current.rating || prior?.rating || "",
      language: current.language || prior?.language || prior?.languageName || "",
      languageName: current.language || prior?.languageName || prior?.language || "",
      runtime,
      genres: Array.isArray(current.genres) && current.genres.length ? current.genres : Array.isArray(prior?.genres) ? prior.genres : [],
      synopsis: current.synopsis || prior?.synopsis || "",
      subtitles: Array.isArray(prior?.subtitles) ? prior.subtitles : [],
      released: current.released || prior?.released || "",
      movieUrl,
      sourcePageUrl: `${SITE}/movies/${movieUrl}`,
      sourceUrl: MOVIE_INFORMATION_SOURCE_URL,
      runtimeStatus: hasFreshRuntime ? "official_detail_page" : runtime > 0 ? "retained_official_detail_page" : "not_published",
      ...(runtime > 0 ? {
        runtimeSourceUrl: hasFreshRuntime ? `${SITE}/movies/${movieUrl}` : prior.runtimeSourceUrl || prior.sourcePageUrl || `${SITE}/movies/${movieUrl}`,
        runtimeVerifiedAt: hasFreshRuntime ? fetchedAt : prior.runtimeVerifiedAt || previous?.extractedAt || fetchedAt,
      } : {}),
    });
  }
  const movies = [...byCode.values()].sort((left, right) => left.title.localeCompare(right.title) || left.code.localeCompare(right.code));
  const retainedCount = movies.filter((movie) => movie.runtimeStatus === "retained_official_detail_page").length;
  const requestedCount = movies.filter((movie) => movie.runtimeStatus !== "content_api").length;
  return {
    format: MOVIE_INFORMATION_FORMAT,
    extractedAt: fetchedAt,
    region: REGION,
    sourceUrl: MOVIE_INFORMATION_SOURCE_URL,
    sourcePageUrl: MOVIE_INFORMATION_PAGE_URL,
    sourceRecordCount: movies.length,
    acceptedRecordCount: movies.length,
    rejectedRecordCount: 0,
    movies,
    detailPageRuntimeEnrichment: {
      workers,
      retries: 1,
      totalTimeoutMs: 120_000,
      requestedCount,
      enrichedCount: movies.filter((movie) => movie.runtimeStatus === "official_detail_page").length,
      failedCount: detailFailureCount,
      timedOutCount: 0,
      retainedCount,
    },
  };
}

function buildScheduleCatalog(discoveredMovies, whatsOnMovies, previousSchedule, previousInformation, sessions) {
  const whatsOnByCode = new Map(whatsOnMovies.map((movie) => [movie.code, movie]));
  const previousScheduleByCode = new Map((previousSchedule?.catalog || []).map((movie) => [movie.code, movie]));
  const previousInformationByCode = new Map((previousInformation?.movies || []).map((movie) => [movie.code, movie]));
  const experiencesByCode = new Map();
  for (const session of sessions) {
    if (!experiencesByCode.has(session.code)) experiencesByCode.set(session.code, new Set());
    experiencesByCode.get(session.code).add(session.experience);
  }
  return discoveredMovies.map((current) => {
    const prior = previousScheduleByCode.get(current.code) || previousInformationByCode.get(current.code) || {};
    const listing = whatsOnByCode.get(current.code) || {};
    const posterUrl = listing.posterUrl || "";
    const language = current.language || listing.language || prior.languageName || prior.language || "";
    const movieUrl = current.slug || listing.slug || prior.movieUrl || "";
    const images = posterUrl ? {
      large: posterUrl,
      medium: posterUrl,
      thumbnail: posterUrl,
      largeMobile: posterUrl,
      mediumMobile: posterUrl,
    } : {};
    return {
      code: current.code,
      title: current.title || listing.title || prior.title || "",
      rating: current.rating || listing.rating || prior.rating || "",
      language,
      languageName: language,
      languages: language ? [language] : [],
      runtime: current.runtime || Number(prior.runtime) || 0,
      genres: Array.isArray(current.genres) && current.genres.length
        ? current.genres
        : Array.isArray(listing.genres) && listing.genres.length
          ? listing.genres
          : Array.isArray(prior.genres) ? prior.genres : [],
      synopsis: current.synopsis || listing.synopsis || prior.synopsis || "",
      subtitles: Array.isArray(prior.subtitles) ? prior.subtitles : [],
      released: prior.released || "",
      movieUrl,
      sourcePageUrl: `${SITE}/movies/${movieUrl}`,
      sourceUrl: SHOWTIMES_URL,
      categories: ["NowShowing"],
      experiences: [...(experiencesByCode.get(current.code) || [])].sort(),
      images,
      posterUrl,
      posterStatus: posterUrl ? "official" : "missing",
      backdropUrl: current.heroUrl || posterUrl,
    };
  }).sort((left, right) => left.title.localeCompare(right.title) || left.code.localeCompare(right.code));
}

function normalizeCustomerPunctuation(payload) {
  return JSON.parse(JSON.stringify(payload).replace(/[\u2013\u2014]/gu, "-"));
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startDate = args.startDate || uaeToday();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(startDate)) throw new Error("--start-date must use YYYY-MM-DD");
  const fetchedAt = new Date().toISOString();
  const [previousSchedule, previousInformation, landingHtml, whatsOnHtml] = await Promise.all([
    readJsonIfPresent(resolve(args.previousSchedule)),
    readJsonIfPresent(resolve(args.previousMovieInformation)),
    fetchHtml(`${SHOWTIMES_URL}?c=mall-of-the-emirates`, "VOX showtimes landing page"),
    fetchHtml(MOVIE_INFORMATION_PAGE_URL, "VOX movie listing"),
  ]);
  const cinemaOptions = parseCinemaOptions(landingHtml);
  if (cinemaOptions.length < 20) throw new Error(`official showtimes page exposed only ${cinemaOptions.length} cinemas`);
  const dates = parseShowtimeDateLinks(landingHtml)
    .filter((date) => date >= startDate && dateDistance(startDate, date) < args.maxDays);
  if (dates.length < 2 || !dates.includes(startDate) || !dates.includes(addDays(startDate, 1))) {
    throw new Error(`official showtimes page did not expose complete today/tomorrow coverage from ${startDate}`);
  }
  const pages = await mapLimit(dates, args.workers, async (date) => {
    const params = new URLSearchParams();
    for (const cinema of cinemaOptions) params.append("c", cinema.slug);
    params.set("d", compactDate(date));
    const url = `${SHOWTIMES_URL}?${params}`;
    const html = await fetchHtml(url, `VOX showtimes ${date}`);
    return parseShowtimePage(html, date);
  });
  const rawSessions = pages.flatMap((page) => page.sessions);
  const { sessions, duplicates } = deduplicateSessions(rawSessions);
  const discoveredByCode = new Map();
  for (const page of pages) {
    for (const movie of page.movies) {
      const previous = discoveredByCode.get(movie.code);
      if (!previous) discoveredByCode.set(movie.code, movie);
      else {
        for (const experience of movie.experiences) previous.experiences.add(experience);
        if (!previous.heroUrl && movie.heroUrl) previous.heroUrl = movie.heroUrl;
      }
    }
  }
  const scheduledCodes = new Set(sessions.map((session) => session.code));
  const discoveredMovies = [...discoveredByCode.values()].filter((movie) => scheduledCodes.has(movie.code));
  const whatsOnMovies = parseWhatsOnCatalog(whatsOnHtml);
  const previousInformationByCode = new Map((previousInformation?.movies || []).map((movie) => [movie.code, movie]));
  const currentSeeds = new Map();
  for (const movie of [...whatsOnMovies, ...discoveredMovies]) {
    currentSeeds.set(movie.code, { ...(currentSeeds.get(movie.code) || {}), ...movie });
  }
  const detailTargets = [...currentSeeds.values()].filter((movie) => {
    const previous = previousInformationByCode.get(movie.code);
    return !previous
      || !Array.isArray(previous.genres) || !previous.genres.length
      || !String(previous.synopsis || "").trim()
      || Number(previous.runtime) <= 0;
  });
  const detailOutcomes = await mapLimit(detailTargets, args.workers, async (movie) => {
    try {
      const html = await fetchHtml(`${SITE}/movies/${movie.slug}`, `VOX movie details for ${movie.title}`);
      return parseMovieDetail(html, movie);
    } catch (error) {
      console.error(`Movie detail enrichment skipped for ${movie.title}: ${error.message}`);
      return null;
    }
  });
  const detailsByCode = new Map(detailOutcomes.filter(Boolean).map((movie) => [movie.code, movie]));
  const enrichedWhatsOnMovies = whatsOnMovies.map((movie) => ({ ...movie, ...(detailsByCode.get(movie.code) || {}) }));
  const enrichedDiscoveredMovies = discoveredMovies.map((movie) => ({
    ...movie,
    ...(detailsByCode.get(movie.code) || {}),
    code: movie.code,
    slug: movie.slug,
    heroUrl: movie.heroUrl,
    experiences: movie.experiences,
  }));
  const detailFailureCount = detailOutcomes.filter((movie) => !movie).length;
  const cinemas = mergeCinemaMap(
    Object.assign({}, ...pages.map((page) => page.cinemas)),
    cinemaOptions,
    previousSchedule?.cinemas,
  );
  const catalog = buildScheduleCatalog(enrichedDiscoveredMovies, enrichedWhatsOnMovies, previousSchedule, previousInformation, sessions);
  const programmingDates = [...new Set(sessions.map((session) => session.programmingDate))].sort();
  const missingOfficialPosterCodes = catalog.filter((movie) => !movie.posterUrl).map((movie) => movie.code).sort();
  const output = normalizeCustomerPunctuation({
    extractedAt: fetchedAt,
    region: REGION,
    programmingDates,
    catalog,
    cinemas,
    sessions,
    experienceMedia: [],
    offerMedia: [],
    crawl: {
      startDate,
      maxDays: args.maxDays,
      discoveredProgrammingDates: programmingDates,
      lastAvailableDate: programmingDates.at(-1),
      stopReason: "official-server-rendered-showtimes-exhausted",
      complete: true,
      candidateMovieCount: enrichedWhatsOnMovies.length,
      scheduledMovieCount: catalog.length,
      requestedSessionCalls: dates.length,
      rawSessionCount: rawSessions.length,
      duplicateCount: duplicates,
      sourceMissingOfficialPosterCodes: missingOfficialPosterCodes,
      missingOfficialPosterCodes,
      retainedMoviePosterCodes: [],
      retainedMoviePosterCount: 0,
      freshExperienceMediaCount: 0,
      freshOfferMediaCount: 0,
      experienceMediaPartialResponse: true,
      offerMediaPartialResponse: true,
      retainedExperienceMediaCount: 0,
      retainedOfferMediaCount: 0,
      sessionsByProgrammingDate: Object.fromEntries(programmingDates.map((date) => [date, sessions.filter((session) => session.programmingDate === date).length])),
    },
    provenance: {
      schedulePageUrl: SHOWTIMES_URL,
      moviePageUrl: MOVIE_INFORMATION_PAGE_URL,
      experiencePageUrl: `${SITE}/ways-to-watch`,
      offerPageUrl: `${SITE}/offers/bank-deals`,
      note: "Remote artwork remains owned by its respective rights holders and is retained with first-party source attribution.",
    },
  });
  const movieInformation = normalizeCustomerPunctuation(mergeMovieInformation(
    previousInformation,
    enrichedDiscoveredMovies,
    enrichedWhatsOnMovies,
    fetchedAt,
    args.workers,
    detailFailureCount,
  ));
  validateSchedule(output);
  validateMovieInformationCatalog(movieInformation, { now: new Date(fetchedAt), previousCatalog: previousInformation });
  validateScheduledMovieCoverage(movieInformation, output);
  await Promise.all([
    writeFile(resolve(args.output), `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(resolve(args.movieInformationOutput), `${JSON.stringify(movieInformation, null, 2)}\n`, "utf8"),
  ]);
  console.error(`Extracted ${sessions.length} official sessions for ${catalog.length} movies at ${Object.keys(cinemas).length} cinemas across ${programmingDates.length} dates.`);
}

if (resolve(process.argv[1] || "") === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`FATAL: ${error.message}`);
    process.exitCode = 1;
  });
}
