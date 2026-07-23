import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCheckoutTargetSeatEdit,
  isExplicitCheckoutTicketTargetTurn,
  resolveCheckoutSeatEditTurn,
} from "../src/lib/checkoutConversationRouting.js";
import { createSeatToolAuthorization, matchesSeatToolAuthorization, normalizeSeatIds, resolveSeatEditSelectionTurn, resolveSeatSelectionTurn, resolveSeatToolInput, SEAT_TOOL_AUTHORIZATION_TTL_MS } from "../src/lib/seatRouting.js";

const available = ["A1", "A2", "E1", "E2", "H12"];

assert.deepEqual(normalizeSeatIds("A1 and A2", available), ["A1", "A2"]);
assert.deepEqual(normalizeSeatIds("E one and E two", available), ["E1", "E2"], "voice number words must resolve against real seat IDs");
assert.deepEqual(normalizeSeatIds("H twelve", available), ["H12"]);
assert.deepEqual(normalizeSeatIds(["A one", "A two"], available), ["A1", "A2"]);
assert.deepEqual(resolveSeatToolInput(undefined, { availableSeatIds: available, currentSeats: ["A1"] }).seats, ["A1"], "an omitted tool argument must use the tapped seat");
assert.deepEqual(resolveSeatToolInput(["Z99"], { availableSeatIds: available, currentSeats: ["A1"] }), { provided: true, seats: [], invalidSeats: ["Z99"] }, "an explicit invalid seat must never silently confirm a tapped seat");
assert.deepEqual(resolveSeatToolInput(["A9"], { availableSeatIds: available, currentSeats: ["A1"] }), { provided: true, seats: [], invalidSeats: ["A9"] }, "an explicit unavailable seat must never silently confirm a tapped seat");
assert.deepEqual(resolveSeatToolInput(["A1", "Z99"], { availableSeatIds: available, currentSeats: [] }), { provided: true, seats: ["A1"], invalidSeats: ["Z99"] }, "mixed valid and invalid labels must preserve the invalid label for rejection");

assert.deepEqual(
  resolveSeatSelectionTurn("These are the seats I want", { availableSeatIds: available, currentSeats: ["A1"] }),
  {
    requested: true,
    confirmation: true,
    explicitSeats: [],
    invalidSeats: [],
    seats: ["A1"],
    reason: null,
  },
  "a natural confirmation must use the seats already tapped in the widget",
);

assert.deepEqual(
  resolveSeatSelectionTurn("هذه هي المقاعد التي أريدها", { availableSeatIds: available, currentSeats: ["E1", "E2"] }).seats,
  ["E1", "E2"],
  "Arabic confirmation must use the same visible seat selection",
);
assert.deepEqual(resolveSeatSelectionTurn("yes", { availableSeatIds: available, currentSeats: ["A1"] }).seats, ["A1"], "a short affirmative must confirm tapped seats while the seat map is active");
assert.deepEqual(resolveSeatSelectionTurn("Yes.", { availableSeatIds: available, currentSeats: ["A1"] }).seats, ["A1"], "voice transcript punctuation must not block a short confirmation");
assert.deepEqual(resolveSeatSelectionTurn("continue, please", { availableSeatIds: available, currentSeats: ["A1"] }).seats, ["A1"], "a narrow polite suffix must remain a seat confirmation");
assert.deepEqual(resolveSeatSelectionTurn("متابعة", { availableSeatIds: available, currentSeats: ["E1"] }).seats, ["E1"], "an Arabic continue command must confirm tapped seats");
assert.deepEqual(resolveSeatSelectionTurn("نعم، من فضلك.", { availableSeatIds: available, currentSeats: ["E1"] }).seats, ["E1"], "Arabic transcript punctuation and a polite suffix must remain a seat confirmation");
assert.deepEqual(resolveSeatSelectionTurn("A1 and Z99", { availableSeatIds: available }).invalidSeats, ["Z99"], "local text/voice routing must reject mixed unavailable labels instead of silently dropping them");
assert.equal(resolveSeatSelectionTurn("yes", { availableSeatIds: available }).requested, false, "a global yes without a visible selection must not be intercepted");
assert.equal(resolveSeatSelectionTurn("Is A1 available?", { availableSeatIds: available }).requested, false, "an availability question must not confirm a seat");
assert.equal(resolveSeatSelectionTurn("confirm seats", { availableSeatIds: available }).reason, "no_selected_seats");

