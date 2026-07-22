export const MOVIE_INFORMATION_FORMAT = "vox-official-movie-information-v1";
export const MOVIE_INFORMATION_SOURCE_URL = "https://uae-apife.voxcinemas.com/v1/vox2-0/content/movies?region=UAE";
export const MOVIE_INFORMATION_PAGE_URL = "https://uae.voxcinemas.com/movies/whatson";

const FORBIDDEN_CUSTOMER_DASHES = /[\u2013\u2014]/u;
const AVAILABILITY_FIELDS = new Set([
  "availableDates",
  "cinemas",
  "experiences",
  "sessions",
  "showtimes",
]);

function normalizedTitle(value) {
  return String(value || "").trim().normalize("NFKC").toLocaleLowerCase("en");
}

export function validateMovieInformationCatalog(
  payload,
  {
    minimumMovies = 80,
    now = new Date(),
    maximumAgeHours = 48,
    requireReferenceTitles = true,
  } = {},
) {
  const errors = [];
  const movies = Array.isArray(payload?.movies) ? payload.movies : [];
  const extractedAt = new Date(payload?.extractedAt || "");
  const ageMs = now.valueOf() - extractedAt.valueOf();

  if (payload?.format !== MOVIE_INFORMATION_FORMAT) errors.push(`format must be ${MOVIE_INFORMATION_FORMAT}`);
  if (payload?.region !== "UAE") errors.push("region must be UAE");
  if (payload?.sourceUrl !== MOVIE_INFORMATION_SOURCE_URL) errors.push("sourceUrl must identify the official VOX UAE content API");
  if (payload?.sourcePageUrl !== MOVIE_INFORMATION_PAGE_URL) errors.push("sourcePageUrl must identify the official VOX UAE movies page");
  if (Number.isNaN(extractedAt.valueOf())) errors.push("extractedAt must be a valid ISO timestamp");
  else {
    if (ageMs < -10 * 60 * 1000) errors.push("extractedAt must not be in the future");
    if (Number.isFinite(maximumAgeHours) && ageMs > maximumAgeHours * 60 * 60 * 1000) {
      errors.push(`movie information catalog is older than ${maximumAgeHours} hours`);
    }
  }
  if (movies.length < minimumMovies) errors.push(`official content catalog returned only ${movies.length} movies; expected at least ${minimumMovies}`);

  const codes = new Set();
  const titles = new Map();
  for (const movie of movies) {
    const code = String(movie?.code || "").trim();
    const title = String(movie?.title || "").trim();
    if (!code || !title) errors.push("each movie must contain a code and title");
    if (code && codes.has(code)) errors.push(`duplicate movie code: ${code}`);
    codes.add(code);
    const titleKey = normalizedTitle(title);
    if (titleKey) titles.set(titleKey, movie);
    if (movie?.sourceUrl !== MOVIE_INFORMATION_SOURCE_URL) errors.push(`${code || title || "unknown movie"} has non-official source provenance`);
    if (!/^https:\/\/uae\.voxcinemas\.com\/movies\//u.test(String(movie?.sourcePageUrl || ""))) {
      errors.push(`${code || title || "unknown movie"} is missing an official VOX UAE movie page`);
    }
    for (const field of AVAILABILITY_FIELDS) {
      if (Object.hasOwn(movie || {}, field)) errors.push(`${code || title || "unknown movie"} contains availability field ${field}`);
    }
    if (Number(movie?.runtime) > 0) {
      const runtimeSourceUrl = String(movie?.runtimeSourceUrl || "");
      if (runtimeSourceUrl !== MOVIE_INFORMATION_SOURCE_URL && !/^https:\/\/uae\.voxcinemas\.com\/movies\//u.test(runtimeSourceUrl)) {
        errors.push(`${code || title || "unknown movie"} has runtime without official source provenance`);
      }
    }
    if (FORBIDDEN_CUSTOMER_DASHES.test(JSON.stringify(movie))) errors.push(`${code || title || "unknown movie"} contains a forbidden customer-facing dash`);
  }

  if (requireReferenceTitles) {
    const ezma = movies.find((movie) => movie.code === "HO00015828" || normalizedTitle(movie.title) === "ezma");
    if (!ezma) errors.push("official catalog must include the current reference title Ezma");
    else {
      if (ezma.code !== "HO00015828") errors.push("Ezma must retain official code HO00015828");
      if (ezma.rating !== "PG15") errors.push("Ezma must retain the official PG15 age rating");
      if (ezma.runtime !== 105) errors.push("Ezma must retain the official 105 minute runtime");
      if (ezma.runtimeSourceUrl !== "https://uae.voxcinemas.com/movies/ezma-arabic") errors.push("Ezma runtime must cite its official VOX UAE detail page");
    }
    if (!titles.has("the odyssey")) errors.push("official catalog must include the current reference title The Odyssey");
  }

  const enrichment = payload?.detailPageRuntimeEnrichment;
  if (!enrichment || !Number.isInteger(enrichment.requestedCount)) errors.push("detail-page runtime enrichment statistics are missing");
  else {
    if (enrichment.workers < 1 || enrichment.workers > 4) errors.push("detail-page runtime enrichment worker count is outside the safe bound");
    if (enrichment.retries < 1 || enrichment.retries > 2) errors.push("detail-page runtime enrichment retry count is outside the safe bound");
    if (enrichment.totalTimeoutMs < 1 || enrichment.totalTimeoutMs > 120000) errors.push("detail-page runtime enrichment total timeout is outside the safe bound");
  }

  if (errors.length) throw new Error(`Movie information catalog validation failed:\n- ${[...new Set(errors)].join("\n- ")}`);
  return payload;
}
