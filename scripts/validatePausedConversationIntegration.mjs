import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

const between = (start, end) => {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing integration section: ${start}`);
  return app.slice(from, to);
};

assert.match(app, /const \[stageVisible, setStageVisible\] = useState\(releaseRecovery\?\.stageVisible !== false\)/, "render visibility must stay separate from logical stage state and survive a release refresh");
assert.match(app, /const \[pausedJourney, setPausedJourney\] = useState\(\(\) => \([\s\S]*releaseRecovery\?\.pausedJourney[\s\S]*createPausedRichJourney/, "paused context must have an explicit immutable model with one-time release recovery");
assert.match(app, /const restoredStageToolGuardRef = useRef\(null\)/, "restored stages must be protected from delayed tools belonging to the previous topic");

const pause = between("const pauseRichRenderingForTopicChange", "const clearPausedJourneyForLifecycle");
assert.match(pause, /capturePausedRichStage[\s\S]*hidePausedRichStage/, "topic changes must capture before hiding");
assert.match(app, /pausedContext:[\s\S]*cancellationFlow: cancellationFlowRef\.current \? \{ \.\.\.cancellationFlowRef\.current \} : null/, "a paused cancellation snapshot must retain the exact flow that owns its controls");
assert.match(app, /const cancellationBookingMatches = !cancellationPausedRef\.current[\s\S]*nextStage\.view === "booking"[\s\S]*nextStage\.booking\?\.ref[\s\S]*cancellationFlow\.bookingRef/, "only the exact active booking may be auto-tagged as a cancellation snapshot");
assert.doesNotMatch(app, /cancellationBookingMatches[\s\S]{0,350}\["booking", "history"\]/, "an unrelated history panel must never overwrite the paused cancellation entry");
assert.match(pause, /setStageVisible\(false\)/, "topic changes must hide the rendered panel immediately");
assert.match(pause, /cancellationPausedRef\.current = true[\s\S]*suspendCancellationConfirmationTimer/, "pausing cancellation must suspend and invalidate the old confirmation deadline");
assert.doesNotMatch(pause, /clearSeatSelection|clearPendingOrder|bookingRef\.current\s*=\s*null/, "topic changes must not discard valid booking state");

const restore = between("const restorePausedJourney", "const pausedRestoreContext");
assert.match(restore, /restoreRequestEpoch = requestEpochRef\.current[\s\S]*restoreSessionEpoch = sessionEpochRef\.current[\s\S]*restoreStageRevision = stageRevisionRef\.current[\s\S]*restoreJourneyId = bookingJourneyIdRef\.current[\s\S]*restorePausedModel = pausedJourneyRef\.current/, "a paused restore must bind the request, session, stage, journey, and exact retained model");
assert.match(restore, /deviceSessionIsCurrent\(\)[\s\S]*userTurnSequenceRef\.current === restoreUserTurnSequence/, "a reset, logout, timeout, or newer guest turn must invalidate an in-flight restore");
assert.ok((restore.match(/if \(!restoreIsCurrent\(\)\) return staleRestore/g) || []).length >= 6, "every asynchronous generic restore branch must fail closed before mutating stale state");
assert.match(restore, /\["checkout", "seatmap", "showtimes", "movies"\]/, "continue my booking must prefer the furthest valid booking step");
assert.match(restore, /revalidatePausedCheckout/, "checkout restoration must revalidate current data");
assert.match(restore, /entry\.view === "movies"[\s\S]*vista\.getScheduledFilms[\s\S]*vista\.getCinemaDateSessions/, "movie-card restoration must refresh the current catalog and embedded showtimes");
assert.match(restore, /\["showtimes", "seatmap"\][\s\S]*vista\.getSessions[\s\S]*capturedSessionIds/, "showtime and seat-map restoration must intersect the paused session with the current catalog");
assert.match(restore, /vista\.getSeatPlan/, "seat restoration must revalidate seat availability");
assert.match(
  restore,
  /\["history", "booking", "cancellation"\][\s\S]*readBookings\(\{ strict: true \}\)[\s\S]*reason: "booking_storage_unavailable"/,
  "history, booking, and cancellation restoration must fail closed when device storage is corrupt or unavailable",
);
assert.match(
  restore,
  /showBookingHistoryStorageError\(\{[\s\S]*notifyAgent: false[\s\S]*booking_storage_unavailable/,
  "a failed record restore must display the explicit storage recovery panel without asking the agent to invent a result",
);
assert.doesNotMatch(
  restore,
  /\["history", "booking", "cancellation"\][\s\S]{0,500}readBookings\(\)/,
  "paused record restoration must never use a permissive booking read",
);
assert.match(restore, /entry\.view === "cancellation"[\s\S]*readBookings\(\{ strict: true \}\)[\s\S]*planPausedCancellationRestoration/, "cancellation restoration must strictly re-read the booking and plan against the live flow");
assert.match(restore, /resume_cancellation_revalidation[\s\S]*showBookingForAuthorizedCancellation/, "a missing or stale cancellation flow must be re-created only through a fresh authorized eligibility check");
assert.match(restore, /resumeCancellationConfirmationTimer[\s\S]*armCancellationConfirmationTimer/, "a synchronized cancellation restore must receive a fresh confirmation window");
assert.match(restore, /targetSelection[\s\S]*activeCancellationMutation\(\) \|\| cancellationFlowRef\.current[\s\S]*currentCandidates[\s\S]*setHistoryFilter\("active"\)/, "a flowless cancellation target list must revalidate its candidates without replacing another active flow");
assert.match(restore, /restoreBookingWithoutConfirmation[\s\S]*showStage\(\{ view: "booking", booking: safeBooking \}\)/, "failed cancellation restoration must show a safe booking panel without stale confirmation purpose");
assert.match(restore, /restorePausedRichStage/, "validated state must be restored through the paused-stage model");
assert.match(restore, /restoredStageToolGuardRef\.current = \{ view:/, "a restored stage must arm the one-turn delayed-tool guard");
const restoreContext = between("const pausedRestoreContext", "const abandonActiveBookingJourney");
assert.match(
  restoreContext,
  /booking_storage_unavailable[\s\S]*device-storage error[\s\S]*Do not restart discovery or claim that the booking disappeared/,
  "the agent must receive explicit fail-closed guidance when a paused record cannot be read",
);

const bookingCompletion = between("const handleCheckoutReviewComplete", "CLIENT TOOLS:");
assert.match(
  bookingCompletion,
  /setBookings\(\(existing\) => upsertBookingRecord\(existing, completed\)\)/,
  "a successful booking write must update the known UI record without a second permissive storage read",
);
assert.doesNotMatch(
  bookingCompletion,
  /setBookings\(readBookings\(\)\)/,
  "booking completion must not silently empty history after a successful write",
);

const checkoutRevalidation = between("const revalidatePausedCheckout", "const restorePausedJourney");
assert.match(checkoutRevalidation, /checkoutIdentityIsCurrent[\s\S]*pendingOrderRef\.current\?\.checkoutId === checkoutId/, "checkout revalidation must retain the exact checkout identity");
assert.ok((checkoutRevalidation.match(/if \(!checkoutIdentityIsCurrent\(\)\) return staleCheckoutRestore\(\)/g) || []).length >= 7, "checkout identity and lifecycle must be checked after every provider await and before state mutation");

const restoredToolGuard = between("const preservePausedTopicForTool", "const preserveActiveCancellationForTool");
assert.match(restoredToolGuard, /restored_stage_waiting_for_guest_selection/, "a delayed agent tool must not advance a just-restored panel");
assert.match(restoredToolGuard, /wait for the guest to make the next movie, showtime, seat, or checkout choice/, "the agent must be told to wait for an explicit next choice");

const voice = between("onMessage: async (message) =>", "onError: (error)");
const text = between("const sendText", "const sendUiTurn");
for (const [label, route, value] of [["voice", voice, "safeMessage"], ["text", text, "value"]]) {
  assert.match(route, new RegExp(`hasMeaningfulTurnContent\\(${value}\\)`), `${label} must ignore punctuation-only microphone or typed noise`);
  assert.match(route, new RegExp(`pausedResumeTarget\\(${value}\\)`), `${label} must recognize conversational restore turns`);
  assert.match(route, /restorePausedJourney\(/, `${label} must restore the selected paused stage`);
  assert.match(route, /pauseRenderingForUnrelatedTurn\(/, `${label} must hide rich rendering on an unrelated topic`);
  assert.match(route, /if \(!requestedResumeTarget\) restoredStageToolGuardRef\.current = null/, `${label} must release the delayed-tool guard only on the guest's next distinct turn`);
  assert.match(route, /isExplicitJourneyCancellationTurn/, `${label} must support deliberate active-journey cancellation`);
  assert.match(route, /isExplicitConversationEndTurn/, `${label} must clear saved journey state on explicit conversation end`);
  assert.match(route, /const recordSelectorFaq =[\s\S]*prepareFaqContext/, `${label} must retrieve FAQ context before a history or cancellation selector fallback`);
  assert.match(route, /const recordSelectorOffer =[\s\S]*resolveLocalOfferTextTurn/, `${label} must recognize a bank offer question before a history or cancellation selector fallback`);
  assert.match(route, new RegExp(`isGenuineFaqQuestion\\(${value}`), `${label} must distinguish genuine FAQ questions from short booking selectors`);
  assert.match(route, /bypassForFaq: recordSelectorFaqBypass/, `${label} must bypass both record selector resolvers for a genuine FAQ`);
  assert.match(route, /recordSelectorFaqBypass[\s\S]{0,100}\? recordSelectorFaq/, `${label} must reuse the approved FAQ answer after bypassing the record selector`);
}
assert.match(text, /localOfferTurn && \(activeCheckout \|\| recordSelectorOffer \|\| !isConnected\)[\s\S]*clientTools\.show_offers/, "typed FAB questions from a record selector must open the sourced offer panel locally and preserve the paused list");
assert.match(voice, /if \(localOfferTurn\)[\s\S]*clientTools\.show_offers/, "spoken FAB questions from a record selector must open the same sourced offer panel");