const editableSeats = ["E1", "E2", "E3", "E4", "F3"];
const addOneFromCheckout = resolveCheckoutSeatEditTurn("add one more seat", { currentSeats: ["E1", "E2"] });
assert.deepEqual(addOneFromCheckout, {
  requested: true,
  operation: "add",
  amount: 1,
  targetCount: 3,
  baselineSeats: ["E1", "E2"],
  explicitSeats: [],
}, "checkout seat editing must retain the relative operation, target, and baseline seats");
for (const text of [
  "I don't want to remove one seat",
  "Do not remove one seat",
  "Never add another seat",
  "What happens if I remove one seat?",
  "Tell me what happens when I add a seat",
  "Why would I remove a seat?",
  "If I remove one seat, how much is the total?",
  "If I add another seat, what will it cost?",
  "Suppose I remove one seat",
  "I am not asking you to remove a seat",
  "I am not asking you to add another seat",
  "Should I remove one seat?",
  "Tell me how to remove one seat",
  "لا تضف مقعدا",
  "لا أريد حذف مقعد",
  "ماذا يحدث إذا حذفت مقعدا؟",
  "لماذا أضف مقعدا؟",
  "إذا أضفت مقعدا، كم يصبح السعر؟",
  "كيف أحذف مقعدا؟",
]) {
  assert.equal(resolveCheckoutSeatEditTurn(text, { currentSeats: ["E1", "E2"] }).requested, false, `${text}: a negated or hypothetical question must preserve checkout`);
}
assert.equal(resolveCheckoutSeatEditTurn("Can I add one seat?", { currentSeats: ["E1", "E2"] }).requested, true, "an affirmative checkout edit question must remain actionable");
assert.equal(resolveCheckoutSeatEditTurn("add E3", { currentSeats: ["E1", "E2"] }).operation, "add", "an explicit checkout add command must not degrade to replacement");
assert.equal(resolveCheckoutSeatEditTurn("remove E2", { currentSeats: ["E1", "E2"] }).operation, "remove", "an explicit checkout remove command must retain its operation");
const explicitMultiAdd = resolveCheckoutSeatEditTurn("add E3 and E4", { currentSeats: ["E1", "E2"] });
assert.equal(explicitMultiAdd.targetCount, 4, "an explicit two-seat add must derive its target from both labels");
assert.deepEqual(explicitMultiAdd.explicitSeats, ["E3", "E4"]);
assert.deepEqual(resolveSeatEditSelectionTurn("add E3 and E4", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: explicitMultiAdd }).seats, ["E1", "E2", "E3", "E4"]);
const explicitMultiRemove = resolveCheckoutSeatEditTurn("remove E1 and E2", { currentSeats: ["E1", "E2", "E3"] });
assert.equal(explicitMultiRemove.targetCount, 1, "an explicit two-seat removal must derive its target from both retained labels");
assert.deepEqual(resolveSeatEditSelectionTurn("remove E1 and E2", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2", "E3"], seatEdit: explicitMultiRemove }).seats, ["E3"]);
const checkoutReplacement = resolveCheckoutSeatEditTurn("replace with E3 and E4", { currentSeats: ["E1", "E2"] });
assert.equal(checkoutReplacement.operation, "replace", "a natural replacement phrase must be classified before leaving checkout");
assert.deepEqual(checkoutReplacement.explicitSeats, ["E3", "E4"]);
assert.deepEqual(resolveSeatEditSelectionTurn("replace with E3 and E4", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: checkoutReplacement }).seats, ["E3", "E4"]);
const arabicAddOne = resolveCheckoutSeatEditTurn("أضف مقعدا آخر", { currentSeats: ["E1", "E2"] });
assert.equal(arabicAddOne.operation, "add", "Arabic checkout seat additions must preserve relative add semantics");
assert.equal(arabicAddOne.targetCount, 3);
assert.equal(resolveCheckoutSeatEditTurn("إضافة مقعد", { currentSeats: ["E1", "E2"] }).operation, "add");
assert.equal(resolveCheckoutSeatEditTurn("احذف مقعد", { currentSeats: ["E1", "E2"] }).operation, "remove");
assert.deepEqual(resolveCheckoutSeatEditTurn("استبدل المقاعد ب E3 و E4", { currentSeats: ["E1", "E2"] }).explicitSeats, ["E3", "E4"], "Arabic replacement wording must retain every explicit seat label");
assert.deepEqual(resolveSeatEditSelectionTurn("E3", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: arabicAddOne }).seats, ["E1", "E2", "E3"], "an Arabic add request followed by a seat label must merge with retained seats");

