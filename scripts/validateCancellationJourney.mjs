import assert from "node:assert/strict";
import {
  CANCELLATION_TARGET_SELECTION_PURPOSE,
  bookingHistoryAgentContext,
  classifyBookingHistoryRequest,
  isCurrentBooking,
  isDirectCancellationRequest,
  resolveCancellationContinuation,
  resolveCancellationTarget,
  resolveHistoryContinuation,
  sortBookingsForDisplay,
} from "../src/lib/cancellationRouting.js";
import { buildFaqContextForQuery, isGenuineFaqQuestion } from "../src/knowledge/index.js";
import { resolveLocalOfferTextTurn } from "../src/offers/offerTextFallback.js";

const activeA = Object.freeze({
  ref: "WLACTIVE1",
  movieTitle: "Active One",
  performanceDate: "2026-07-15",
  cancelled: false,
  bookingStatus: "confirmed_demo",
  email: "guest@example.com",
  cardNumber: "4111111111111111",
});
const activeB = Object.freeze({
  ref: "WLACTIVE2",
  movieTitle: "Active Two",
  performanceDate: "2026-07-16",
  cancelled: false,
  bookingStatus: "confirmed_demo",
});
const cancelled = Object.freeze({
  ref: "WLCANCELLED",
  movieTitle: "Cancelled",
  performanceDate: "2026-07-14",
  cancelled: true,
  bookingStatus: "cancelled_demo",
});
const dubaiNoon = new Date("2026-07-13T08:00:00.000Z");
const resolveAtFixtureTime = (input) => resolveCancellationTarget({
  ...input,
  now: dubaiNoon,
});
const elapsed = Object.freeze({
  ref: "WLELAPSED",
  movieTitle: "Past Show",
  performanceDate: "2026-07-13",
  showtime: "11:30",
  cancelled: false,
  bookingStatus: "confirmed_demo",
});
const laterToday = Object.freeze({
  ref: "WLLATERTODAY",
  movieTitle: "Later Today",
  performanceDate: "2026-07-13",
  showtime: "12:30",
  cancelled: false,
  bookingStatus: "confirmed_demo",
});

assert.equal(isCurrentBooking(activeA, { now: dubaiNoon }), true, "a future non-cancelled booking must be current");
assert.equal(isCurrentBooking(laterToday, { now: dubaiNoon }), true, "a later show today must remain current");
assert.equal(isCurrentBooking(elapsed, { now: dubaiNoon }), false, "an elapsed showtime must not appear under current bookings");
assert.equal(isCurrentBooking(cancelled, { now: dubaiNoon }), false, "a cancelled record must not be current");
assert.equal(isCurrentBooking({ ...activeA, bookingStatus: "expired" }, { now: dubaiNoon }), false, "an explicitly inactive status must not be current");

