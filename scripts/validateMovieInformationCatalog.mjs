#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mergeMovieInformationCatalog } from "../src/lib/movieInformationCatalog.js";
import {
  MOVIE_INFORMATION_FORMAT,
  MOVIE_INFORMATION_SOURCE_URL,
  validateMovieInformationCatalog,
  validateScheduledMovieCoverage,
} from "./lib/movieInformationCatalogValidation.mjs";
import { parseShowtimeDateLinks } from "./extractVoxShowtimesHtml.mjs";

const informationPath = resolve(process.argv[2] || "data/vox_movie_information_catalog.json");
const schedulePath = resolve(process.argv[3] || "data/vox_showtimes_full.json");
const previousInformationPath = process.argv[4] ? resolve(process.argv[4]) : null;
const [information, schedule, previousInformation] = await Promise.all([
  readFile(informationPath, "utf8").then(JSON.parse),
  readFile(schedulePath, "utf8").then(JSON.parse),
  previousInformationPath && existsSync(previousInformationPath)
    ? readFile(previousInformationPath, "utf8").then(JSON.parse)
    : null,
]);

validateMovieInformationCatalog(information, { previousCatalog: previousInformation });
validateScheduledMovieCoverage(information, schedule);
assert.equal(information.format, MOVIE_INFORMATION_FORMAT);
assert.equal(information.sourceUrl, MOVIE_INFORMATION_SOURCE_URL);

const merged = mergeMovieInformationCatalog(schedule.catalog, information.movies);
const mergedById = new Map(merged.map((movie) => [movie.id, movie]));
for (const currentMovie of schedule.catalog) {
  assert.ok(currentMovie.code, `${currentMovie.title}: every current schedule variant must have a stable code`);
  const mergedMovie = mergedById.get(currentMovie.code);
  assert.ok(mergedMovie, `merged information catalog lost current scheduled variant ${currentMovie.title} (${currentMovie.code})`);
  assert.equal(mergedMovie.id, currentMovie.code, `${currentMovie.title}: current schedule code must take precedence`);
  assert.equal(mergedMovie.rating, currentMovie.rating, `${currentMovie.title}: current schedule rating must take precedence`);
  assert.equal(mergedMovie.runtime, currentMovie.runtime, `${currentMovie.title}: current schedule runtime must take precedence`);
}

const referenceVariants = [
  { id: "fixture-tamil", title: "Catalog Fixture", languageName: "Tamil", rating: "PG", runtime: 100 },
  { id: "fixture-hindi", title: "Catalog Fixture", languageName: "Hindi", rating: "PG13", runtime: 110 },
];
const mergedReferenceVariants = mergeMovieInformationCatalog([], referenceVariants).filter((movie) => movie.title === "Catalog Fixture");
assert.deepEqual(mergedReferenceVariants.map((movie) => movie.id), ["fixture-tamil", "fixture-hindi"], "same-title official variants must remain distinct by code");
assert.deepEqual(mergedReferenceVariants.map((movie) => movie.languageName), ["Tamil", "Hindi"], "same-title official variants must retain their language identity");

const officialFallback = {
  id: "fixture-fallback",
  title: "Fallback Fixture",
  rating: "PG13",
  runtime: 105,
  synopsis: "Verified official synopsis.",
  genres: ["Drama", "Romance"],
};
const currentWithMetadataGaps = { ...officialFallback, rating: "PG", runtime: 106, synopsis: "", genres: [] };
const preservedFallback = mergeMovieInformationCatalog([currentWithMetadataGaps], [officialFallback]).find((movie) => movie.id === "fixture-fallback");
assert.equal(preservedFallback.rating, "PG", "populated current schedule facts must win");
assert.equal(preservedFallback.runtime, 106, "populated current schedule runtime must win");
assert.equal(preservedFallback.synopsis, officialFallback.synopsis, "an empty current synopsis must not erase official fallback information");
assert.deepEqual(preservedFallback.genres, officialFallback.genres, "an empty current genre list must not erase official fallback information");

const validationNow = new Date(information.extractedAt);
function catalogWithMovies(payload, movies) {
  const statusCount = (status) => movies.filter((movie) => movie.runtimeStatus === status).length;
  const sourceAccounting = Number.isInteger(payload.sourceRecordCount)
    ? {
        sourceRecordCount: movies.length,
        acceptedRecordCount: movies.length,
        rejectedRecordCount: 0,
      }
    : {};
  return {
    ...payload,
    ...sourceAccounting,
    movies,
    detailPageRuntimeEnrichment: {
      ...payload.detailPageRuntimeEnrichment,
      requestedCount: movies.length - statusCount("content_api"),
      enrichedCount: statusCount("official_detail_page"),
      failedCount: statusCount("fetch_failed"),
      timedOutCount: statusCount("deadline_exceeded"),
      retainedCount: statusCount("retained_official_detail_page"),
    },
  };
}
const withoutFormerReferences = {
  ...catalogWithMovies(information, information.movies.filter((movie) => !["Ezma", "The Odyssey"].includes(movie.title))),
};
validateMovieInformationCatalog(withoutFormerReferences, {
  minimumMovies: Math.min(80, withoutFormerReferences.movies.length),
  now: validationNow,
});

const truncated = {
  ...information,
  movies: information.movies.slice(0, 20),
};
assert.throws(
  () => validateMovieInformationCatalog(truncated, { now: validationNow }),
  /returned only 20 movies/u,
  "a small but structurally valid partial API response must be rejected",
);

