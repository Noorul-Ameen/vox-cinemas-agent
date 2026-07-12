import assert from "node:assert/strict";

const memory = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  },
};

const {
  BOOKING_STORAGE_KEY,
  appendBooking,
  findBooking,
  markCancelled,
  readBookings,
} = await import("../src/bookingStore.js");

window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify([{
  ref: "OLD123",
  movieTitle: "Legacy booking",
  seats: "C5, C6",
  total: 84,
}]));

assert.equal(readBookings()[0].currency, "AED", "legacy booking gets default currency");
assert.deepEqual(readBookings()[0].seats, ["C5", "C6"], "legacy seat string normalizes");

appendBooking({ ref: "WLTEST", movieTitle: "New booking", seats: ["E1", "E2"], total: 126, createdAt: "2026-07-12T10:00:00.000Z" });
assert.equal(findBooking("wltest")?.movieTitle, "New booking", "lookup is case-insensitive");

const cancelled = markCancelled("WlTeSt", "2026-07-12T11:00:00.000Z");
assert.equal(cancelled.cancelled, true);
assert.equal(cancelled.cancelledAt, "2026-07-12T11:00:00.000Z");
assert.equal(findBooking("WLTEST")?.cancelled, true, "cancellation persists");
assert.equal(readBookings().length, 2, "existing bookings stay intact");

console.log("Validated backward-compatible booking persistence, case-insensitive lookup, and cancellation state.");