for (const [text, activeOnly] of [
  ["Show my current bookings", true],
  ["What are my current bookings?", true],
  ["Show my active booking", true],
  ["Show my upcoming bookings", true],
  ["اعرض حجوزاتي الحالية", true],
  ["ما هي حجوزاتي الحالية؟", true],
  ["اعرض حجوزاتي النشطة", true],
  ["Show my bookings", false],
  ["Show my booking history", false],
  ["My previous bookings", false],
  ["Do I have any bookings?", false],
  ["What bookings do I have?", false],
  ["Are there any bookings on this device?", false],
  ["Show my tickets", false],
  ["List my tickets", false],
  ["هل لدي أي حجوزات؟", false],
  ["هل عندي حجوزات؟", false],
  ["ما هي حجوزاتي؟", false],
  ["اعرض تذاكري", false],
  ["Do I have any bookings to cancel?", true],
  ["Show bookings I can cancel", true],
  ["Which booking can I cancel?", true],
  ["هل لدي حجوزات يمكنني إلغاؤها؟", true],
  ["اعرض الحجوزات التي يمكنني إلغاؤها", true],
  ["اعرض سجل الحجوزات", false],
]) {
  assert.deepEqual(
    classifyBookingHistoryRequest(text),
    { requested: true, activeOnly },
    `${text}: booking-history scope must be classified deterministically`,
  );
}
for (const text of ["What movies are showing?", "What is my current cinema?", "ما هي الأفلام الحالية؟"]) {
  assert.deepEqual(
    classifyBookingHistoryRequest(text),
    { requested: false, activeOnly: false },
    `${text}: unrelated discovery must not open booking history`,
  );
}
for (const text of ["Open booking WLR215D", "View booking reference WLR215D", "Select booking Toy Story 5"]) {
  assert.deepEqual(
    classifyBookingHistoryRequest(text),
    { requested: false, activeOnly: false },
    `${text}: a targeted visible booking selection must not be mistaken for a request to reopen the history list`,
  );
}
const coldHistorySelection = await resolveHistoryContinuation({
  text: "Open booking WLR215D",
  stage: { view: "history", historyFilter: "all" },
  storedBookings: [{ ...activeA, ref: "WLR215D" }],
  now: dubaiNoon,
});
assert.equal(coldHistorySelection.bookingRef, "WLR215D", "a first text turn must resolve the stored history entry before React mirrors the visible history array");

const ordinaryHistoryStage = {
  view: "history",
  historyFilter: "all",
  bookings: [activeA, activeB],
};
const cancellationTargetStage = {
  view: "history",
  purpose: CANCELLATION_TARGET_SELECTION_PURPOSE,
  candidateRefs: [activeA.ref, activeB.ref],
};
for (const { query, expectedSource } of [
  { query: "Is parking available at Mall of the Emirates?", expectedSource: "faq" },
  { query: "Do you have any FAB offers?", expectedSource: "offer" },
]) {
  const faq = buildFaqContextForQuery(query, { locale: "en", minScore: 35 });
  const localOffer = resolveLocalOfferTextTurn(query, { locale: "en" });
  if (expectedSource === "faq") {
    assert.ok(faq.matches.length > 0, `${query}: the approved FAQ catalog must match`);
    assert.equal(
      isGenuineFaqQuestion(query, { matches: faq.matches }),
      true,
      `${query}: an explicit knowledge question must bypass visible record selectors`,
    );
  } else {
    assert.ok(localOffer, `${query}: the deterministic bank-offer resolver must match`);
  }
  const bypassForFaq = Boolean(localOffer) || isGenuineFaqQuestion(query, { matches: faq.matches });
  assert.equal(bypassForFaq, true, `${query}: approved knowledge must bypass visible record selectors`);
  const historyFaq = await resolveHistoryContinuation({
    text: query,
    stage: ordinaryHistoryStage,
    storedBookings: [activeA, activeB],
    now: dubaiNoon,
    bypassForFaq,
  });
  assert.deepEqual(
    { handled: historyFaq.handled, reason: historyFaq.reason },
    { handled: false, reason: "faq_question" },
    `${query}: an ordinary history list must yield to the FAQ answer`,
  );
  const cancellationFaq = await resolveCancellationContinuation({
    text: query,
    stage: cancellationTargetStage,
    storedBookings: [activeA, activeB],
    now: dubaiNoon,
    bypassForFaq,
  });
  assert.deepEqual(
    { handled: cancellationFaq.handled, reason: cancellationFaq.reason },
    { handled: false, reason: "faq_question" },
    `${query}: cancellation target selection must yield to the FAQ answer`,
  );
}

