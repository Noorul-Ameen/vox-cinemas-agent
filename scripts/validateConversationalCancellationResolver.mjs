import assert from "node:assert/strict";
import { resolveConversationalCancellation } from "../src/lib/conversationalCancellationResolver.js";

const now = new Date("2026-07-17T08:00:00.000Z");
const booking = (value) => Object.freeze({
  cancelled: false,
  bookingStatus: "confirmed",
  providerEligibilityVerified: true,
  ...value,
});

const missionEarly = booking({
  ref: "ABC123",
  movieTitle: "Mission Impossible",
  cinemaName: "VOX - Mall of the Emirates",
  performanceDate: "2026-07-18",
  showtime: "18:00",
});
const missionLate = booking({
  ref: "XYZ789",
  movieTitle: "Mission Impossible",
  cinemaName: "VOX - City Centre Mirdif",
  performanceDate: "2026-07-20",
  showtime: "20:30",
});
const toyStory = booking({
  ref: "TOY555",
  movieTitle: "Toy Story 5",
  cinemaName: "VOX - Mall of the Emirates",
  performanceDate: "2026-07-18",
  showtime: "17:00",
});
const arabicMovie = booking({
  ref: "AR7788",
  movieTitle: "رحلة القمر",
  cinemaName: "VOX - Yas Mall",
  performanceDate: "2026-07-21",
  showtime: "19:15",
});
const ineligible = booking({
  ref: "NOREFUND",
  movieTitle: "Moana",
  cinemaName: "VOX - City Centre Deira",
  performanceDate: "2026-07-19",
  showtime: "10:00",
  cancellationEligible: false,
});
const cancelled = booking({
  ref: "CANCELLED1",
  movieTitle: "Sonic",
  cinemaName: "VOX - Mall of the Emirates",
  performanceDate: "2026-07-18",
  showtime: "21:30",
  cancelled: true,
  bookingStatus: "cancelled",
});

const bookings = [missionEarly, missionLate, toyStory, arabicMovie, ineligible, cancelled];
const displayedBookingRefs = bookings.map((item) => item.ref);
const resolve = (text, extra = {}) => resolveConversationalCancellation({
  text,
  bookings,
  displayedBookingRefs,
  now,
  ...extra,
});

const passed = [];
const scenario = (number, label, check) => {
  check();
  passed.push(`${number}. ${label}`);
};

scenario(1, "Cancel by exact booking reference", () => {
  const result = resolve("Cancel booking reference ABC123");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, missionEarly.ref);
  assert.deepEqual(result.matchedBy, ["reference"]);
});

scenario(2, "Cancel by movie name with one matching booking", () => {
  const result = resolve("Cancel the booking for Toy Story five");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, toyStory.ref);
  assert.ok(result.matchedBy.includes("movie"));
});

scenario(3, "Cancel by movie name with multiple matching bookings", () => {
  const result = resolve("Cancel Mission Impossible");
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.candidateRefs, [missionEarly.ref, missionLate.ref]);
  assert.deepEqual(result.differentiators, ["date"]);
});

scenario(4, "Cancel by date with one matching booking", () => {
  const result = resolve("Cancel my booking for the 21st");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, arabicMovie.ref);
});

scenario(5, "Cancel by date with multiple matching bookings", () => {
  const result = resolve("Cancel the booking I made for tomorrow");
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.candidateRefs, [missionEarly.ref, toyStory.ref]);
  assert.deepEqual(result.differentiators, ["movie"]);
});

scenario(6, "Cancel by cinema", () => {
  const result = resolve("Cancel the City Centre Mirdif booking");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, missionLate.ref);
  assert.ok(result.matchedBy.includes("cinema"));
});
for (const [text, expectedRef] of [
  ["Mirdif", missionLate.ref],
  ["CCM", missionLate.ref],
  ["Cancel the Mall of the Emirates booking on 20 July", missionLate.ref],
]) {
  const result = resolve(text);
  if (text.includes("Mall of the Emirates")) {
    assert.equal(result.status, "none", "a cinema plus incompatible date must not select another booking");
  } else {
    assert.equal(result.status, "unique", `${text}: a production cinema name or alias must resolve`);
    assert.equal(result.bookingRef, expectedRef);
  }
}
const moeAlias = resolve("MOE on 18 July");
assert.equal(moeAlias.status, "ambiguous", "MOE plus a shared date must retain both matching displayed bookings");
assert.deepEqual(new Set(moeAlias.candidateRefs), new Set([missionEarly.ref, toyStory.ref]));

