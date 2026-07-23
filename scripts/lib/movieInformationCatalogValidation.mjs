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
const OFFICIAL_MOVIE_PAGE = /^https:\/\/uae\.voxcinemas\.com\/movies\/[^/?#]+\/?$/u;
const RUNTIME_STATUSES = new Set([
  "content_api",
  "official_detail_page",
  "retained_official_detail_page",
  "not_published",
  "fetch_failed",
  "deadline_exceeded",
]);
const DEFAULT_METADATA_COVERAGE = Object.freeze({
  rating: 0.8,
  language: 0.8,
  genres: 0.8,
  synopsis: 0.7,
});

export function validateMovieInformationCatalog(
  payload,
  {
    minimumMovies = 80,
    now = new Date(),
    maximumAgeHours = 48,
    previousCatalog = null,
    maximumCatalogDropRatio = 0.25,
    minimumMetadataCoverage = DEFAULT_METADATA_COVERAGE,
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
  if (Array.isArray(previousCatalog?.movies) && previousCatalog.movies.length) {
    const minimumContinuityCount = Math.ceil(previousCatalog.movies.length * (1 - maximumCatalogDropRatio));
    if (movies.length < minimumContinuityCount) {
      errors.push(`official content catalog count dropped more than ${Math.round(maximumCatalogDropRatio * 100)}% (${previousCatalog.movies.length} to ${movies.length})`);
    }
  }

  const accountingFields = ["sourceRecordCount", "acceptedRecordCount", "rejectedRecordCount"];
  const hasSourceAccounting = accountingFields.some((field) => Number.isInteger(payload?.[field]));
  if (hasSourceAccounting) {
    for (const field of accountingFields) {
      if (!Number.isInteger(payload?.[field]) || payload[field] < 0) errors.push(`${field} must be a non-negative integer`);
    }
    if (Number.isInteger(payload?.acceptedRecordCount) && payload.acceptedRecordCount !== movies.length) {
      errors.push("acceptedRecordCount must equal the published movie count");
    }
    if (
      accountingFields.every((field) => Number.isInteger(payload?.[field]))
      && payload.sourceRecordCount !== payload.acceptedRecordCount + payload.rejectedRecordCount
    ) {
      errors.push("source record accounting does not reconcile");
    }
    if (Number(payload?.rejectedRecordCount) > 0) errors.push("official source records were rejected during normalization");
  }

  const codes = new Set();
  const metadataCounts = {
    rating: 0,
    language: 0,
    genres: 0,
    synopsis: 0,
  };
  const runtimeStatusCounts = new Map();
  for (const movie of movies) {
    const code = String(movie?.code || "").trim();
    const title = String(movie?.title || "").trim();
    if (!code || !title) errors.push("each movie must contain a code and title");
    if (code && codes.has(code)) errors.push(`duplicate movie code: ${code}`);
    codes.add(code);
    if (movie?.sourceUrl !== MOVIE_INFORMATION_SOURCE_URL) errors.push(`${code || title || "unknown movie"} has non-official source provenance`);
    const sourcePageUrl = String(movie?.sourcePageUrl || "");
    const movieUrl = String(movie?.movieUrl || "").replace(/^\/+|\/+$/gu, "");
    if (!OFFICIAL_MOVIE_PAGE.test(sourcePageUrl)) {
      errors.push(`${code || title || "unknown movie"} is missing an official VOX UAE movie page`);
    }
    if (!movieUrl) errors.push(`${code || title || "unknown movie"} is missing its official movie route`);
    else if (sourcePageUrl !== `https://uae.voxcinemas.com/movies/${movieUrl}`) {
      errors.push(`${code || title || "unknown movie"} official movie route and source page do not match`);
    }
    for (const field of AVAILABILITY_FIELDS) {
      if (Object.hasOwn(movie || {}, field)) errors.push(`${code || title || "unknown movie"} contains availability field ${field}`);
    }
    if (String(movie?.rating || "").trim()) metadataCounts.rating += 1;
    if (String(movie?.languageName || movie?.language || "").trim()) metadataCounts.language += 1;
    if (Array.isArray(movie?.genres) && movie.genres.length) metadataCounts.genres += 1;
    if (String(movie?.synopsis || "").trim()) metadataCounts.synopsis += 1;

    const runtimeStatus = String(movie?.runtimeStatus || "");
    runtimeStatusCounts.set(runtimeStatus, (runtimeStatusCounts.get(runtimeStatus) || 0) + 1);
    if (!RUNTIME_STATUSES.has(runtimeStatus)) errors.push(`${code || title || "unknown movie"} has an invalid runtime status`);
    if (Number(movie?.runtime) > 0) {
      const runtimeSourceUrl = String(movie?.runtimeSourceUrl || "");
      if (runtimeSourceUrl !== MOVIE_INFORMATION_SOURCE_URL && !OFFICIAL_MOVIE_PAGE.test(runtimeSourceUrl)) {
        errors.push(`${code || title || "unknown movie"} has runtime without official source provenance`);
      }
      if (runtimeStatus === "content_api" && runtimeSourceUrl !== MOVIE_INFORMATION_SOURCE_URL) {
        errors.push(`${code || title || "unknown movie"} content API runtime must cite the official content API`);
      }
      if (runtimeStatus === "official_detail_page" && runtimeSourceUrl !== sourcePageUrl) {
        errors.push(`${code || title || "unknown movie"} detail-page runtime must cite its own official movie page`);
      }
    } else if (["content_api", "official_detail_page", "retained_official_detail_page"].includes(runtimeStatus)) {
      errors.push(`${code || title || "unknown movie"} has a verified runtime status without a runtime`);
    }
    if (FORBIDDEN_CUSTOMER_DASHES.test(JSON.stringify(movie))) errors.push(`${code || title || "unknown movie"} contains a forbidden customer-facing dash`);
  }

  for (const [field, minimumRatio] of Object.entries(minimumMetadataCoverage)) {
    if (!movies.length || !Number.isFinite(minimumRatio)) continue;
    const actualRatio = (metadataCounts[field] || 0) / movies.length;
    if (actualRatio < minimumRatio) {
      errors.push(`${field} metadata coverage is ${(actualRatio * 100).toFixed(1)}%; expected at least ${(minimumRatio * 100).toFixed(0)}%`);
    }
  }

  const enrichment = payload?.detailPageRuntimeEnrichment;
  if (!enrichment || !Number.isInteger(enrichment.requestedCount)) errors.push("detail-page runtime enrichment statistics are missing");
  else {
    if (enrichment.workers < 1 || enrichment.workers > 4) errors.push("detail-page runtime enrichment worker count is outside the safe bound");
    if (enrichment.retries < 1 || enrichment.retries > 2) errors.push("detail-page runtime enrichment retry count is outside the safe bound");
    if (enrichment.totalTimeoutMs < 1 || enrichment.totalTimeoutMs > 120000) errors.push("detail-page runtime enrichment total timeout is outside the safe bound");
    for (const field of ["requestedCount", "enrichedCount", "failedCount", "timedOutCount", "retainedCount"]) {
      if (!Number.isInteger(enrichment[field]) || enrichment[field] < 0) errors.push(`detail-page runtime enrichment ${field} must be a non-negative integer`);
    }
    const requestedStatusCount = movies.length - (runtimeStatusCounts.get("content_api") || 0);
    if (enrichment.requestedCount !== requestedStatusCount) errors.push("detail-page runtime enrichment requested count does not reconcile with movie statuses");
    if (enrichment.enrichedCount !== (runtimeStatusCounts.get("official_detail_page") || 0)) {
      errors.push("detail-page runtime enrichment enriched count does not reconcile with movie statuses");
    }
    if (enrichment.retainedCount !== (runtimeStatusCounts.get("retained_official_detail_page") || 0)) {
      errors.push("detail-page runtime enrichment retained count does not reconcile with movie statuses");
    }
    if (enrichment.failedCount < (runtimeStatusCounts.get("fetch_failed") || 0)) {
      errors.push("detail-page runtime enrichment failed count is lower than the recorded failed statuses");
    }
    if (enrichment.timedOutCount < (runtimeStatusCounts.get("deadline_exceeded") || 0)) {
      errors.push("detail-page runtime enrichment timed-out count is lower than the recorded timeout statuses");
    }
    if (enrichment.enrichedCount + enrichment.failedCount + enrichment.timedOutCount > enrichment.requestedCount) {
      errors.push("detail-page runtime enrichment outcome counts exceed the requested count");
    }
  }

  if (errors.length) throw new Error(`Movie information catalog validation failed:\n- ${[...new Set(errors)].join("\n- ")}`);
  return payload;
}

export function validateScheduledMovieCoverage(payload, schedule) {
  const informationCodes = new Set((payload?.movies || []).map((movie) => String(movie?.code || "").trim()).filter(Boolean));
  const scheduledMovies = Array.isArray(schedule?.catalog) ? schedule.catalog : [];
  const missing = scheduledMovies
    .filter((movie) => !informationCodes.has(String(movie?.code || "").trim()))
    .map((movie) => `${movie?.code || "missing-code"} (${movie?.title || "missing title"})`);
  if (missing.length) {
    throw new Error(`Movie information catalog validation failed:\n- current scheduled movies are missing from the official information catalog: ${missing.join(", ")}`);
  }
  return payload;
}
