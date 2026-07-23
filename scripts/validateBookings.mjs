import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const memory = new Map();
let failWrites = false;
let failReads = false;
globalThis.window = {
  localStorage: {
    getItem: (key) => {
      if (failReads) throw new Error("storage access denied");
      return memory.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (failWrites) throw new Error("quota exceeded");
      memory.set(key, String(value));
    },
    removeItem: (key) => memory.delete(key),
  },
};

const {
  BOOKING_STORAGE_KEY,
  BOOKING_STORAGE_NAMESPACE,
  BOOKING_STORAGE_VERSION,
  BookingStorageError,
  appendBooking,
  clearBookings,
  createBookingStoreScope,
  findBooking,
  getBookingStorageStatus,
  markCancelled,
  readBookings,
} = await import("../src/bookingStore.js");

window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify([{
  ref: "OLD123",
  movieTitle: "Legacy booking",
  cinemaName: `VOX ${String.fromCodePoint(0x2014)} City Centre Deira`,
  seats: "C5, C6",
  total: 84,
}]));

assert.equal(readBookings()[0].currency, "AED", "legacy booking gets default currency");
assert.deepEqual(readBookings()[0].seats, ["C5", "C6"], "legacy seat string normalizes");
assert.equal(readBookings()[0].cinemaName, "VOX - City Centre Deira", "legacy customer-facing punctuation normalizes on hydration");
assert.equal(getBookingStorageStatus().legacy, true, "legacy arrays are detected before migration");

appendBooking({ ref: "WLTEST", movieTitle: "New booking", seats: ["E1", "E2"], total: 126, createdAt: "2026-07-12T10:00:00.000Z", tint: undefined });
assert.equal(findBooking("wltest")?.movieTitle, "New booking", "lookup is case-insensitive");
const envelope = JSON.parse(window.localStorage.getItem(BOOKING_STORAGE_KEY));
assert.equal(envelope.version, BOOKING_STORAGE_VERSION, "writes migrate storage to the current envelope");
assert.equal(envelope.namespace, BOOKING_STORAGE_NAMESPACE);

const cancelled = markCancelled("WlTeSt", "2026-07-12T11:00:00.000Z");
assert.equal(cancelled.cancelled, true);
assert.equal(cancelled.cancelledAt, "2026-07-12T11:00:00.000Z");
assert.equal(findBooking("WLTEST")?.cancelled, true, "cancellation persists");
assert.equal(readBookings().length, 2, "existing bookings stay intact");

const merged = appendBooking({ ref: "wltest", movieTitle: "Updated title only" });
assert.equal(merged.cancelled, true, "a duplicate partial write cannot resurrect a cancellation");
assert.equal(merged.cancelledAt, "2026-07-12T11:00:00.000Z");
assert.deepEqual(merged.seats, ["E1", "E2"], "missing duplicate fields preserve stored values");
assert.equal(merged.createdAt, "2026-07-12T10:00:00.000Z");

const userA = createBookingStoreScope({ userId: "user-a" });
const userB = createBookingStoreScope({ userId: "user-b" });
userA.append({ ref: "SAME", movieTitle: "A", seats: ["A1"] });
userB.append({ ref: "SAME", movieTitle: "B", seats: ["B1"] });
assert.equal(userA.find("same")?.movieTitle, "A", "scoped stores isolate duplicate references");
assert.equal(userB.find("same")?.movieTitle, "B");
assert.equal(userA.clear(), 1, "scoped clear removes only the selected user");
assert.equal(userB.find("same")?.movieTitle, "B", "another user's booking survives scoped clear");

failWrites = true;
assert.throws(
  () => appendBooking({ ref: "GHOST", movieTitle: "Must not be acknowledged" }),
  (error) => error instanceof BookingStorageError && error.code === "STORAGE_WRITE_FAILED",
  "failed persistence must throw instead of returning a ghost booking",
);
failWrites = false;
assert.equal(findBooking("GHOST"), null);

const contradictoryDeviceSummary = appendBooking({
  ref: "DEVICEONLY",
  movieTitle: "Contradictory legacy summary",
  seats: ["D1"],
  bookingStatus: "summary_saved",
  verified: true,
  demo: false,
  paymentStatus: "paid",
  inventoryVerified: true,
  reservationVerified: true,
});
assert.equal(contradictoryDeviceSummary.verified, false, "summary_saved must never hydrate as provider verified");
assert.equal(contradictoryDeviceSummary.demo, true, "summary_saved must remain device-only");
assert.equal(contradictoryDeviceSummary.paymentStatus, "simulated_not_charged", "summary_saved must never hydrate as paid");
assert.equal(contradictoryDeviceSummary.inventoryVerified, false);
assert.equal(contradictoryDeviceSummary.reservationVerified, false);

const cleared = clearBookings();
assert.ok(cleared >= 3, "explicit clear removes persisted booking history");
assert.deepEqual(readBookings(), []);