scenario(7, "Cancel by displayed list position", () => {
  const result = resolve("Cancel the second booking");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, missionLate.ref);
  assert.deepEqual(result.matchedBy, ["ordinal"]);
});

scenario(8, "Resolve a voice transcript", () => {
  const result = resolve("Please cancel the booking at 8:30 PM");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, missionLate.ref);
  assert.ok(result.matchedBy.includes("showtime"));
});

scenario(9, "Resolve a text request", () => {
  const result = resolve("Cancel the Yas Mall booking on 21 July");
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, arabicMovie.ref);
  assert.ok(result.matchedBy.includes("date"));
  assert.ok(result.matchedBy.includes("cinema"));
});

scenario(10, "Reject at confirmation without mutating the target", () => {
  const before = JSON.stringify(bookings);
  const result = resolve("Cancel reference ABC123");
  assert.equal(result.status, "unique");
  assert.equal(JSON.stringify(bookings), before);
  const afterRejection = resolve("Cancel reference ABC123");
  assert.equal(afterRejection.status, "unique");
});

scenario(11, "Return a stable unique target for confirmation", () => {
  const first = resolve("Cancel reference ABC123");
  const second = resolve("Cancel reference ABC123");
  assert.equal(first.bookingRef, second.bookingRef);
  assert.equal(first.status, "unique");
  assert.equal(second.status, "unique");
});

scenario(12, "Attempt to cancel an ineligible booking", () => {
  const result = resolve("Cancel Moana");
  assert.equal(result.status, "ineligible");
  assert.equal(result.bookingRef, ineligible.ref);
  assert.equal(result.reason, "provider_marked_ineligible");
});

scenario(13, "Attempt to cancel an already cancelled booking", () => {
  const result = resolve("Cancel booking reference CANCELLED1");
  assert.equal(result.status, "already_cancelled");
  assert.equal(result.bookingRef, cancelled.ref);
});

scenario(14, "Cancel from booking history order", () => {
  const historyOrder = [toyStory.ref, missionEarly.ref, missionLate.ref];
  const result = resolveConversationalCancellation({
    text: "Cancel the first one",
    bookings,
    displayedBookingRefs: historyOrder,
    now,
  });
  assert.equal(result.status, "unique");
  assert.equal(result.bookingRef, toyStory.ref);
  assert.equal(result.candidates[0].position, 1);
});

scenario(15, "Change topic and resume without resolver state loss", () => {
  const first = resolve("Cancel Mission Impossible");
  const unrelated = resolve("What bank offers are available?");
  const resumed = resolve("Cancel Mission Impossible");
  assert.equal(first.status, "ambiguous");
  assert.equal(unrelated.status, "none", "An unrelated request must not select a cancellation target");
  assert.deepEqual(resumed.candidateRefs, first.candidateRefs);
  assert.equal(JSON.stringify(bookings), JSON.stringify([missionEarly, missionLate, toyStory, arabicMovie, ineligible, cancelled]));
});

scenario(16, "Recognize history after a confirmed cancellation update", () => {
  const updated = bookings.map((item) => item.ref === missionEarly.ref
    ? { ...item, cancelled: true, bookingStatus: "cancelled", cancelledAt: "2026-07-17T08:05:00.000Z" }
    : item);
  const result = resolveConversationalCancellation({
    text: "Cancel reference ABC123",
    bookings: updated,
    displayedBookingRefs: updated.map((item) => item.ref),
    now,
  });
  assert.equal(result.status, "already_cancelled");
  assert.equal(result.bookingRef, missionEarly.ref);
});

const exactTime = resolve("Cancel the booking at 6 PM");
assert.equal(exactTime.status, "unique");
assert.equal(exactTime.bookingRef, missionEarly.ref);

const evening = resolve("Cancel the evening booking");
assert.equal(evening.status, "ambiguous");
assert.deepEqual(evening.candidateRefs, [missionEarly.ref, missionLate.ref, toyStory.ref, arabicMovie.ref]);
assert.ok(evening.matchedBy.includes("time_band"));

const contextual = resolve("Cancel my booking for this movie", {
  conversationContext: { currentMovie: { title: "Toy Story 5" } },
});
assert.equal(contextual.status, "unique");
assert.equal(contextual.bookingRef, toyStory.ref);
assert.ok(contextual.matchedBy.includes("context_movie"));

const missingContext = resolve("Cancel my booking for this movie");
assert.equal(missingContext.status, "none");
assert.equal(missingContext.reason, "context_movie_unavailable");