const provenanceGap = structuredClone(information);
provenanceGap.movies[0].sourceUrl = "https://example.invalid/movies";
assert.throws(
  () => validateMovieInformationCatalog(provenanceGap, { now: validationNow }),
  /non-official source provenance/u,
  "a catalog item without official VOX provenance must be rejected",
);

const metadataGap = structuredClone(information);
for (const movie of metadataGap.movies.slice(0, Math.ceil(metadataGap.movies.length * 0.25))) movie.rating = "";
assert.throws(
  () => validateMovieInformationCatalog(metadataGap, { now: validationNow }),
  /rating metadata coverage/u,
  "a catalog-wide metadata collapse must be rejected without relying on a named title",
);

const accounted = {
  ...information,
  sourceRecordCount: information.movies.length,
  acceptedRecordCount: information.movies.length,
  rejectedRecordCount: 0,
};
validateMovieInformationCatalog(accounted, { now: validationNow });
assert.throws(
  () => validateMovieInformationCatalog({ ...accounted, rejectedRecordCount: 1 }, { now: validationNow }),
  /source record accounting does not reconcile|source records were rejected/u,
  "normalization loss must be rejected when source accounting is available",
);

assert.throws(
  () => validateMovieInformationCatalog(information, {
    now: validationNow,
    previousCatalog: { movies: Array.from({ length: Math.ceil(information.movies.length * 1.5) }, () => ({})) },
  }),
  /catalog count dropped more than 25%/u,
  "a large day-over-day catalog collapse must be rejected for manual review",
);

assert.deepEqual(
  parseShowtimeDateLinks('<input type="hidden" name="d" value="20260812"><a href="/showtimes?d=20260813">Tomorrow</a>'),
  ["2026-08-12", "2026-08-13"],
  "the server-rendered fallback must include VOX's hidden current-date value",
);

const missingScheduledMovie = structuredClone(information);
missingScheduledMovie.movies = missingScheduledMovie.movies.filter((movie) => movie.code !== schedule.catalog[0]?.code);
assert.throws(
  () => validateScheduledMovieCoverage(missingScheduledMovie, schedule),
  /current scheduled movies are missing/u,
  "cross-source validation must reject an information catalog that omits a currently scheduled movie",
);

const [loaderSource, vistaSource, mediaSource, extractorSource, refreshSource, workflowSource] = await Promise.all([
  readFile(new URL("../src/lib/movieInformationCatalog.js", import.meta.url), "utf8"),
  readFile(new URL("../src/vistaClient.js", import.meta.url), "utf8"),
  readFile(new URL("../src/mediaData.js", import.meta.url), "utf8"),
  readFile(new URL("./extractVoxShowtimes.mjs", import.meta.url), "utf8"),
  readFile(new URL("./refreshVoxData.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/refresh-vox-showtimes.yml", import.meta.url), "utf8"),
]);
assert.match(loaderSource, /import\("\.\.\/\.\.\/data\/vox_movie_information_catalog\.json"/u, "movie information data must remain a deferred import");
assert.doesNotMatch(loaderSource, /^import\s+.+vox_movie_information_catalog/mu, "movie information data must not enter the initial static module graph");
for (const [name, source] of [["vistaClient", vistaSource], ["mediaData", mediaSource]]) {
  assert.doesNotMatch(source, /vox_movie_information_catalog|vox_showtimes_full\.json/u, `${name} must keep availability session-backed and sharded`);
}
assert.match(extractorSource, /getCatalogBundle\(client, fetchedAt\)/u, "the schedule extractor must reuse its already-fetched official content catalog");
assert.match(extractorSource, /enrichMovieInformationRuntimes\([\s\S]*normalizeMovieInformationCatalog\(contentCatalog, fetchedAt\)/u);
assert.match(extractorSource, /sourceRecordCount:\s*source\.length/u, "the extractor must record official source response accounting");
assert.match(extractorSource, /MOVIE_DETAIL_TOTAL_TIMEOUT_MS = 120000/u);
assert.match(extractorSource, /retainPreviouslyVerifiedRuntimes/u);
assert.match(refreshSource, /\[currentMovieInformation, nextMovieInformation, backupMovieInformation\]/u, "the daily refresh transaction must include the information catalog");
assert.match(refreshSource, /"--movie-information-output", nextMovieInformation/u);
assert.match(refreshSource, /"--previous-movie-information", currentMovieInformation/u);
assert.match(
  refreshSource,
  /validateMovieInformationCatalog\.mjs"\),[\s\S]{0,160}nextMovieInformation,[\s\S]{0,80}nextJson,[\s\S]{0,80}currentMovieInformation/u,
  "refresh validation must compare the new catalog with the previous official catalog",
);
assert.match(refreshSource, /for \(const \[currentPath, , backupPath\] of assetPairs\)/u, "rollback must restore every asset in the refresh transaction");
const workflowCatalogMentions = workflowSource.match(/data\/vox_movie_information_catalog\.json/gu) || [];
assert.ok(workflowCatalogMentions.length >= 2, "the daily workflow must detect and stage information catalog changes");
const officialActionReferences = [...workflowSource.matchAll(/uses:\s*(actions\/[^@\s]+)@([^\s#]+)/gu)];
assert.ok(officialActionReferences.length >= 3, "the daily workflow must declare its official setup actions");
for (const [, action, revision] of officialActionReferences) {
  assert.match(revision, /^[0-9a-f]{40}$/u, `${action} must be pinned to an immutable full commit SHA`);
}

console.log(`Validated ${information.movies.length} current official information movies, provenance, metadata coverage, source accounting, schedule coverage, merge behavior, and daily atomic refresh integration.`);
