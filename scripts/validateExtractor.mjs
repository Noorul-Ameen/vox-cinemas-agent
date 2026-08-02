import assert from "node:assert/strict";
import fs from "node:fs";
import {
  addDays,
  enrichMovieInformationRuntimes,
  flatten,
  isIsoDate,
  parseArgs,
  parseOfficialMovieRuntime,
  retainPreviouslyVerifiedRuntimes,
  uaeToday,
  validate,
} from "./extractVoxShowtimes.mjs";
import { retainMediaOnPartialResponse, retainPreviouslyVerifiedPosters } from "./refreshRetention.mjs";
import { validateShowtimeRefresh } from "./validateShowtimeRefresh.mjs";

assert.equal(uaeToday(new Date("2026-07-13T20:30:00Z")), "2026-07-14", "Dubai calendar date must not use host or UTC midnight");
assert.equal(addDays("2026-07-14", 1), "2026-07-15");
assert.equal(isIsoDate("2026-02-29"), false, "impossible calendar dates must be rejected");
assert.equal(isIsoDate("2028-02-29"), true);
assert.match(fs.readFileSync(new URL("./extractVoxShowtimes.mjs", import.meta.url), "utf8"), /authenticate\(\{ rediscoverKey: authAttempt === 1 \}\)/, "a repeated 401 must rediscover the rotating public browser key");
assert.equal(parseArgs([]).maxDays, 45, "the default crawl window must cover the currently published VOX schedule");
assert.match(fs.readFileSync(new URL("./refreshVoxData.mjs", import.meta.url), "utf8"), /VOX_REFRESH_MAX_DAYS \|\| "45"/, "the automated refresh must use the extended crawl window");
assert.deepEqual(parseArgs(["--start-date", "2026-07-14", "--max-days", "45", "--workers", "2", "--output", "fresh.json", "--movie-information-output", "movie-information.json", "--previous-movie-information", "previous-information.json"]), {
  startDate: "2026-07-14",
  output: "fresh.json",
  movieInformationOutput: "movie-information.json",
  previousMovieInformation: "previous-information.json",
  maxDays: 45,
  workers: 2,
});

assert.equal(parseOfficialMovieRuntime("<dl><dt>Running <strong>Time</strong></dt><dd>1h 45m</dd></dl>"), 105);
assert.equal(parseOfficialMovieRuntime("<p>Running Time: 98 minutes</p>"), 98);
assert.equal(parseOfficialMovieRuntime("<p>Doors open at 1h 45m</p>"), 0, "unlabelled durations must not be guessed");

const detailFixture = {
  extractedAt: "2026-07-22T00:00:00.000Z",
  movies: [
    { code: "API", title: "API Runtime", runtime: 90, sourcePageUrl: "https://uae.voxcinemas.com/movies/api" },
    { code: "PAGE", title: "Page Runtime", runtime: 0, sourcePageUrl: "https://uae.voxcinemas.com/movies/page" },
    { code: "MISSING", title: "Missing Runtime", runtime: 0, sourcePageUrl: "https://uae.voxcinemas.com/movies/missing" },
    { code: "FAILED", title: "Failed Runtime", runtime: 0, sourcePageUrl: "https://uae.voxcinemas.com/movies/failed" },
  ],
};
let activeDetailRequests = 0;
let maximumActiveDetailRequests = 0;
const enrichedFixture = await enrichMovieInformationRuntimes(detailFixture, {
  workers: 2,
  totalTimeoutMs: 1000,
  fetchPage: async (url) => {
    activeDetailRequests += 1;
    maximumActiveDetailRequests = Math.max(maximumActiveDetailRequests, activeDetailRequests);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
    activeDetailRequests -= 1;
    if (url.endsWith("/failed")) throw new Error("upstream unavailable");
    return url.endsWith("/page") ? "<p>Running Time 1h 45m</p>" : "<p>Runtime not published</p>";
  },
});
assert.ok(maximumActiveDetailRequests <= 2, "detail-page enrichment must honor its worker bound");
assert.equal(enrichedFixture.movies.find((movie) => movie.code === "API").runtimeStatus, "content_api");
assert.equal(enrichedFixture.movies.find((movie) => movie.code === "PAGE").runtime, 105);
assert.equal(enrichedFixture.movies.find((movie) => movie.code === "MISSING").runtimeStatus, "not_published");
assert.equal(enrichedFixture.movies.find((movie) => movie.code === "FAILED").runtimeStatus, "fetch_failed");
assert.equal(enrichedFixture.detailPageRuntimeEnrichment.enrichedCount, 1);
assert.equal(enrichedFixture.detailPageRuntimeEnrichment.failedCount, 1);