const contextualBooking = resolve("Cancel this booking", {
  conversationContext: { currentBookingRef: missionLate.ref },
});
assert.equal(contextualBooking.status, "unique");
assert.equal(contextualBooking.bookingRef, missionLate.ref);
assert.ok(contextualBooking.matchedBy.includes("context_booking"));
for (const text of ["cancel", "cancel it", "cancel this", "cancel that", "void this", "refund it", "refund this booking", "refund my booking"]) {
  const result = resolve(text, { conversationContext: { currentBookingRef: missionLate.ref } });
  assert.equal(result.status, "unique", `${text}: an exact contextual command must target the visible booking`);
  assert.equal(result.bookingRef, missionLate.ref);
}
const refundByTitle = resolve("refund Toy Story 5");
assert.equal(refundByTitle.status, "unique", "refund must remain an intent word instead of being parsed as a ref prefix");
assert.equal(refundByTitle.bookingRef, toyStory.ref);

const contradictoryContextualBooking = resolve(`Cancel this booking reference ${missionEarly.ref}`, {
  conversationContext: { currentBookingRef: missionLate.ref },
});
assert.equal(contradictoryContextualBooking.status, "none", "a contradictory visible booking and explicit reference must fail closed");
assert.equal(contradictoryContextualBooking.bookingRef, null);

const unknownReference = resolve("Cancel booking reference UNKNOWN99");
assert.equal(unknownReference.status, "none");
assert.equal(unknownReference.reason, "unknown_reference");

const unknownMovie = resolve("Cancel Avatar");
assert.equal(unknownMovie.status, "none");
assert.equal(unknownMovie.reason, "unrecognized_selector");
for (const text of [
  "Cancel Mirdif tomorrow",
  "Cancel Avengers tomorrow",
  "Cancel Atlantis on July 24",
  "Cancel Sharjah tomorrow",
]) {
  const result = resolve(text);
  assert.equal(result.status, "none", `${text}: an unmatched movie, cinema, or location must never be ignored because the date matched`);
  assert.equal(result.bookingRef, null);
}

for (const text of [
  "Cancel Toy Story five in MOE tomorrow",
  "Cancel Toy Story five from MOE tomorrow",
  "the booking with Toy Story five",
  "I think Toy Story five",
  "Yes, Toy Story five",
  "It is Toy Story five",
  "Probably Toy Story five",
]) {
  const result = resolve(text);
  assert.equal(result.status, "unique", `${text}: conversational filler must not block a fully matched booking selector`);
  assert.equal(result.bookingRef, toyStory.ref);
}
for (const text of ["It is the one at Mirdif", "Cancel Mission Impossible in Mirdif"]) {
  const result = resolve(text);
  assert.equal(result.status, "unique", `${text}: a partial cinema name must compose with other consumed criteria`);
  assert.equal(result.bookingRef, missionLate.ref);
}
const moanaMirdif = booking({
  ref: "MOANAMIRDIF",
  movieTitle: "Moana",
  cinemaName: "VOX - City Centre Mirdif",
  performanceDate: "2026-07-19",
  showtime: "19:30",
});
for (const text of ["Cancel Moana Mirdif", "Cancel Moana in Mirdif", "Cancel Moana at Mirdif"]) {
  const result = resolveConversationalCancellation({
    text,
    bookings: [moanaMirdif, toyStory],
    displayedBookingRefs: [moanaMirdif.ref, toyStory.ref],
    now,
  });
  assert.equal(result.status, "unique", `${text}: partial cinema and movie criteria must compose`);
  assert.equal(result.bookingRef, moanaMirdif.ref);
}
for (const text of ["Cancel Toy Story five Mall of the Emirates", "Cancel Toy Story five Emirates"]) {
  const result = resolve(text);
  assert.equal(result.status, "unique", `${text}: a partial Mall of the Emirates name must compose with the movie`);
  assert.equal(result.bookingRef, toyStory.ref);
}
for (const text of ["Cancel Toy Story 6", "Cancel Toy Story 7", "Cancel Toy Story 10", "Cancel Mission Impossible 8/2"]) {
  const result = resolve(text);
  assert.equal(result.status, "none", `${text}: a mismatched sequel or numeric selector must fail closed`);
  assert.equal(result.bookingRef, null);
}
for (const text of ["Cancel tomorrow 999", "Cancel tomorrow 25", "Cancel July 18 999", "Cancel at 6 PM 999", "Cancel tomorrow 2"]) {
  const result = resolve(text);
  assert.equal(result.status, "none", `${text}: an extra numeric selector must not be ignored after a valid date or time`);
  assert.equal(result.bookingRef, null);
}