const spokenAddedSeat = resolveSeatEditSelectionTurn("E three", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: addOneFromCheckout,
});
assert.equal(spokenAddedSeat.requested, true, "a short spoken seat label must stay inside the seat-edit journey");
assert.equal(spokenAddedSeat.operation, "add");
assert.deepEqual(spokenAddedSeat.seats, ["E1", "E2", "E3"], "a relative add must merge the spoken seat with the retained checkout seats");
assert.equal(spokenAddedSeat.targetMet, true);
assert.deepEqual(resolveSeatEditSelectionTurn("select E3", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: addOneFromCheckout }).seats, ["E1", "E2", "E3"], "selecting one seat after a relative add must merge rather than replace retained seats");

const addTwoFromCheckout = resolveCheckoutSeatEditTurn("add two more seats", { currentSeats: ["E1", "E2"] });
const firstIncrementalAdd = resolveSeatEditSelectionTurn("E3", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: addTwoFromCheckout });
assert.equal(firstIncrementalAdd.reason, "seat_edit_target_not_met");
assert.deepEqual(firstIncrementalAdd.proposedSeats, ["E1", "E2", "E3"], "a partial relative edit must expose the safe intermediate seat selection");
assert.deepEqual(resolveSeatEditSelectionTurn("E4", { availableSeatIds: editableSeats, currentSeats: firstIncrementalAdd.proposedSeats, seatEdit: addTwoFromCheckout }).seats, ["E1", "E2", "E3", "E4"], "a second seat label must complete a multi-seat relative add");
assert.deepEqual(resolveSeatEditSelectionTurn("E3 and E4", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: addTwoFromCheckout }).seats, ["E1", "E2", "E3", "E4"], "a bare multi-label follow-up must preserve the retained add operation");

const swapFromCheckout = resolveCheckoutSeatEditTurn("replace E1 with E3", { currentSeats: ["E1", "E2"] });
assert.equal(swapFromCheckout.operation, "swap");
assert.deepEqual(resolveSeatEditSelectionTurn("replace E1 with E3", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: swapFromCheckout }).seats, ["E2", "E3"], "a source-to-target swap must retain unrelated seats and remove the source seat");
for (const swapPhrase of ["change E1 to E3", "swap E1 and E3", "change my seat E1 to E3"]) {
  const parsedSwap = resolveCheckoutSeatEditTurn(swapPhrase, { currentSeats: ["E1", "E2"] });
  assert.equal(parsedSwap.operation, "swap", `${swapPhrase} must remain a source-to-target swap`);
  assert.deepEqual(resolveSeatEditSelectionTurn(swapPhrase, { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: parsedSwap }).seats, ["E2", "E3"], `${swapPhrase} must remove E1, add E3, and retain E2`);
}
for (const swapPhrase of ["استبدل E1 بـ E3", "غيّر E1 إلى E3", "بدل E1 مع E3"]) {
  const parsedSwap = resolveCheckoutSeatEditTurn(swapPhrase, { currentSeats: ["E1", "E2"] });
  assert.equal(parsedSwap.operation, "swap", `${swapPhrase} must remain an Arabic source-to-target swap`);
  assert.deepEqual(resolveSeatEditSelectionTurn(swapPhrase, { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: parsedSwap }).seats, ["E2", "E3"], `${swapPhrase} must remove E1, add E3, and retain E2`);
}