const ordinalFaqNoise = buildFaqContextForQuery("first booking", { locale: "en", minScore: 35 });
assert.ok(ordinalFaqNoise.matches.length > 0, "the regression fixture must exercise a real low-score FAQ collision");
assert.equal(
  isGenuineFaqQuestion("first booking", { matches: ordinalFaqNoise.matches }),
  false,
  "a record selector must not be treated as a genuine FAQ merely because retrieval found generic booking knowledge",
);
for (const text of [
  "What is the cancellation policy for my booking?",
  "Cancel my booking",
  "هل يمكنني إلغاء حجزي؟",
]) {
  assert.deepEqual(
    classifyBookingHistoryRequest(text),
    { requested: false, activeOnly: false },
    `${text}: cancellation requests and policy questions must not open booking history`,
  );
}
for (const text of [
  "Do I have any bookings to cancel?",
  "Show bookings I can cancel",
  "Which booking can I cancel?",
  "هل لدي حجوزات يمكنني إلغاؤها؟",
]) {
  assert.equal(isDirectCancellationRequest(text), false, `${text}: asking for a safe list must never authorize cancellation`);
}

for (const text of [
  "Cancel my booking",
  "Cancel this booking",
  "Cancel a booking",
  "Cancel Mission Impossible",
  "Cancel the booking for the 18th",
  "Cancel the evening booking",
  "Cancel the second booking",
  "Cancel booking for tomorrow",
  "Please cancel one reservation",
  "Please cancel booking WLACTIVE1",
  "Cancel my The Odyssey booking",
  "I want to cancel my reservation",
  "ألغي حجزي",
  "الغي هذا الحجز",
  "أريد إلغاء حجزي",
]) {
  assert.equal(isDirectCancellationRequest(text), true, `${text}: direct cancellation must bypass FAQ rendering`);
}
for (const text of ["Cancel it", "Please cancel it", "ألغه", "ألغيها"]) {
  assert.equal(isDirectCancellationRequest(text), false, `${text}: a pronoun alone must not cancel without booking context`);
  assert.equal(
    isDirectCancellationRequest(text, { hasBookingContext: true }),
    true,
    `${text}: the same pronoun must continue a visible booking journey`,
  );
}
for (const text of [
  "Can I cancel a booking?",
  "Can I cancel my booking?",
  "Can I please cancel booking for tomorrow?",
  "Could I cancel Mission Impossible?",
  "When can I cancel the evening booking?",
  "What happens if I cancel the second booking?",
  "What is the cancellation policy?",
  "How do refunds work?",
  "هل يمكنني إلغاء الحجز؟",
  "ما هي سياسة الإلغاء؟",
  "كيف يعمل الاسترداد؟",
]) {
  assert.equal(
    isDirectCancellationRequest(text, { hasBookingContext: true }),
    false,
    `${text}: a policy question must remain informational even with visible booking context`,
  );
}
for (const text of [
  "Do not cancel my booking",
  "Please don't cancel Mission Impossible",
  "لا تلغي حجزي",
  "لا أريد إلغاء الحجز",
  "لا أريدك أن تلغي حجزي",
  "ما أبي ألغي حجزي",
  "لا تقم بإلغاء الحجز",
]) {
  assert.equal(isDirectCancellationRequest(text, { hasBookingContext: true }), false, `${text}: a negated request must not begin cancellation`);
}
assert.equal(
  isDirectCancellationRequest("لا أستطيع الحضور وأريد إلغاء حجزي", { hasBookingContext: true }),
  true,
  "an unrelated Arabic negative clause must not suppress a later explicit cancellation request",
);

const newestBooking = Object.freeze({ ...activeA, ref: "WLNEWEST", createdAt: "2026-07-13T11:00:00.000Z", showtime: "20:30", cinemaName: "VOX Mall of the Emirates" });
const olderBooking = Object.freeze({ ...activeB, ref: "WLOLDER", createdAt: "2026-07-12T11:00:00.000Z", showtime: "18:00", cinemaName: "VOX City Centre Mirdif" });
const unsortedBookings = [olderBooking, newestBooking];
assert.deepEqual(
  sortBookingsForDisplay(unsortedBookings).map((booking) => booking.ref),
  [newestBooking.ref, olderBooking.ref],
  "booking display order must be newest first",
);
assert.deepEqual(unsortedBookings.map((booking) => booking.ref), [olderBooking.ref, newestBooking.ref], "display sorting must not mutate stored history");