window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
  version: BOOKING_STORAGE_VERSION,
  namespace: BOOKING_STORAGE_NAMESPACE,
  bookings: [{ movieTitle: "Missing reference" }],
}));
assert.deepEqual(readBookings(), [], "non-strict legacy reads remain fail-soft for malformed entries");
assert.throws(
  () => readBookings({ strict: true }),
  (error) => error instanceof BookingStorageError && error.code === "STORAGE_CORRUPT",
  "strict reads must reject a malformed booking instead of reporting empty history",
);
assert.equal(getBookingStorageStatus().valid, false, "malformed booking entries make storage status invalid");

window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
  version: BOOKING_STORAGE_VERSION,
  namespace: BOOKING_STORAGE_NAMESPACE,
  bookings: [
    { ref: "VALID1", movieTitle: "Valid booking" },
    { movieTitle: "Malformed sibling" },
  ],
}));
assert.throws(
  () => readBookings({ strict: true }),
  (error) => error instanceof BookingStorageError && error.code === "STORAGE_CORRUPT",
  "strict reads must reject partially corrupt history instead of silently dropping entries",
);
assert.equal(getBookingStorageStatus().valid, false, "partially corrupt history must not be reported as valid");
window.localStorage.removeItem(BOOKING_STORAGE_KEY);

window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
  version: BOOKING_STORAGE_VERSION,
  namespace: BOOKING_STORAGE_NAMESPACE,
  bookings: [{
    ref: "UNSAFE1",
    movieTitle: { unexpected: "object" },
    total: { unexpected: "object" },
    seats: [{ unexpected: "object" }],
  }],
}));
assert.deepEqual(readBookings(), [], "non-strict hydration must drop structurally unsafe records before rendering");
assert.throws(
  () => readBookings({ strict: true }),
  (error) => error instanceof BookingStorageError && error.code === "STORAGE_CORRUPT",
  "strict reads must reject valid JSON that contains unsafe rendered field types",
);
assert.equal(getBookingStorageStatus().valid, false, "unsafe rendered field types make storage status invalid");
window.localStorage.removeItem(BOOKING_STORAGE_KEY);

window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
  version: BOOKING_STORAGE_VERSION,
  namespace: BOOKING_STORAGE_NAMESPACE,
  bookings: [{
    ref: "BADCURRENCY",
    movieTitle: "Currency guard",
    seats: ["A1"],
    total: 42,
    currency: "BOGUS",
  }],
}));
assert.deepEqual(readBookings(), [], "an unsupported stored currency must be dropped before rendering");
assert.throws(
  () => readBookings({ strict: true }),
  (error) => error instanceof BookingStorageError && error.code === "STORAGE_CORRUPT",
  "strict reads must reject an unsupported stored currency before Intl formatting",
);
assert.equal(getBookingStorageStatus().valid, false, "an unsupported currency makes storage status invalid");
window.localStorage.removeItem(BOOKING_STORAGE_KEY);

failReads = true;
assert.deepEqual(readBookings(), [], "non-strict reads remain fail-soft when storage access is denied");
assert.throws(
  () => readBookings({ strict: true }),
  (error) => error instanceof BookingStorageError && error.code === "STORAGE_CORRUPT",
  "strict reads must expose denied storage instead of reporting empty booking history",
);
failReads = false;

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(
  appSource,
  /crypto\.getRandomValues\(new Uint8Array\(12\)\)/,
  "local summary references must use browser cryptographic randomness when available",
);
assert.match(
  appSource,
  /function createUniqueBookingReference[\s\S]*for \(let attempt = 0; attempt < 16; attempt \+= 1\)[\s\S]*existingRefs\.has/,
  "reference generation must retry against every existing local booking",
);
const completionFlow = appSource.slice(
  appSource.indexOf("const handleCheckoutReviewComplete"),
  appSource.indexOf("CLIENT TOOLS:", appSource.indexOf("const handleCheckoutReviewComplete")),
);
assert.match(
  completionFlow,
  /createUniqueBookingReference\(readBookings\(\{ strict: true \}\)\)[\s\S]*appendBooking\(completed\)/,
  "reference uniqueness must be checked under the booking mutation lock before persistence",
);
assert.doesNotMatch(
  completionFlow,
  /const ref = `WL\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 7\)/,
  "the old five-character random reference must not remain",
);
const bookingSummaryTool = appSource.slice(
  appSource.indexOf("show_booking_summary:"),
  appSource.indexOf("show_booking_for_cancellation:"),
);
assert.match(
  bookingSummaryTool,
  /readBookings\(\{ strict: true \}\)[\s\S]*\.find\(\(item\) => norm\(item\.ref\) === norm\(ref\)\)/,
  "booking summaries must resolve references from a strict local storage read",
);
assert.match(
  bookingSummaryTool,
  /catch \{[\s\S]*reason: "booking_storage_unavailable"/,
  "corrupt booking storage must fail closed instead of looking like a missing reference",
);
assert.doesNotMatch(
  bookingSummaryTool,
  /findBooking\(ref\)/,
  "the booking summary tool must not use a permissive reference lookup",
);

console.log("Validated versioned booking persistence, safe duplicate merges, scoped isolation, truthful writes, cancellation state, and explicit clearing.");