const removeUnselectedEdit = resolveCheckoutSeatEditTurn("remove E3", { currentSeats: ["E1", "E2"] });
const removeUnselected = resolveSeatEditSelectionTurn("remove E3", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: removeUnselectedEdit,
});
assert.equal(removeUnselected.reason, "seat_not_selected", "removing an available but unselected seat must fail locally");
assert.deepEqual(removeUnselected.invalidSeats, ["E3"]);
assert.deepEqual(removeUnselected.proposedSeats, ["E1", "E2"], "a rejected removal must preserve the selected seats");
assert.equal(removeUnselected.targetCount, 2, "a rejected removal must preserve the ticket and pricing count");

const addSelectedEdit = resolveCheckoutSeatEditTurn("add E1", { currentSeats: ["E1", "E2"] });
const addSelected = resolveSeatEditSelectionTurn("add E1", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: addSelectedEdit,
});
assert.equal(addSelected.reason, "seat_already_selected", "adding an already-selected seat must fail locally");
assert.deepEqual(addSelected.invalidSeats, ["E1"]);
assert.deepEqual(addSelected.proposedSeats, ["E1", "E2"], "a rejected addition must preserve the selected seats");
assert.equal(addSelected.targetCount, 2, "a rejected addition must preserve the ticket and pricing count");

const unavailableCheckoutEdit = resolveCheckoutSeatEditTurn("remove E9", { currentSeats: ["E1", "E2"] });
const unavailableCheckoutSeat = resolveSeatEditSelectionTurn("remove E9", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: unavailableCheckoutEdit,
});
assert.equal(unavailableCheckoutSeat.reason, "invalid_or_unavailable_seats", "an unavailable seat must retain the existing rejection path");
assert.deepEqual(unavailableCheckoutSeat.invalidSeats, ["E9"]);

const unselectedSwapEdit = resolveCheckoutSeatEditTurn("replace E3 with E4", { currentSeats: ["E1", "E2"] });
const unselectedSwap = resolveSeatEditSelectionTurn("replace E3 with E4", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: unselectedSwapEdit,
});
assert.equal(unselectedSwap.reason, "swap_source_not_selected", "a swap source must be selected before it can be replaced");
assert.deepEqual(unselectedSwap.invalidSeats, ["E3"]);
assert.deepEqual(unselectedSwap.proposedSeats, ["E1", "E2"], "an invalid swap source must not add the target or change the count");
assert.equal(unselectedSwap.targetCount, 2);

for (const swapPhrase of ["replace E1 with E2", "swap E1 and E2"]) {
  const selectedTargetEdit = resolveCheckoutSeatEditTurn(swapPhrase, { currentSeats: ["E1", "E2"] });
  const selectedTargetSwap = resolveSeatEditSelectionTurn(swapPhrase, {
    availableSeatIds: editableSeats,
    currentSeats: ["E1", "E2"],
    seatEdit: selectedTargetEdit,
  });
  assert.equal(selectedTargetSwap.reason, "swap_target_already_selected", `${swapPhrase}: a swap target must not already be selected`);
  assert.deepEqual(selectedTargetSwap.invalidSeats, ["E2"]);
  assert.deepEqual(selectedTargetSwap.proposedSeats, ["E1", "E2"], `${swapPhrase}: swapping selected seats must not shrink the selection`);
  assert.equal(selectedTargetSwap.targetCount, 2);
}