const explicitRequested = resolveAtFixtureTime({
  requestedRef: "wlactive2",
  text: "Cancel it",
  visibleBooking: activeA,
  storedBookings: [activeA, activeB, cancelled],
});
assert.equal(explicitRequested.bookingRef, activeB.ref, "an explicit requested reference must beat the visible booking");
assert.equal(explicitRequested.booking, activeB);
assert.match(explicitRequested.source, /explicit|requested|reference/i);
assert.equal(explicitRequested.reason, null);

const explicitInText = resolveAtFixtureTime({
  text: "Please cancel booking wlactive2",
  visibleBooking: activeA,
  storedBookings: [activeA, activeB, cancelled],
});
assert.equal(explicitInText.bookingRef, activeB.ref, "a reference in the utterance must beat the visible booking");
assert.equal(explicitInText.booking, activeB);
assert.match(explicitInText.source, /explicit|text|spoken|reference/i);

const namedMovieBooking = Object.freeze({ ...activeB, ref: "WLODYSS5Y", movieTitle: "The Odyssey" });
const namedMovieTarget = resolveAtFixtureTime({
  text: "Cancel my The Odyssey booking",
  storedBookings: [activeA, namedMovieBooking, cancelled],
});
assert.equal(namedMovieTarget.bookingRef, namedMovieBooking.ref, "a direct cancellation naming one stored movie must not enter movie discovery");
assert.equal(namedMovieTarget.source, "spoken_title");
assert.equal(namedMovieTarget.reason, null);
const cancelledNamedDuplicate = Object.freeze({ ...cancelled, ref: "WLODYOLD", movieTitle: "The Odyssey" });
const namedMovieWithCancelledHistory = resolveAtFixtureTime({
  text: "Cancel my The Odyssey booking",
  storedBookings: [activeA, namedMovieBooking, cancelledNamedDuplicate],
});
assert.equal(namedMovieWithCancelledHistory.bookingRef, namedMovieBooking.ref, "one current title match must beat an older cancelled record for the same movie");

const visibleSelection = resolveAtFixtureTime({
  text: "Cancel it",
  visibleBooking: activeA,
  storedBookings: [activeA, activeB, cancelled],
});
assert.equal(visibleSelection.bookingRef, activeA.ref, "the selected visible booking must beat sole-active inference");
assert.equal(visibleSelection.booking, activeA);
assert.match(visibleSelection.source, /visible|selected/i);

const visibleCancelledSelection = resolveAtFixtureTime({
  text: "Cancel it",
  visibleBooking: cancelled,
  storedBookings: [cancelled, activeA],
});
assert.equal(visibleCancelledSelection.bookingRef, cancelled.ref, "a contextual request on a visible cancelled booking must not jump to a different active booking");
assert.equal(visibleCancelledSelection.booking, cancelled);
assert.equal(visibleCancelledSelection.reason, "already_cancelled");
assert.match(visibleCancelledSelection.source, /visible|selected/i);

const soleActive = resolveAtFixtureTime({
  text: "Cancel my current booking",
  storedBookings: [cancelled, activeA],
});
assert.equal(soleActive.bookingRef, activeA.ref, "one non-cancelled stored booking may be selected deterministically");
assert.equal(soleActive.booking, activeA);
assert.match(soleActive.source, /sole|single|active/i);
assert.deepEqual(soleActive.candidates, [activeA.ref], "cancelled records must be excluded from active candidates");

const noActive = resolveAtFixtureTime({
  text: "Cancel my current booking",
  storedBookings: [cancelled],
});
assert.equal(noActive.bookingRef, null);
assert.equal(noActive.booking, null);
assert.equal(noActive.reason, "no_active_booking");
assert.deepEqual(noActive.candidates, [], "a cancelled record must never be offered for cancellation again");