const displayedAmbiguityOrder = resolveConversationalCancellation({
  text: "Cancel Mission Impossible",
  bookings,
  displayedBookingRefs: [missionLate.ref, missionEarly.ref],
  now,
});
assert.deepEqual(displayedAmbiguityOrder.candidateRefs, [missionLate.ref, missionEarly.ref]);

const arabicReference = resolve("الغ الحجز رقم ABC123");
assert.equal(arabicReference.status, "unique");
assert.equal(arabicReference.bookingRef, missionEarly.ref);

const arabicMovieResult = resolve("الغ حجز فيلم رحلة القمر");
assert.equal(arabicMovieResult.status, "unique");
assert.equal(arabicMovieResult.bookingRef, arabicMovie.ref);

const arabicOrdinal = resolve("الغ الحجز الثاني");
assert.equal(arabicOrdinal.status, "unique");
assert.equal(arabicOrdinal.bookingRef, missionLate.ref);

const arabicJulyEvening = booking({
  ref: "ARJUL24",
  movieTitle: "Arabic Date Fixture",
  cinemaName: "VOX - Yas Mall",
  performanceDate: "2026-07-24",
  showtime: "20:30",
});
const arabicTemporalBookings = [missionEarly, toyStory, arabicJulyEvening];
const resolveArabicTemporal = (text) => resolveConversationalCancellation({
  text,
  bookings: arabicTemporalBookings,
  displayedBookingRefs: arabicTemporalBookings.map((item) => item.ref),
  now,
});

for (const text of ["الغ حجز 24 يوليو", "الغ حجز يوم 24 يوليو", "الغ حجز بتاريخ 24 يوليو"]) {
  const result = resolveArabicTemporal(text);
  assert.equal(result.status, "unique", `${text}: an Arabic day and month must resolve as a date rather than a list ordinal`);
  assert.equal(result.bookingRef, arabicJulyEvening.ref);
  assert.ok(result.matchedBy.includes("date"));
  assert.ok(!result.matchedBy.includes("ordinal"));
}

for (const text of [
  "الغ حجز بتاريخ 24 يوليو الساعة 8:30 مساء",
  "الغ حجز بتاريخ ٢٤ يوليو الساعة ٨:٣٠ مساء",
]) {
  const result = resolveArabicTemporal(text);
  assert.equal(result.status, "unique", `${text}: Arabic date, clock marker, and evening suffix must be fully consumed`);
  assert.equal(result.bookingRef, arabicJulyEvening.ref);
  assert.equal(result.criteria.showtimeMinutes, 20 * 60 + 30);
  assert.deepEqual(result.criteria.showtimeTokens, ["8:30", "مساء"]);
}

const arabicTwentyFourHourClock = resolveArabicTemporal("الغ حجز الساعة 18:00");
assert.equal(arabicTwentyFourHourClock.status, "unique", "an explicit 24-hour Arabic clock must remain 18:00");
assert.equal(arabicTwentyFourHourClock.bookingRef, missionEarly.ref);
assert.equal(arabicTwentyFourHourClock.criteria.showtimeMinutes, 18 * 60);

const arabicBareEveningClock = resolveArabicTemporal("الغي حجز 8:30 مساء");
assert.equal(arabicBareEveningClock.status, "unique", "a bare Arabic evening clock must be treated as time rather than booking ordinal 8");
assert.equal(arabicBareEveningClock.bookingRef, arabicJulyEvening.ref);
assert.equal(arabicBareEveningClock.criteria.showtimeMinutes, 20 * 60 + 30);
assert.ok(!arabicBareEveningClock.matchedBy.includes("ordinal"));

const arabicSpokenEveningClock = resolveArabicTemporal("الغي حجز السادسة مساء");
assert.equal(arabicSpokenEveningClock.status, "unique", "a spoken Arabic clock hour must resolve with its evening suffix");
assert.equal(arabicSpokenEveningClock.bookingRef, missionEarly.ref);
assert.equal(arabicSpokenEveningClock.criteria.showtimeMinutes, 18 * 60);

const arabicTomorrow = resolveArabicTemporal("الغ حجز يوم غد");
assert.equal(arabicTomorrow.status, "ambiguous", "يوم غد must select tomorrow without treating its date marker as unknown");
assert.deepEqual(arabicTomorrow.candidateRefs, [missionEarly.ref, toyStory.ref]);
assert.ok(arabicTomorrow.matchedBy.includes("relative_date"));

for (const text of ["الغ حجز 24 يوليو 999", "الغ حجز بتاريخ 24 يوليو الساعة 8:30 مساء 999"]) {
  const result = resolveArabicTemporal(text);
  assert.equal(result.status, "none", `${text}: an unrelated numeric selector must continue to fail closed`);
  assert.equal(result.reason, "unrecognized_selector");
}