const removeLastSeat = resolveCheckoutSeatEditTurn("remove E1", { currentSeats: ["E1"] });
const emptyAfterRemoval = resolveSeatEditSelectionTurn("remove E1", { availableSeatIds: editableSeats, currentSeats: ["E1"], seatEdit: removeLastSeat });
assert.equal(emptyAfterRemoval.targetMet, true);
assert.deepEqual(emptyAfterRemoval.proposedSeats, [], "removing the last checkout seat must create an intentional empty selection");

const quantityAdd = createCheckoutTargetSeatEdit(3, resolveCheckoutSeatEditTurn("I need three tickets", { currentSeats: ["E1", "E2"] }), ["E1", "E2"]);
assert.equal(quantityAdd.operation, "add");
assert.deepEqual(resolveSeatEditSelectionTurn("E3", { availableSeatIds: editableSeats, currentSeats: ["E1", "E2"], seatEdit: quantityAdd }).seats, ["E1", "E2", "E3"], "a quantity target followed by one label must retain the checkout seats");
const quantityWithLabels = createCheckoutTargetSeatEdit(3, resolveCheckoutSeatEditTurn("I need three tickets, seats E1, E2 and E3", { currentSeats: ["E1", "E2"] }), ["E1", "E2"]);
assert.equal(quantityWithLabels.operation, "replace");
assert.deepEqual(quantityWithLabels.explicitSeats, ["E1", "E2", "E3"], "a quantity turn must preserve all same-turn seat labels");
for (const text of [
  "three tickets",
  "I need three tickets",
  "Please change the number of seats to three",
  "We need three tickets for the family",
  "I want two seats together",
  "Can you change it to three tickets?",
  "Please make it 3 tickets",
  "أريد ثلاثة تذاكر",
  "ثلاثة مقاعد",
  "تذكرتين",
  "أريد تذكرتين",
  "مقعدين",
  "أحتاج مقعدين",
  "شخصين",
]) {
  assert.equal(isExplicitCheckoutTicketTargetTurn(text), true, `${text}: an explicit checkout ticket target must return to seat editing`);
}
for (const text of [
  "Can I use the FAB offer for 2 tickets?",
  "What is the refund policy for two tickets?",
  "Are two seats eligible for the offer?",
  "هل عرض فاب صالح لتذكرتين؟",
]) {
  assert.equal(isExplicitCheckoutTicketTargetTurn(text), false, `${text}: an offer or policy question must preserve checkout`);
}

const asrAddedSeat = resolveSeatEditSelectionTurn("Any three", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: addOneFromCheckout,
});
assert.equal(asrAddedSeat.requested, true, "a constrained ASR seat-shaped turn must not be routed as an unrelated request");
assert.equal(asrAddedSeat.interpretedAsr, true);
assert.deepEqual(asrAddedSeat.seats, ["E1", "E2", "E3"], "Any three may resolve to E3 only when a one-seat edit and the retained E row make it safe");

const unsafeAsrSeat = resolveSeatEditSelectionTurn("Any three", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "F3"],
  seatEdit: { ...addOneFromCheckout, baselineSeats: ["E1", "F3"] },
});
assert.equal(unsafeAsrSeat.requested, true, "an ambiguous seat-shaped turn must be handled locally rather than sent to unrelated discovery");
assert.equal(unsafeAsrSeat.reason, "ambiguous_spoken_seat", "multiple current rows must produce a grounded clarification signal");
assert.deepEqual(unsafeAsrSeat.seats, []);

const explicitReplacement = resolveSeatEditSelectionTurn("Confirm seats E1, E2, E3", {
  availableSeatIds: editableSeats,
  currentSeats: ["E1", "E2"],
  seatEdit: addOneFromCheckout,
});
assert.equal(explicitReplacement.operation, "replace", "an explicit full seat confirmation must remain a replacement even after a relative request");
assert.deepEqual(explicitReplacement.seats, ["E1", "E2", "E3"]);