const multipleActive = resolveAtFixtureTime({
  text: "Cancel my current booking",
  storedBookings: [cancelled, activeA, activeB],
});
assert.equal(multipleActive.bookingRef, null, "multiple active bookings must never be resolved arbitrarily");
assert.equal(multipleActive.booking, null);
assert.equal(multipleActive.reason, "multiple_active_bookings");
assert.deepEqual(
  multipleActive.candidates,
  [activeA.ref, activeB.ref],
  "selection-required results must expose only active booking candidates",
);

const elapsedOnly = resolveAtFixtureTime({
  text: "Cancel my current booking",
  storedBookings: [cancelled, elapsed],
});
assert.equal(elapsedOnly.bookingRef, null, "an elapsed booking must not be auto-selected as the current booking");
assert.equal(elapsedOnly.reason, "no_active_booking");

const visibleElapsed = resolveAtFixtureTime({
  text: "Cancel it",
  visibleBooking: elapsed,
  storedBookings: [elapsed, activeA],
});
assert.equal(visibleElapsed.bookingRef, elapsed.ref, "a contextual request must stay attached to the visible elapsed booking");
assert.equal(visibleElapsed.reason, "not_current_booking", "the visible elapsed booking must be identified without falling through to another record");

const alreadyCancelled = resolveAtFixtureTime({
  requestedRef: cancelled.ref,
  visibleBooking: activeA,
  storedBookings: [activeA, cancelled],
});
assert.equal(alreadyCancelled.bookingRef, cancelled.ref, "an explicit cancelled reference must not silently fall back to another booking");
assert.equal(alreadyCancelled.booking, cancelled);
assert.equal(alreadyCancelled.reason, "already_cancelled");

const unknownReference = resolveAtFixtureTime({
  requestedRef: "WLMISSING",
  visibleBooking: activeA,
  storedBookings: [activeA],
});
assert.equal(unknownReference.bookingRef, "WLMISSING", "an unknown explicit reference must be preserved for provider lookup instead of falling back to the selected booking");
assert.equal(unknownReference.booking, null);
assert.equal(unknownReference.source, "requested_ref");
assert.equal(unknownReference.reason, null);

const selectionStage = Object.freeze({
  view: "history",
  purpose: CANCELLATION_TARGET_SELECTION_PURPOSE,
  candidateRefs: [activeA.ref, activeB.ref],
});
const uniqueTitleContinuation = await resolveCancellationContinuation({
  text: activeB.movieTitle,
  stage: selectionStage,
  storedBookings: [activeA, activeB, cancelled],
});
assert.equal(uniqueTitleContinuation.handled, true, "a displayed movie title must remain in cancellation routing");
assert.equal(uniqueTitleContinuation.bookingRef, activeB.ref, "one exact displayed title must resolve its booking reference");
assert.equal(uniqueTitleContinuation.reason, "matched_unique_title");

const ampersandTitleBooking = Object.freeze({ ...activeA, ref: "WLMINIONS", movieTitle: "Minions & Monsters" });
const ampersandTitleContinuation = await resolveCancellationContinuation({
  text: "Minions and Monsters",
  stage: { ...selectionStage, candidateRefs: [ampersandTitleBooking.ref] },
  storedBookings: [ampersandTitleBooking],
});
assert.equal(ampersandTitleContinuation.bookingRef, ampersandTitleBooking.ref, "a spoken and must match an ampersand in the displayed cancellation title");

const spokenNumberContinuation = await resolveCancellationContinuation({
  text: "Please cancel Active two",
  stage: selectionStage,
  storedBookings: [activeA, activeB, cancelled],
});
assert.equal(spokenNumberContinuation.bookingRef, activeB.ref, "voice number words and a tightly scoped cancellation prefix must match the displayed title exactly");