for (const phraseFragment of ["continue|resume", "seats?|seat map", "showtimes?", "checkout|payment"]) {
  assert.match(app, new RegExp(phraseFragment, "i"), `restore classifier must cover ${phraseFragment}`);
}
assert.match(app, /pausedJourneyRouting\.js/, "App must use the executable paused-stage phrase router");

const render = between("<main ref={scrollRef}", "</main>");
for (const view of ["movies", "showtimes", "seatmap", "checkout", "booking", "history"]) {
  assert.match(render, new RegExp(`visibleStageView === ["']${view}["']`), `${view} must render only when visible`);
}
assert.doesNotMatch(render, /stage\.view === ["'](?:movies|showtimes|seatmap|checkout|booking|history)["']/, "logical paused stages must not leak into rendering guards");
assert.match(app, /const displayedCancellationState = synchronizedCancellationRenderState\([\s\S]*cancellation=\{displayedCancellationState\}/, "booking confirmation controls must render only when React state and the synchronous cancellation flow agree");

const lifecycle = between("const abandonActiveBookingJourney", "const seatConfirmationKey");
assert.match(lifecycle, /clearPausedJourneyForLifecycle\("cancelled"/, "explicit active-journey cancellation must clear saved stages");
assert.match(lifecycle, /replacePausedJourneyForNewBooking/, "a replacement booking must start a new journey identity");
assert.match(app, /expirePausedRichJourney\(pausedJourneyRef\.current/, "session timeout must expire saved rich state");
assert.match(app, /endPausedRichJourney\(pausedJourneyRef\.current/, "conversation reset or end must clear saved rich state");
assert.match(app, /clearPausedJourneyForLifecycle\("completed", "booking_completed"\)/, "booking completion must clear the active saved journey");
assert.match(app, /clearPausedJourneyForLifecycle[\s\S]*restoredStageToolGuardRef\.current = null/, "terminal lifecycle events must clear the delayed-tool guard");

const cancellation = between("const routeCancellationTurn", "const cancellationResultContext");
assert.match(cancellation, /resolveConversationalCancellation/, "cancellation must use the natural-language resolver");
assert.match(cancellation, /displayedBookingRefs/, "list-position matching must use the order displayed to the guest");
assert.match(cancellation, /focusedCancellationChoice/, "ambiguous matches must receive a focused detail list");
assert.match(cancellation, /showBookingForAuthorizedCancellation[\s\S]*resolution\.bookingRef/, "a unique match must proceed directly to eligibility and confirmation");
assert.match(app, /cancellationBookingSummary\(displayed[\s\S]*Would you like me to cancel this booking\?/, "final confirmation must include the complete booking summary and a direct question");
assert.match(app, /controls are already visible, but the conversational confirmation must still be accessible in text and voice[\s\S]*Speak this exact prompt once now: \$\{result\.message\}/, "visible controls must still produce the complete confirmation in text and voice");
assert.match(app, /cancellationResultShouldRender[\s\S]*stageVisibleRef\.current[\s\S]*renderTopicRef\.current/, "background cancellation completion must not replace an unrelated topic");
assert.match(app, /invalidatePausedRichStage\(pausedJourneyRef\.current,[\s\S]*views: \["cancellation"\][\s\S]*cancellation_completed/, "successful cancellation must clear stale cancellation rendering");
assert.match(
  app,
  /setBookings\(\(existing\) => upsertBookingRecord\(existing, latestStoredBooking\)\)/,
  "an already-cancelled result must retain its known UI record without a permissive reread",
);
assert.match(
  app,
  /setBookings\(\(existing\) => upsertBookingRecord\(existing, updated\)\)/,
  "a completed cancellation must retain its known result regardless of post-write storage availability",
);
const historyContext = between("const bookingHistoryTurnContext", "const clearConversationState");
assert.match(historyContext, /already displayed[\s\S]*Never say the list is empty[\s\S]*never ask the guest to provide a booking reference/, "a populated history list must remain authoritative in the agent response");

console.log("Validated App integration for hidden rich rendering, text and voice restoration, checkout revalidation, lifecycle cleanup, conversational cancellation, focused ambiguity, and background completion safety.");
