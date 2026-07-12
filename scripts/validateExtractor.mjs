import assert from "node:assert/strict";
import fs from "node:fs";
import { addDays, flatten, isIsoDate, parseArgs, uaeToday, validate } from "./extractVoxShowtimes.mjs";

assert.equal(uaeToday(new Date("2026-07-13T20:30:00Z")), "2026-07-14", "Dubai calendar date must not use host or UTC midnight");
assert.equal(addDays("2026-07-14", 1), "2026-07-15");
assert.equal(isIsoDate("2026-02-29"), false, "impossible calendar dates must be rejected");
assert.equal(isIsoDate("2028-02-29"), true);
assert.match(fs.readFileSync(new URL("./extractVoxShowtimes.mjs", import.meta.url), "utf8"), /authenticate\(\{ rediscoverKey: authAttempt === 1 \}\)/, "a repeated 401 must rediscover the rotating public browser key");
assert.deepEqual(parseArgs(["--start-date", "2026-07-14", "--max-days", "45", "--workers", "2", "--output", "fresh.json"]), {
  startDate: "2026-07-14",
  output: "fresh.json",
  maxDays: 45,
  workers: 2,
});

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

console.log("Validated UAE tomorrow calculation, strict date parsing, and source-session deduplication.");