const toyStoryBooking = Object.freeze({ ...activeB, ref: "WLTOYSTORY5", movieTitle: "Toy Story 5", cinemaName: "VOX - Mall of the Emirates" });
const toyStoryVoiceContinuation = await resolveCancellationContinuation({
  text: "Toy Story five",
  stage: { ...selectionStage, candidateRefs: [activeA.ref, toyStoryBooking.ref] },
  storedBookings: [activeA, toyStoryBooking],
});
assert.equal(toyStoryVoiceContinuation.bookingRef, toyStoryBooking.ref, "Toy Story five from speech recognition must match the displayed Toy Story 5 booking");

const movieFieldBooking = Object.freeze({ ...activeA, ref: "WLMOVIEFIELD", movieTitle: undefined, movie: "Movie Field Title" });
const movieFieldContinuation = await resolveCancellationContinuation({
  text: "Movie Field Title",
  stage: { ...selectionStage, candidateRefs: [movieFieldBooking.ref] },
  storedBookings: [movieFieldBooking],
});
assert.equal(movieFieldContinuation.bookingRef, movieFieldBooking.ref, "completed records using the movie field must resolve by displayed title");

const explicitReferenceContinuation = await resolveCancellationContinuation({
  text: `Cancel booking ${activeA.ref}`,
  stage: selectionStage,
  storedBookings: [activeA, activeB, cancelled],
});
assert.equal(explicitReferenceContinuation.bookingRef, activeA.ref, "an exact displayed reference token must select that booking");
assert.equal(explicitReferenceContinuation.reason, "matched_reference");

const duplicateTitleA = Object.freeze({ ...activeA, ref: "WLDUPLICATE1", movieTitle: "Same Film" });
const duplicateTitleB = Object.freeze({ ...activeB, ref: "WLDUPLICATE2", movieTitle: "Same Film" });
const duplicateTitleContinuation = await resolveCancellationContinuation({
  text: "Same Film",
  stage: { ...selectionStage, candidateRefs: [duplicateTitleA.ref, duplicateTitleB.ref] },
  storedBookings: [duplicateTitleA, duplicateTitleB],
});
assert.equal(duplicateTitleContinuation.handled, true, "an ambiguous title must stay inside cancellation target selection");
assert.equal(duplicateTitleContinuation.bookingRef, null, "duplicate titles must never select a booking arbitrarily");
assert.equal(duplicateTitleContinuation.reason, "ambiguous_movie_title");
assert.deepEqual(duplicateTitleContinuation.candidates, [duplicateTitleA.ref, duplicateTitleB.ref]);

const questionWordTitle = Object.freeze({
  ...activeA,
  ref: "WLHOWTRAIN",
  movieTitle: "How to Train Your Dragon",
  showtime: "18:00",
});
const showWordTitle = Object.freeze({
  ...activeB,
  ref: "WLSHOWDOGS",
  movieTitle: "Show Dogs",
  showtime: "20:30",
});
const naturalSelectionStage = Object.freeze({
  ...selectionStage,
  candidateRefs: [questionWordTitle.ref, showWordTitle.ref],
});
for (const [text, expectedRef] of [
  ["How to Train Your Dragon", questionWordTitle.ref],
  ["Show Dogs please", showWordTitle.ref],
  ["the first one", questionWordTitle.ref],
  ["booking number 2", showWordTitle.ref],
  ["the 8:30 PM one", showWordTitle.ref],
  ["I mean How to Train Your Dragon", questionWordTitle.ref],
]) {
  const continuation = await resolveCancellationContinuation({
    text,
    stage: naturalSelectionStage,
    storedBookings: [questionWordTitle, showWordTitle],
    now: dubaiNoon,
  });
  assert.equal(continuation.handled, true, `${text}: a natural displayed-candidate selector must stay in cancellation routing`);
  assert.equal(continuation.bookingRef, expectedRef, `${text}: the natural selector must resolve the intended displayed booking`);
}