const repricedCheckoutInput = {
  seats: spokenAddedSeat.seats,
  ticketQuantity: spokenAddedSeat.seats.length,
  pricingQuantity: spokenAddedSeat.seats.length,
  feeQuantity: spokenAddedSeat.seats.length,
};
assert.deepEqual(repricedCheckoutInput, {
  seats: ["E1", "E2", "E3"],
  ticketQuantity: 3,
  pricingQuantity: 3,
  feeQuantity: 3,
}, "the edited checkout must derive ticket, price, and fee counts from the final three seats");

const authorizedSeatTurn = createSeatToolAuthorization({ seats: ["E2", "E1"], sessionEpoch: 4, stageRevision: 9, planContext: "0002:s1", now: 1_000 });
assert.equal(matchesSeatToolAuthorization(authorizedSeatTurn, { seats: ["E1", "E2"], sessionEpoch: 4, stageRevision: 9, planContext: "0002:s1", now: 1_001 }), true, "the exact current guest seat turn must authorize one matching tool request");
assert.equal(matchesSeatToolAuthorization(null, { seats: ["E1", "E2"], sessionEpoch: 4, stageRevision: 9, planContext: "0002:s1", now: 1_001 }), false, "an unsolicited agent seat tool call must not be authorized");
assert.equal(matchesSeatToolAuthorization(authorizedSeatTurn, { seats: ["E1", "E3"], sessionEpoch: 4, stageRevision: 9, planContext: "0002:s1", now: 1_001 }), false, "different seats must not reuse a guest authorization");
assert.equal(matchesSeatToolAuthorization(authorizedSeatTurn, { seats: ["E1", "E2"], sessionEpoch: 5, stageRevision: 9, planContext: "0002:s1", now: 1_001 }), false, "a new conversation must invalidate seat authorization");
assert.equal(matchesSeatToolAuthorization(authorizedSeatTurn, { seats: ["E1", "E2"], sessionEpoch: 4, stageRevision: 10, planContext: "0002:s1", now: 1_001 }), false, "a changed visible stage must invalidate seat authorization");
assert.equal(matchesSeatToolAuthorization(authorizedSeatTurn, { seats: ["E1", "E2"], sessionEpoch: 4, stageRevision: 9, planContext: "0002:s1", now: 1_000 + SEAT_TOOL_AUTHORIZATION_TTL_MS + 1 }), false, "an expired seat authorization must fail closed");

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const prompt = fs.readFileSync(new URL("../src/lib/voxiPrompt.js", import.meta.url), "utf8");
const voiceStart = Math.max(app.indexOf("onMessage: async (message) =>"), app.indexOf("onMessage: (message) =>"));
const voiceFlow = app.slice(voiceStart, app.indexOf("onError:", voiceStart));
const typedFlow = app.slice(app.indexOf("const sendText"), app.indexOf("const sendUiTurn"));
for (const [label, flow] of [["voice", voiceFlow], ["typed", typedFlow]]) {
  assert.match(flow, /resolveVisibleSeatTurn\(/, `${label} must recognize seat labels and visible-seat confirmation locally`);
  assert.match(flow, /routeSeatSelectionTurn\(/, `${label} must advance through the protected select_seats tool`);
  assert.match(flow, /seatSelectionResultContext\(/, `${label} must tell the agent which stage is actually rendered`);
  assert.match(flow, /routeCheckoutSeatEditTurn\(/, `${label} must apply explicit seat labels on the same checkout-edit turn`);
}

const checkoutSeatEditRoute = app.slice(app.indexOf("const routeCheckoutSeatEditTurn"), app.indexOf("const routeCancellationTurn"));
assert.match(checkoutSeatEditRoute, /backToSeatMapFromCheckout\([\s\S]*explicitSeats\?\.length[\s\S]*resolveVisibleSeatTurn\(text\)[\s\S]*routeSeatSelectionTurn\(text, resolvedTurn\)/, "one checkout utterance must restore the map, resolve its labels, and apply them without repetition");

const finalizeSeats = app.slice(app.indexOf("const finalizeSeats"), app.indexOf("const handleCheckoutReviewComplete"));
const clearSeatSelection = app.slice(app.indexOf("const clearSeatSelection"), app.indexOf("const refreshSeatQuote"));
assert.match(clearSeatSelection, /clearPendingOrder\(\)[\s\S]*seatsRef\.current = \[\][\s\S]*setSelectedSeats\(\[\]\)[\s\S]*setSeatQuote\(null\)/, "the central upstream invalidator must clear actual seats, checkout, and pricing");
assert.match(finalizeSeats, /seatsRef\.current = \[\.\.\.valid\][\s\S]*setSelectedSeats\(\[\.\.\.valid\]\)/, "confirmed seat state must stay synchronized with checkout and Back navigation");
assert.match(finalizeSeats, /sameSeatSelection\(seatsRef\.current, valid\)/, "a stale quote must not commit changed seats");
assert.match(finalizeSeats, /confirmationRequestEpoch = requestEpochRef\.current[\s\S]*confirmationSessionEpoch = sessionEpochRef\.current[\s\S]*confirmationStageRevision = stageRevisionRef\.current[\s\S]*confirmationJourneyId = bookingJourneyIdRef\.current/, "seat pricing must bind the active request, session, stage, and journey");
assert.match(finalizeSeats, /stageVisibleRef\.current[\s\S]*requestEpochRef\.current === confirmationRequestEpoch[\s\S]*stageRevisionRef\.current === confirmationStageRevision/, "a hidden or superseded seat map must not display checkout after delayed pricing");
assert.doesNotMatch(finalizeSeats, /expectedQuantity|quantity_mismatch|ticketQuantityRef/, "a requested target must never gate pricing or confirmation");
assert.match(finalizeSeats, /ticketQuantity:\s*valid\.length/, "checkout ticket count must be derived from confirmed seats");
assert.match(finalizeSeats, /catch \(error\) \{[\s\S]{0,180}!selectionIsCurrent\(\)[\s\S]{0,100}stale: true/, "an abandoned pricing error must be treated as stale rather than rendered on a newer panel");

const selectSeats = app.slice(app.indexOf("select_seats: async"), app.indexOf("show_booking_summary:"));
const sharedSeatConfirmation = app.slice(app.indexOf("const priceSeatSelection"), app.indexOf("const handleCheckoutReviewComplete"));
const touchSeatConfirmation = app.slice(app.indexOf("const confirmSeats"), app.indexOf("const completeCancellation"));
assert.match(selectSeats, /resolveSeatToolInput\(seats, \{ availableSeatIds, currentSeats: seatsRef\.current \}\)/, "the client tool must use the tested invalid-seat/fallback resolver");
assert.match(selectSeats, /invalidSeats\.length[\s\S]*invalid or unavailable/, "explicit invalid or unavailable seats must fail before pricing");
assert.match(selectSeats, /matchesSeatToolAuthorization\(authorization,[\s\S]*unauthorized:\s*true[\s\S]*No current guest seat selection authorized this request/, "an unsolicited agent tool call must not select seats without a current matching guest turn");
assert.match(app, /seatToolAuthorizationRef\.current = createSeatToolAuthorization\([\s\S]*clientTools\.select_seats/, "text and voice guest seat turns must create the authorization immediately before the protected client tool call");
assert.ok((app.match(/seatToolAuthorizationRef\.current = null/g) || []).length >= 3, "seat authorization must be consumed and cleared on journey resets");
assert.match(sharedSeatConfirmation, /seatConfirmationInFlightRef\.current\.get\(key\)[\s\S]*seatConfirmationInFlightRef\.current\.set\(key, trackedPromise\)/, "identical confirmations must share one pricing operation");
assert.match(selectSeats, /await priceSeatSelection\(ids\)/, "text and voice confirmations must use the shared pricing operation");
assert.match(touchSeatConfirmation, /await priceSeatSelection\(seats\)/, "touch confirmation must share the same pricing operation as text and voice");
assert.match(touchSeatConfirmation, /const backFromSeatMap[\s\S]*clearSeatSelection\(\)[\s\S]*showStage\(\{ view: "showtimes"/, "seat-map Back must synchronously clear seats, pricing, checkout, and leave the seat map");
assert.match(touchSeatConfirmation, /used Back from the seat map[\s\S]*no seat confirmation or checkout is active/, "seat-map Back must synchronize the rendered showtime state with the voice agent");
assert.match(selectSeats, /completedOrder\?\.checkoutId && sameSeatSelection\(ids, completedOrder\.seats/, "a duplicate confirmation completing behind another quote must reuse the rendered checkout result");
assert.match(app, /result\.currentView === "seatmap"[\s\S]*do not say the seat map remains visible/, "stale confirmation messaging must reflect the panel actually rendered after Back");
assert.match(selectSeats, /stageRef\.current\.view === "checkout"[\s\S]*alreadyConfirmed:\s*true/, "duplicate seat tools must be idempotent once checkout is visible");
assert.match(app, /visibleStageView === "checkout" && stage\.order && pendingOrder\?\.checkoutId === stage\.order\.checkoutId/, "a checkout may render only while its matching order is active and visible");
assert.match(prompt, /confirmed select_seats result means checkout review is displayed; it does not mean payment or booking confirmation/, "the agent must not turn seat confirmation into a fake booking or reference");
assert.doesNotMatch(app, /TicketQuantityControl|ticketQuantityRef|quantity_mismatch/, "the separate ticket quantity stage and exact-count gate must be removed");
assert.match(app, /current\.length >= MAX_TICKETS/, "seat selection must be limited only by the booking maximum");
assert.match(app, /const backToSeatMapFromCheckout[\s\S]*restoredSeats[\s\S]*view:\s*"seatmap"/, "checkout Back must restore the editable seat map and its selected seats");
assert.match(app, /resolveCheckoutSeatEditTurn\(safeMessage, \{ currentSeats: pendingOrderRef\.current\?\.seats \|\| \[\] \}\)/, "voice checkout edits must retain the operation against the active checkout seats");
assert.match(app, /resolveCheckoutSeatEditTurn\(value, \{ currentSeats: pendingOrderRef\.current\?\.seats \|\| \[\] \}\)/, "text checkout edits must use the same retained-seat operation model");
assert.match(app, /const checkoutSeatEditRef = useRef\(null\)/, "the relative checkout edit must survive the return-to-seat-map render transition");
assert.match(app, /resolveSeatEditSelectionTurn\(text, \{[\s\S]*seatEdit: checkoutSeatEditRef\.current[\s\S]*reason !== "seat_label_required"/, "the next text or voice seat label must be resolved inside the retained checkout edit");
assert.match(app, /createCheckoutTargetSeatEdit\([\s\S]*checkoutSeatQuantityTarget[\s\S]*checkoutSeatEdit[\s\S]*pendingOrderRef\.current\?\.seats/, "text and voice quantity targets must retain checkout seats through the shared resolver");
assert.match(app, /seat_edit_target_not_met[\s\S]{0,500}refreshSeatQuote\(proposedSeats\)/, "each partial conversational seat edit must refresh visible pricing");
assert.match(app, /resolvedTurn\.targetMet[\s\S]{0,650}checkoutSeatEditRef\.current = null/, "removing the final checkout seat must stay on the seat map without reconfirming the old seat");
assert.match(app, /reason === "ambiguous_spoken_seat"[\s\S]*full label[\s\S]*example E3/, "unsafe ASR seat labels must keep the seat map visible and request an exact label");
assert.match(app, /if \(parsed\?\.confirmed\) checkoutSeatEditRef\.current = null/, "a successfully repriced checkout must close the retained seat-edit operation");
assert.match(app, /checkoutSeatEditRef\.current = seatEdit\?\.requested[\s\S]*baselineSeats: \[\.\.\.restoredSeats\]/, "checkout Back must bind the edit operation to the seats actually restored on screen");

console.log("Validated deterministic text/voice seat routing, short and tapped-seat confirmation, invalid-seat rejection, quote-race idempotency, and truthful booking progression.");
