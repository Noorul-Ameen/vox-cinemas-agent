#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mergeMovieInformationCatalog } from "../src/lib/movieInformationCatalog.js";
import {
  MOVIE_INFORMATION_FORMAT,
  MOVIE_INFORMATION_SOURCE_URL,
  validateMovieInformationCatalog,
} from "./lib/movieInformationCatalogValidation.mjs";

const informationPath = resolve(process.argv[2] || "data/vox_movie_information_catalog.json");
const schedulePath = resolve(process.argv[3] || "data/vox_showtimes_full.json");
const [information, schedule] = await Promise.all([
  readFile(informationPath, "utf8").then(JSON.parse),
  readFile(schedulePath, "utf8").then(JSON.parse),
]);

validateMovieInformationCatalog(information);
assert.equal(information.format, MOVIE_INFORMATION_FORMAT);
assert.equal(information.sourceUrl, MOVIE_INFORMATION_SOURCE_URL);

const merged = mergeMovieInformationCatalog(schedule.catalog, information.movies);
const janaNayaganVariants = merged.filter((movie) => movie.title === "Jana Nayagan");
assert.deepEqual(janaNayaganVariants.map((movie) => movie.id), ["HO00015542", "HO00015544"], "same-title official variants must remain distinct by code");
assert.deepEqual(janaNayaganVariants.map((movie) => movie.languageName), ["Tamil", "Hindi"], "Jana Nayagan must retain both official language variants");
const toxicVariants = merged.filter((movie) => movie.title === "Toxic");
assert.deepEqual(toxicVariants.map((movie) => movie.id), ["HO00015725", "HO00015727", "HO00015731", "HO00015757"], "Toxic must retain all official code variants");
assert.deepEqual(toxicVariants.map((movie) => movie.languageName), ["Kannada", "Hindi", "Tamil", "Malayalam"], "Toxic must retain all official language variants");
const mergedByTitle = new Map(merged.map((movie) => [movie.title.normalize("NFKC").toLocaleLowerCase("en"), movie]));
const mergedById = new Map(merged.map((movie) => [movie.id, movie]));
for (const currentMovie of schedule.catalog) {
  assert.ok(currentMovie.code, `${currentMovie.title}: every current schedule variant must have a stable code`);
  const mergedMovie = mergedById.get(currentMovie.code);
  assert.ok(mergedMovie, `merged information catalog lost current scheduled variant ${currentMovie.title} (${currentMovie.code})`);
  assert.equal(mergedMovie.id, currentMovie.code, `${currentMovie.title}: current schedule code must take precedence`);
  assert.equal(mergedMovie.rating, currentMovie.rating, `${currentMovie.title}: current schedule rating must take precedence`);
  assert.equal(mergedMovie.runtime, currentMovie.runtime, `${currentMovie.title}: current schedule runtime must take precedence`);
}

const ezma = mergedByTitle.get("ezma");
assert.ok(ezma, "information-only title Ezma must remain answerable outside the current session schedule");
assert.equal(ezma.rating, "PG15");
assert.equal(ezma.runtime, 105);
assert.equal(ezma.runtimeSourceUrl, "https://uae.voxcinemas.com/movies/ezma-arabic");
const currentWithMetadataGaps = { ...ezma, rating: "PG", runtime: 106, synopsis: "", genres: [] };
const preservedFallback = mergeMovieInformationCatalog([currentWithMetadataGaps], [ezma]).find((movie) => movie.title === "Ezma");
assert.equal(preservedFallback.rating, "PG", "populated current schedule facts must win");
assert.equal(preservedFallback.runtime, 106, "populated current schedule runtime must win");
assert.equal(preservedFallback.synopsis, ezma.synopsis, "an empty current synopsis must not erase official fallback information");
assert.deepEqual(preservedFallback.genres, ezma.genres, "an empty current genre list must not erase official fallback information");

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
assert.match(extractorSource, /MOVIE_DETAIL_TOTAL_TIMEOUT_MS = 120000/u);
assert.match(extractorSource, /retainPreviouslyVerifiedRuntimes/u);
assert.match(refreshSource, /\[currentMovieInformation, nextMovieInformation, backupMovieInformation\]/u, "the daily refresh transaction must include the information catalog");
assert.match(refreshSource, /"--movie-information-output", nextMovieInformation/u);
assert.match(refreshSource, /"--previous-movie-information", currentMovieInformation/u);
assert.match(refreshSource, /validateMovieInformationCatalog\.mjs/u);
assert.match(refreshSource, /for \(const \[currentPath, , backupPath\] of assetPairs\)/u, "rollback must restore every asset in the refresh transaction");
const workflowCatalogMentions = workflowSource.match(/data\/vox_movie_information_catalog\.json/gu) || [];
assert.ok(workflowCatalogMentions.length >= 2, "the daily workflow must detect and stage information catalog changes");

console.log(`Validated ${information.movies.length} official information-only movies, provenance, Ezma coverage, session separation, schedule precedence, and daily atomic refresh integration.`);
