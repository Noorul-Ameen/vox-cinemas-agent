import assert from "node:assert/strict";
import {
  HANDOVER_SCHEMA_VERSION,
  HANDOVER_TRIGGER,
  buildHandoverPayload,
  isClarificationFailureReason,
  sanitizeTranscriptText,
} from "../src/lib/handoverSummary.js";

assert.match(sanitizeTranscriptText("My card is 4111 1111 1111 1111 and CVV 123"), /redacted/i);
assert.match(sanitizeTranscriptText("The show is at 20:30 on 08/15"), /20:30 on 08\/15/);
assert.equal(isClarificationFailureReason("fallback"), true);
assert.equal(isClarificationFailureReason("explicit_request"), false);

const payload = buildHandoverPayload({
  conversationId: "conversation-test",
  requestedAt: "2026-07-12T12:00:00.000Z",
  trigger: "clarification_failure",
  clarificationFailures: 2,
  locale: "ar-AE",
  cinema: { id: "0002", name: "Mall of the Emirates" },
  movie: { id: "HO1", title: "Test Movie" },
  session: { sessionId: "S1", time: "20:30", experience: "IMAX" },
  booking: { ref: "WLTEST", total: 126, currency: "AED", paidWith: "VISA 4242", cardNumber: "4111111111111111" },
  messages: [{ role: "user", text: "My card is 4111 1111 1111 1111 and CVV 123" }],
});

assert.equal(payload.schemaVersion, HANDOVER_SCHEMA_VERSION);
assert.equal(payload.event.trigger, HANDOVER_TRIGGER.FAILED_CLARIFICATIONS);
assert.equal(payload.integration.paymentDataIncluded, false);
assert.equal(payload.journey.booking.reference, "WLTEST");
assert.equal(payload.journey.session.time, "20:30");
const serialized = JSON.stringify(payload);
assert.doesNotMatch(serialized, /4111111111111111|paidWith|cardNumber|CVV 123/i);
assert.match(serialized, /redacted/i);

const cancelledPayload = buildHandoverPayload({
  selectedSeats: [],
  booking: { ref: "WLCANCEL", seats: ["E1", "E2"], cancelled: true, total: 84 },
  messages: [{ role: "system", text: "Payment completed" }, { role: "user", text: "Please cancel it" }],
});
assert.deepEqual(cancelledPayload.journey.seats, ["E1", "E2"]);
assert.equal(cancelledPayload.journey.booking.status, "cancelled");
assert.match(cancelledPayload.conversation.summary, /cancelled/i);
assert.equal(cancelledPayload.conversation.transcript[0].role, "system");
assert.equal(cancelledPayload.conversation.lastUserIntent, "Please cancel it");

console.log("Validated deterministic, payment-free VOXi handover payload and transcript redaction.");