const duplicateTimedA = Object.freeze({ ...duplicateTitleA, showtime: "18:00" });
const duplicateTimedB = Object.freeze({ ...duplicateTitleB, showtime: "20:30" });
const duplicateTimeContinuation = await resolveCancellationContinuation({
  text: "the 8:30 PM one",
  stage: { ...selectionStage, candidateRefs: [duplicateTimedA.ref, duplicateTimedB.ref] },
  storedBookings: [duplicateTimedA, duplicateTimedB],
  now: dubaiNoon,
});
assert.equal(duplicateTimeContinuation.bookingRef, duplicateTimedB.ref, "a showtime must disambiguate duplicate displayed movie titles");

const unrelatedStage = await resolveCancellationContinuation({
  text: activeA.movieTitle,
  stage: { view: "movies", purpose: CANCELLATION_TARGET_SELECTION_PURPOSE, candidateRefs: [activeA.ref] },
  storedBookings: [activeA],
});
assert.equal(unrelatedStage.handled, false, "candidate matching must require the explicit cancellation history purpose");

for (const contextChange of [
  "Go back",
  "Show me movies",
  "Show my current bookings",
  "What is the cancellation policy?",
  "لا تلغي حجزي",
  "لا أريد إلغاء الحجز",
]) {
  const continuation = await resolveCancellationContinuation({
    text: contextChange,
    stage: selectionStage,
    storedBookings: [activeA, activeB],
  });
  assert.equal(continuation.handled, false, `${contextChange}: an explicit task change or FAQ must not trap the guest in cancellation target selection`);
}

const historyRecords = [
  { ...questionWordTitle, performanceDate: "2026-07-12", bookingStatus: "past" },
  { ...showWordTitle, cancelled: true, bookingStatus: "cancelled_demo" },
  toyStoryBooking,
];
const historyStage = Object.freeze({ view: "history", bookings: historyRecords, historyFilter: "all" });
for (const [text, expectedRef] of [
  [questionWordTitle.ref.toLowerCase(), questionWordTitle.ref],
  ["How to Train Your Dragon", questionWordTitle.ref],
  ["Show Dogs", showWordTitle.ref],
  ["Toy Story five", toyStoryBooking.ref],
  ["the first one", questionWordTitle.ref],
  ["the 8:30 PM one", showWordTitle.ref],
]) {
  const continuation = await resolveHistoryContinuation({
    text,
    stage: historyStage,
    storedBookings: historyRecords,
    now: dubaiNoon,
  });
  assert.equal(continuation.handled, true, `${text}: a visible history selector must stay in booking history`);
  assert.equal(continuation.bookingRef, expectedRef, `${text}: past, cancelled, and active history records must remain selectable`);
}

const ambiguousHistory = await resolveHistoryContinuation({
  text: "Same Film",
  stage: { view: "history", bookings: [duplicateTimedA, duplicateTimedB], historyFilter: "all" },
  storedBookings: [duplicateTimedA, duplicateTimedB],
  now: dubaiNoon,
});
assert.equal(ambiguousHistory.handled, true, "duplicate history titles must remain inside history");
assert.equal(ambiguousHistory.bookingRef, null, "duplicate history titles must not select a record arbitrarily");
assert.equal(ambiguousHistory.reason, "ambiguous_history_booking");

