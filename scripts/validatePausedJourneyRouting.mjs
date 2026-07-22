import assert from "node:assert/strict";
import { isResumeCheckoutTurn, isResumeOnlyTurn, pausedResumeTarget } from "../src/lib/pausedJourneyRouting.js";

for (const [phrase, target] of [
  ["Continue my booking", "journey"],
  ["Resume the booking", "journey"],
  ["Go back to the seats", "seatmap"],
  ["Show the showtimes again", "showtimes"],
  ["Back to my showtimes", "showtimes"],
  ["Return to checkout", "checkout"],
  ["Continue cancellation", "cancellation"],
  ["Show my booking history again", "history"],
  ["Continue where I stopped", "last"],
  ["Continue where I left off", "last"],
  ["أكمل من حيث توقفت", "last"],
  ["متابعة حجزي", "journey"],
  ["العودة إلى الدفع", "checkout"],
]) {
  assert.equal(pausedResumeTarget(phrase), target, `${phrase}: must restore ${target}`);
}

for (const phrase of ["Continue", "Resume please", "متابعة", "أكمل من فضلك"]) {
  assert.equal(isResumeOnlyTurn(phrase), true, `${phrase}: must be a generic last-stage restore`);
  assert.equal(pausedResumeTarget(phrase), "last", `${phrase}: must target the most recently paused stage`);
}

for (const phrase of ["yes", "proceed", "نعم"]) {
  assert.equal(isResumeOnlyTurn(phrase), false, `${phrase}: an affirmative must not become an unconditional global resume command`);
  assert.equal(pausedResumeTarget(phrase), null, `${phrase}: without pending affirmative recovery state, the turn must remain available to the active flow`);
  assert.equal(
    pausedResumeTarget(phrase, { affirmativeRecoveryPending: true }),
    "last",
    `${phrase}: an affirmative must restore the last stage only while an explicit recovery confirmation is pending`,
  );
  assert.equal(
    pausedResumeTarget(phrase, { affirmativeRecoveryPending: false }),
    null,
    `${phrase}: consuming the pending recovery state must prevent a repeated resume loop`,
  );
}
assert.equal(pausedResumeTarget("yes, cancel it", { affirmativeRecoveryPending: true }), null, "a cancellation decision must not be intercepted as journey recovery");
assert.equal(pausedResumeTarget("yes, confirm seats", { affirmativeRecoveryPending: true }), null, "a seat confirmation must not be intercepted as journey recovery");
assert.equal(pausedResumeTarget("pay now", { affirmativeRecoveryPending: true }), null, "payment wording must never be treated as affirmative journey recovery");

assert.equal(isResumeCheckoutTurn("Return to checkout"), true);
assert.equal(pausedResumeTarget("What does PG mean?"), null);
assert.equal(pausedResumeTarget("Cancel my booking"), null, "record cancellation must not be mistaken for journey restoration");

console.log("Validated English and Arabic paused-stage routing for booking, showtimes, seats, checkout, cancellation, history, and generic last-step restoration.");