for (const text of ["ممكن تلغي حجز موانا", "رجع تذاكر موانا", "أريد استرداد حجز موانا"]) {
  const result = resolve(text);
  assert.equal(result.status, "ineligible", `${text}: common Arabic cancellation wrappers must preserve the matched booking target`);
  assert.equal(result.bookingRef, ineligible.ref);
}
const arabicToyStoryAlias = resolve("الغ حجز توي ستوري 5");
assert.equal(arabicToyStoryAlias.status, "unique", "an Arabic transliteration must match the English stored title");
assert.equal(arabicToyStoryAlias.bookingRef, toyStory.ref);
const arabicMissionAlias = resolve("الغ حجز ميشن امبوسيبل");
assert.equal(arabicMissionAlias.status, "ambiguous", "the same cross-script title on two bookings must remain ambiguous");
assert.deepEqual(arabicMissionAlias.candidateRefs, [missionEarly.ref, missionLate.ref]);
for (const text of ["الغ حجز موان", "الغ حجز موانا 2", "الغ حجز توي ستوري 6", "الغ حجز افاتار"]) {
  const result = resolve(text);
  assert.equal(result.status, "none", `${text}: truncated, sequel-mismatched, and unknown titles must fail closed`);
}
for (const [movieTitle, text] of [["Moana", "الغي مين"], ["Dune", "الغي دين"], ["Lenin", "الغي لين"]]) {
  const collision = resolveConversationalCancellation({
    text,
    bookings: [booking({ ref: `COLLISION-${movieTitle}`, movieTitle, performanceDate: "2026-07-30", showtime: "20:00" })],
    displayedBookingRefs: [`COLLISION-${movieTitle}`],
    now,
  });
  assert.equal(collision.status, "none", `${text}: a short phonetic collision must never select ${movieTitle}`);
}
const arabicAlpha = resolveConversationalCancellation({
  text: "الغي حجز الفا",
  bookings: [booking({ ref: "ALPHA1", movieTitle: "Alpha", performanceDate: "2026-07-30", showtime: "20:00" })],
  displayedBookingRefs: ["ALPHA1"],
  now,
});
assert.equal(arabicAlpha.bookingRef, "ALPHA1", "a common ph transliteration must resolve Alpha");
const arabicSpiderMan = resolveConversationalCancellation({
  text: "الغي حجز سبايدر مان",
  bookings: [booking({ ref: "SPIDER1", movieTitle: "Spider-Man: Brand New Day", performanceDate: "2026-07-30", showtime: "20:00" })],
  displayedBookingRefs: ["SPIDER1"],
  now,
});
assert.equal(arabicSpiderMan.bookingRef, "SPIDER1", "a distinctive two-word transliteration may identify a unique longer title");
for (const [movieTitle, text] of [
  ["Sakr w Canaria", "الغي حجز صقر و كناريا"],
  ["The Odyssey", "الغي حجز الأوديسة"],
  ["El Gawahergy", "الغي حجز الجواهرجي"],
  ["Khali Balak Min Nafsik", "الغي حجز خلي بالك من نفسك"],
  ["Shamshoun w Dalila", "الغي حجز شمشون و دليلة"],
]) {
  const ref = `AR-${movieTitle}`;
  const result = resolveConversationalCancellation({
    text,
    bookings: [booking({ ref, movieTitle, performanceDate: "2026-07-30", showtime: "20:00" })],
    displayedBookingRefs: [ref],
    now,
  });
  assert.equal(result.bookingRef, ref, `${text}: a curated current-title alias must select the English stored title`);
}
const mirdifByArabicAlias = resolveConversationalCancellation({
  text: "الحجز في مردف",
  bookings: [missionEarly, missionLate],
  displayedBookingRefs: [missionEarly.ref, missionLate.ref],
  now,
});
assert.equal(mirdifByArabicAlias.bookingRef, missionLate.ref, "an Arabic cinema alias must select the English stored cinema");
for (const text of ["افتح حجز موانا", "اختر موانا", "تفاصيل حجز موانا", "اعرض تفاصيل موانا"]) {
  const result = resolveConversationalCancellation({
    text,
    bookings: [ineligible],
    displayedBookingRefs: [ineligible.ref],
    now,
    ignoreLifecycle: true,
  });
  assert.equal(result.bookingRef, ineligible.ref, `${text}: Arabic history wrappers must preserve the named booking`);
}

assert.equal(passed.length, 16);
console.log(`Validated ${passed.length} required conversational cancellation scenarios plus English and Arabic date, time, cinema, context, ambiguity, and safety coverage.`);
