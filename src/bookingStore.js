export const BOOKING_STORAGE_KEY = "vox_bookings";

const hasStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const refKey = (value) => String(value || "").trim().toUpperCase();

function normalizeBooking(value) {
  if (!value || typeof value !== "object" || !refKey(value.ref)) return null;
  return {
    ...value,
    ref: String(value.ref).trim(),
    seats: Array.isArray(value.seats)
      ? value.seats.map(String).filter(Boolean)
      : String(value.seats || "").split(/[,\s]+/).filter(Boolean),
    currency: value.currency || "AED",
    cancelled: Boolean(value.cancelled),
    createdAt: value.createdAt || null,
    cancelledAt: value.cancelled ? value.cancelledAt || null : null,
  };
}

export function readBookings() {
  if (!hasStorage()) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(BOOKING_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.map(normalizeBooking).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function writeBookings(bookings) {
  const safe = (Array.isArray(bookings) ? bookings : []).map(normalizeBooking).filter(Boolean);
  if (hasStorage()) {
    try { window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(safe)); } catch {}
  }
  return safe;
}

export function appendBooking(booking) {
  const safe = normalizeBooking(booking);
  if (!safe) throw new Error("A booking reference is required.");
  const key = refKey(safe.ref);
  const existing = readBookings();
  const index = existing.findIndex((item) => refKey(item.ref) === key);
  const next = [...existing];
  if (index >= 0) next[index] = { ...existing[index], ...safe };
  else next.push(safe);
  writeBookings(next);
  return safe;
}

export function findBooking(ref) {
  const key = refKey(ref);
  if (!key) return null;
  return readBookings().find((booking) => refKey(booking.ref) === key) || null;
}

export function markCancelled(ref, cancelledAt = new Date().toISOString()) {
  const key = refKey(ref);
  if (!key) return null;
  let updated = null;
  const next = readBookings().map((booking) => {
    if (refKey(booking.ref) !== key) return booking;
    updated = { ...booking, cancelled: true, cancelledAt: booking.cancelledAt || cancelledAt };
    return updated;
  });
  if (updated) writeBookings(next);
  return updated;
}

