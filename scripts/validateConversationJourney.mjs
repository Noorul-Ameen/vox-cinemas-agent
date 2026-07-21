import assert from "node:assert/strict";
import {
  buildTransportHandoff,
  createConversationJourney,
  journeyDynamicVariables,
  journeyReducer,
  syncJourney,
} from "../src/lib/conversationJourney.js";
import { DATA_DATES } from "../src/mockVistaData.js";

const logicalId = "voxi-logical-1";
let state = createConversationJourney(logicalId);
const cinemaOnlyState = syncJourney(state, {
  locale: "en",
  cinema: { id: "c1", name: "VOX - Test" },
  scheduleDate: null,
  stage: { view: "cinemas" },
  selectedSeats: [],
});
assert.equal(cinemaOnlyState.scheduleDate, null, "a published browse date must not become a guest-selected journey date");
assert.equal(journeyDynamicVariables(cinemaOnlyState, { continuation: true }).voxi_performance_date, "not_selected");
assert.match(buildTransportHandoff(cinemaOnlyState, []), /"date":"not selected"/, "a language or transport switch must still ask for an unselected date");

state = syncJourney(state, {
  locale: "en",
  cinema: { id: "c1", name: "VOX - Test" },
  scheduleDate: "2026-07-14",
  stage: {
    view: "seatmap",
    movie: { id: "m1", title: "Example", posterUrl: "https://example.com/poster.jpg" },
    session: { sessionId: "s1", date: "2026-07-14", time: "19:00", exp: "IMAX", screen: "Screen 1" },
  },
  selectedSeats: ["A1", "A2"],
});

assert.equal(state.sessionId, logicalId, "the logical session ID must survive journey transitions");
assert.equal(state.movie.title, "Example");
assert.equal(state.session.time, "19:00");
assert.equal(state.ticketQuantity, 2);
assert.deepEqual(state.seats, ["A1", "A2"]);
assert.equal(state.bookingProgress, "seat_selection");
assert.equal(journeyDynamicVariables(state, { continuation: true }).voxi_performance_date, "2026-07-14", "an explicit session date must survive a transport switch");

const movieBrowseState = syncJourney(state, {
  cinema: { id: "c1", name: "VOX - Test" },
  scheduleDate: "2026-07-14",
  stage: { view: "movies", movies: [] },
  selectedSeats: [],
});
assert.equal(movieBrowseState.ticketQuantity, null, "leaving a session must clear the actual ticket count because no seats are selected");
assert.deepEqual(movieBrowseState.seats, [], "movie browsing must not retain incompatible seats");

const pausedState = syncJourney(state, {
  locale: "ar",
  cinema: state.cinema,
  scheduleDate: state.scheduleDate,
  stage: { view: "empty", paused: true, pausedView: "seatmap" },
  selectedSeats: state.seats,
  pendingOrder: null,
});
assert.equal(pausedState.session.id, "s1", "a non-session sync must preserve the compacted session ID while the journey is paused");
assert.deepEqual(pausedState.seats, ["A1", "A2"], "a paused transport handoff must preserve active seats");

const clearedState = syncJourney(pausedState, {
  cinema: null,
  scheduleDate: null,
  stage: { view: "cinemas" },
  selectedSeats: [],
  pendingOrder: null,
  booking: null,
});
assert.equal(clearedState.cinema, null, "an explicit cinema reset must clear the old journey cinema");
assert.equal(clearedState.scheduleDate, null, "an explicit date reset must clear the old journey date");
assert.equal(clearedState.movie, null, "returning upstream to cinema selection must clear the old movie");
assert.equal(clearedState.session, null, "returning upstream to cinema selection must clear the old showtime");
assert.deepEqual(clearedState.seats, [], "an explicit empty seat selection must clear old seats");
assert.equal(clearedState.ticketQuantity, null, "cleared seats must clear ticket quantity");
assert.doesNotMatch(buildTransportHandoff(clearedState, []), /Example|VOX - Test|A1|19:00/, "transport handoff must not leak invalidated booking criteria");

const variables = journeyDynamicVariables({ ...state, transportConversationId: "old-eleven-id" }, { continuation: true });
assert.equal(variables.voxi_session_id, logicalId);
assert.equal(variables.voxi_previous_conversation_id, "old-eleven-id");
assert.equal(variables.voxi_is_continuation, "true");

const handoff = buildTransportHandoff(state, [
  { role: "user", text: "My card is 4111 1111 1111 1111 and OTP: 123456" },
  { role: "agent", text: "We will continue with your seats." },
]);
assert.match(handoff, /same Voxi journey/i);
assert.match(handoff, /Example/);
assert.doesNotMatch(handoff, /4111 1111 1111 1111/);
assert.doesNotMatch(handoff, /OTP:\s*123456/i);

state = journeyReducer(state, { type: "reset", sessionId: "voxi-logical-2" });
assert.equal(state.sessionId, "voxi-logical-2");
assert.equal(state.bookingProgress, "start");
assert.equal(state.movie, null);

const dates = [...DATA_DATES];
assert.ok(dates.length > 1, "the full extracted programming window must be exposed");
assert.deepEqual([...dates].sort(), dates, "programming dates must stay chronological");

console.log("Validated shared logical journey state, seat-derived ticket count, redacted text-to-voice handoff, reset, and multi-date programming.");