for (const text of ["Atlantis", "booking ref WLMISSING"]) {
  const continuation = await resolveHistoryContinuation({ text, stage: historyStage, storedBookings: historyRecords, now: dubaiNoon });
  assert.equal(continuation.handled, true, `${text}: an unknown short selector must stay in history`);
  assert.equal(continuation.bookingRef, null, `${text}: an unknown selector must never fall back to the sole or first booking`);
}
for (const text of ["What is Toy Story 5 about?", "Cancel Toy Story 5", "Show me movies"]) {
  const continuation = await resolveHistoryContinuation({ text, stage: historyStage, storedBookings: historyRecords, now: dubaiNoon });
  assert.equal(continuation.handled, false, `${text}: movie information, cancellation, and explicit task changes must leave generic history selection`);
}
for (const text of [
  `Tell me about ${toyStoryBooking.ref}`,
  `Tell me about booking ${toyStoryBooking.ref}`,
  `Show details for booking ${toyStoryBooking.ref}`,
  `What are the details of ${toyStoryBooking.ref}?`,
  "Tell me about my Toy Story 5 booking",
  "select Toy Story 5",
  "choose Toy Story 5",
  "pick Toy Story 5",
  "open Toy Story 5",
  "view Toy Story 5",
]) {
  const continuation = await resolveHistoryContinuation({ text, stage: historyStage, storedBookings: historyRecords, now: dubaiNoon });
  assert.equal(continuation.handled, true, `${text}: an explicit booking-detail selector must open the visible record`);
  assert.equal(continuation.bookingRef, toyStoryBooking.ref);
}

for (const text of [
  "I'd like to cancel Active Two",
  "Can you cancel Active Two?",
  "Could you cancel Active Two?",
  "I want a refund for Active Two",
  "I no longer want my Active Two booking",
]) {
  assert.equal(isDirectCancellationRequest(text, { hasBookingContext: true }), true, `${text}: a direct target request must enter cancellation routing`);
}
for (const text of ["الغي حجز موانا", "ألغِ حجز موانا", "ألغي موانا", "ممكن تلغي حجز موانا", "رجع تذاكر موانا"]) {
  assert.equal(isDirectCancellationRequest(text, { hasBookingContext: true }), true, `${text}: a common Arabic direct target request must enter cancellation routing`);
}

for (const [text, expectedRef] of [
  ["The Toy Story 5 one", toyStoryBooking.ref],
  ["It's Toy Story 5", toyStoryBooking.ref],
  ["Mall of the Emirates one please", toyStoryBooking.ref],
  ["I'd like to open Toy Story 5", toyStoryBooking.ref],
  ["Open the Toy Story 5 one please", toyStoryBooking.ref],
]) {
  const continuation = await resolveHistoryContinuation({ text, stage: historyStage, storedBookings: historyRecords, now: dubaiNoon });
  assert.equal(continuation.handled, true, `${text}: natural wrapper words must stay in history selection`);
  assert.equal(continuation.bookingRef, expectedRef, `${text}: natural wrapper words must not hide the displayed target`);
}

const agentContext = bookingHistoryAgentContext([olderBooking, newestBooking, cancelled]);
const agentSummaries = JSON.parse(agentContext.match(/summaries: (\[.*\])\. These are/)?.[1] || "[]");
assert.deepEqual(agentSummaries.map((booking) => booking.bookingRef), [newestBooking.ref, olderBooking.ref, cancelled.ref], "agent history context must use the visible newest-first order");
assert.deepEqual(agentSummaries.map((booking) => booking.listPosition), [1, 2, 3], "agent history context must expose one-based visible list positions");
assert.equal(agentSummaries[0].showtime, newestBooking.showtime, "agent history context must expose the visible showtime");
assert.equal(agentSummaries[0].cinema, newestBooking.cinemaName, "agent history context must expose the visible cinema");
assert.match(agentContext, new RegExp(newestBooking.ref), "agent history context must include the active reference needed for cancellation");
assert.match(agentContext, new RegExp(cancelled.ref), "agent history context must include cancelled status for disambiguation");
assert.match(agentContext, /cancelled/i, "agent history context must label cancellation state explicitly");
assert.doesNotMatch(agentContext, /guest@example\.com|4111111111111111/, "agent history context must serialize an allowlist, not private booking fields");

console.log("Validated bilingual cancellation intent, deterministic targets, exact displayed-candidate continuation, duplicate-title safety, and safe booking-history context.");