const retainedRuntimeFixture = retainPreviouslyVerifiedRuntimes(enrichedFixture, {
  extractedAt: "2026-07-21T00:00:00.000Z",
  movies: [{
    code: "MISSING",
    runtime: 88,
    runtimeSourceUrl: "https://uae.voxcinemas.com/movies/missing",
    runtimeVerifiedAt: "2026-07-21T00:00:00.000Z",
  }],
});
assert.equal(retainedRuntimeFixture.movies.find((movie) => movie.code === "MISSING").runtime, 88);
assert.equal(retainedRuntimeFixture.movies.find((movie) => movie.code === "MISSING").runtimeStatus, "retained_official_detail_page");
assert.equal(retainedRuntimeFixture.detailPageRuntimeEnrichment.retainedCount, 1);

const session = (sessionId) => ({ sessionId, showtime: "2026-07-14T12:00:00+00:00", status: "", filter: "Afternoon", isAvailableForOffer: true });
const flattened = flatten([{
  code: "HO-TEST",
  programmingDate: "2026-07-14",
  payload: {
    cinemas: [{
      cinemaCode: "0001",
      cinemaName: "Test Cinema",
      sessionGroups: [{ experience: "IMAX", code: "IMAX", sessions: [session("100"), session("100"), session("101")] }],
    }],
  },
}]);
assert.equal(flattened.rawSessionCount, 3);
assert.equal(flattened.duplicates, 1);
assert.equal(flattened.sessions.length, 2, "a simultaneous screening with a different source session ID must be preserved");

validate({
  programmingDates: ["2026-07-14"],
  catalog: [{ code: "HO-TEST", title: "Test Film", posterUrl: "https://uae.voxcinemas.com/images/test.png" }],
  cinemas: flattened.cinemas,
  sessions: flattened.sessions,
  experienceMedia: [],
  offerMedia: [],
  crawl: { startDate: "2026-07-14", complete: true, rawSessionCount: 3, duplicateCount: 1 },
});

validate({
  programmingDates: ["2026-07-14"],
  catalog: [{ code: "HO-NO-POSTER", title: "Upstream Poster Pending", posterUrl: "", posterStatus: "missing_at_source" }],
  cinemas: flattened.cinemas,
  sessions: flattened.sessions.map((item) => ({ ...item, code: "HO-NO-POSTER" })),
  experienceMedia: [],
  offerMedia: [],
  crawl: { startDate: "2026-07-14", complete: true, rawSessionCount: 3, duplicateCount: 1, missingOfficialPosterCodes: ["HO-NO-POSTER"] },
});

const currentExtraction = JSON.parse(fs.readFileSync(new URL("../data/vox_showtimes_full.json", import.meta.url), "utf8"));
const allPosterLoss = structuredClone(currentExtraction);
allPosterLoss.catalog = allPosterLoss.catalog.map((movie) => ({ ...movie, posterUrl: "", posterStatus: "missing_at_source" }));
allPosterLoss.crawl.missingOfficialPosterCodes = allPosterLoss.catalog.map((movie) => movie.code).sort();
allPosterLoss.crawl.sourceMissingOfficialPosterCodes = [...allPosterLoss.crawl.missingOfficialPosterCodes];
allPosterLoss.crawl.retainedMoviePosterCodes = [];
allPosterLoss.crawl.retainedMoviePosterCount = 0;
assert.throws(
  () => validateShowtimeRefresh(allPosterLoss, { previous: currentExtraction, now: new Date(currentExtraction.extractedAt) }),
  /lost a previously verified official poster/,
  "a partial upstream response must not erase previously verified movie posters",
);

const retainedPosterFixture = retainPreviouslyVerifiedPosters(
  [{ code: "KNOWN", posterUrl: "https://uae.voxcinemas.com/images/known.png", images: { medium: "https://uae.voxcinemas.com/images/known.png" } }],
  [
    { code: "KNOWN", posterUrl: "", images: {} },
    { code: "NEW", posterUrl: "", images: {} },
  ],
);
assert.deepEqual(retainedPosterFixture.retainedCodes, ["KNOWN"]);
assert.equal(retainedPosterFixture.catalog[0].posterStatus, "retained_official");
assert.equal(retainedPosterFixture.catalog[0].posterUrl, "https://uae.voxcinemas.com/images/known.png");
assert.equal(retainedPosterFixture.catalog[1].posterUrl, "", "a genuinely new upstream poster gap remains explicit");

const legitimateOfferRemoval = retainMediaOnPartialResponse(
  [{ code: "A" }, { code: "B" }, { code: "C" }],
  [{ code: "A" }, { code: "B" }],
);
assert.equal(legitimateOfferRemoval.partialResponse, false, "a normal campaign removal must not retain expired offer media");
assert.deepEqual(legitimateOfferRemoval.items.map((item) => item.code), ["A", "B"]);
const partialExperienceResponse = retainMediaOnPartialResponse(
  [{ code: "A" }, { code: "B" }, { code: "C" }],
  [{ code: "A" }],
);
assert.equal(partialExperienceResponse.partialResponse, true);
assert.equal(partialExperienceResponse.retainedCount, 2, "a clearly partial media response keeps last-known official assets");

console.log("Validated UAE date calculation, strict date parsing, source-session deduplication, and explicit missing-poster metadata.");
