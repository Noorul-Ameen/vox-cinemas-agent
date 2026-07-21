import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SESSIONS as LEGACY_SESSIONS } from "../src/mockVistaData.js";
import { SNAPSHOT_BASE_PATH } from "../src/generated/voxSnapshotManifest.js";
import {
  clearVistaSessionCache,
  createExpiringPromiseCache,
  getCinemaDateSessions,
  getResultMeta,
  getScheduledFilms,
  getSessions,
} from "../src/vistaClient.js";
import { installPublicAssetFetch } from "./lib/installPublicAssetFetch.mjs";

let clock = 1_000;
let loaderCalls = 0;
let releaseRequest;
const liveLikeCache = createExpiringPromiseCache({ ttlMs: 15_000, now: () => clock });
const loader = () => {
  loaderCalls += 1;
  return new Promise((resolve) => { releaseRequest = resolve; });
};
const firstLiveRequest = liveLikeCache.get("0039:2026-07-21", loader);
clock += 20_000;
const concurrentLiveRequest = liveLikeCache.get("0039:2026-07-21", loader);
assert.strictEqual(concurrentLiveRequest, firstLiveRequest, "an in-flight live request must remain coalesced even beyond the settled-value TTL");
await Promise.resolve();
assert.equal(loaderCalls, 1, "concurrent live consumers must invoke the source loader once");
releaseRequest([{ sessionId: "live-1" }]);
assert.deepEqual(await firstLiveRequest, [{ sessionId: "live-1" }]);

clock += 14_999;
assert.strictEqual(
  liveLikeCache.get("0039:2026-07-21", loader),
  firstLiveRequest,
  "a settled live request must remain cached inside its TTL",
);
clock += 1;
const refreshedLiveRequest = liveLikeCache.get("0039:2026-07-21", () => {
  loaderCalls += 1;
  return [{ sessionId: "live-2" }];
});
assert.notStrictEqual(refreshedLiveRequest, firstLiveRequest, "a settled live request must refresh at TTL expiry");
assert.deepEqual(await refreshedLiveRequest, [{ sessionId: "live-2" }]);
assert.equal(loaderCalls, 2);

const failingCache = createExpiringPromiseCache({ ttlMs: 15_000 });
await assert.rejects(failingCache.get("retry", () => Promise.reject(new Error("temporary"))), /temporary/);
assert.deepEqual(await failingCache.get("retry", () => ["recovered"]), ["recovered"], "a rejected request must be evicted for retry");

const requests = [];
installPublicAssetFetch({
  onRequest: (url, init) => requests.push({ url, cache: init?.cache }),
});
clearVistaSessionCache();

const source = LEGACY_SESSIONS[0];
const cinemaId = String(source.CinemaId);
const sourceDate = source.SourceProgrammingDate;
const sourceRows = LEGACY_SESSIONS.filter((session) => (
  String(session.CinemaId) === cinemaId && session.SourceProgrammingDate === sourceDate
));
const filmId = String(source.ScheduledFilmId);
const sourceFilmRows = sourceRows.filter((session) => String(session.ScheduledFilmId) === filmId);
const expectedUrl = `${SNAPSHOT_BASE_PATH}/${cinemaId}/${sourceDate}.json`;

const [allSessions, coalescedSessions, filmSessions, movies] = await Promise.all([
  getCinemaDateSessions(cinemaId, sourceDate),
  getCinemaDateSessions(cinemaId, sourceDate),
  getSessions(cinemaId, filmId, sourceDate),
  getScheduledFilms(cinemaId, sourceDate),
]);

assert.equal(requests.length, 1, "all concurrent cinema-date consumers must share one snapshot request");
assert.deepEqual(requests[0], { url: expectedUrl, cache: "force-cache" });
assert.strictEqual(coalescedSessions, allSessions, "concurrent cinema-date calls must share one normalized catalog promise");
assert.ok(Object.isFrozen(allSessions), "the shared cinema-date result must not allow array mutation");
assert.ok(allSessions.length > 0, "the selected cinema-date fixture must contain normalized sessions");
assert.ok(movies.length > 0, "scheduled films must remain compatible with the shared source request");
assert.ok(allSessions.every((session) => session.cinemaId === cinemaId), "every result must remain scoped to the requested cinema");
assert.ok(allSessions.every((session) => session.programmingDate === sourceDate), "every result must remain scoped to the requested programming date");
assert.ok(allSessions.every((session) => Array.isArray(session.sessionIds)), "presentation rows must retain their source session identifiers");
assert.deepEqual(
  allSessions.flatMap((session) => session.sessionIds).sort(),
  sourceRows.map((session) => String(session.SessionId)).sort(),
  "the all-session API must retain every raw source session after presentation deduplication",
);

const allMeta = getResultMeta(allSessions);
assert.equal(allMeta?.cinemaId, cinemaId);
assert.equal(allMeta?.displayDate, sourceDate);
assert.equal(allMeta?.scheduledFilmId, null);
assert.equal(allMeta?.rawCount, sourceRows.length);
assert.equal(allMeta?.displayCount, allSessions.length);

assert.deepEqual(
  filmSessions,
  allSessions.filter((session) => session.scheduledFilmId === filmId),
  "the existing per-film API must preserve the same normalized presentation rows",
);
assert.equal(getResultMeta(filmSessions)?.rawCount, sourceFilmRows.length, "per-film raw metadata must remain unchanged");
assert.equal(getResultMeta(filmSessions)?.scheduledFilmId, filmId);

await getCinemaDateSessions(cinemaId, sourceDate);
await getSessions(cinemaId, filmId, sourceDate);
assert.equal(requests.length, 1, "repeat reads must reuse the normalized cinema-date cache");

clearVistaSessionCache();
const refreshedSessions = await getCinemaDateSessions(cinemaId, sourceDate);
assert.equal(requests.length, 2, "clearing the session cache must allow one fresh snapshot request");
assert.notStrictEqual(refreshedSessions, allSessions, "a cache clear must replace the normalized catalog");

const vistaSource = await readFile(new URL("../src/vistaClient.js", import.meta.url), "utf8");
const liveSessionsBlock = vistaSource.slice(
  vistaSource.indexOf("async function fetchLiveSessions"),
  vistaSource.indexOf("export async function getScheduledFilms"),
);
assert.match(liveSessionsBlock, /liveSessionCache\.get\(key, async \(\) =>/, "live session reads must register an in-flight promise before awaiting the source");
const getSessionsBlock = vistaSource.slice(
  vistaSource.indexOf("export async function getSessions"),
  vistaSource.indexOf("export async function getSeatPlan"),
);
assert.match(getSessionsBlock, /getCinemaDateSessionCatalog\(/, "the existing per-film API must consume the shared cinema-date catalog");
assert.doesNotMatch(getSessionsBlock, /fetchSnapshotSessions|fetchLiveSessions/, "per-film reads must not start another source fetch path");

console.log(`Validated in-flight live request coalescing, one normalized cinema-date load, shard coalescing, and getSessions compatibility for ${sourceRows.length} sessions.`);
