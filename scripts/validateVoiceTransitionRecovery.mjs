import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  beginOwnedSessionSwitch,
  canRestorePreviousSession,
  endTransportWithRetirement,
  finalizeOwnedSessionStart,
  finalizeOwnedSessionSwitch,
  resetOwnedSessionSwitch,
  waitForLazyTransport,
} from "../src/lib/transportStart.js";

const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const voiceStart = app.slice(
  app.indexOf("const startVoiceSession"),
  app.indexOf("const restartActiveTransportForLanguage"),
);
const textStart = app.slice(
  app.indexOf("const startTextSession"),
  app.indexOf("const startVoiceSession"),
);
const guardedTransportStart = app.slice(
  app.indexOf("const startTransportWithGuards"),
  app.indexOf("const startTextSession"),
);
const languageRestart = app.slice(
  app.indexOf("const restartActiveTransportForLanguage"),
  app.indexOf("const endVoiceSession"),
);
const voiceEnd = app.slice(
  app.indexOf("const endVoiceSession"),
  app.indexOf("const sendText"),
);
const conversationRestart = app.slice(
  app.indexOf("const restartConversation"),
  app.indexOf("useEffect(() =>", app.indexOf("const restartConversation")),
);
const typedConversationEnd = app.slice(
  app.indexOf("if (isExplicitConversationEndTurn(value))"),
  app.indexOf("if (isExplicitJourneyCancellationTurn(value))"),
);
const idleIntervalMarker = app.indexOf("const interval = window.setInterval");
const idleTimeoutFlow = app.slice(
  app.lastIndexOf("useEffect(() =>", idleIntervalMarker),
  app.indexOf("const startTransportWithGuards"),
);

async function simulateVoiceAttempt({
  capturedEpoch = 1,
  currentEpoch = 1,
  epochRef = null,
  startedConversationId = "voice-conversation",
  endSession = async () => {},
  endTimeoutMs = 25,
} = {}) {
  const activeEpochRef = epochRef || { current: currentEpoch };
  const startRef = { current: null };
  let startingMode = "voice";
  let retireCount = 0;
  let startTransportCalls = 0;
  const promise = (async () => {
    if (capturedEpoch !== activeEpochRef.current) return false;
    await endTransportWithRetirement({
      transport: { endSession },
      retire: () => { retireCount += 1; },
      timeoutMs: endTimeoutMs,
    });
    if (capturedEpoch !== activeEpochRef.current) return false;
    startTransportCalls += 1;
    if (!startedConversationId || capturedEpoch !== activeEpochRef.current) return false;
    return true;
  })();
  const entry = { mode: "voice", promise };
  startRef.current = entry;

  let result;
  try {
    result = await promise;
  } finally {
    finalizeOwnedSessionStart({
      startRef,
      entry,
      clearStartingMode: () => { startingMode = null; },
    });
  }
  return { result, retireCount, startRef, startingMode, startTransportCalls };
}

const neverEndingClose = await simulateVoiceAttempt({
  endSession: () => new Promise(() => {}),
  endTimeoutMs: 5,
});
assert.equal(neverEndingClose.result, true, "a stalled text close must retire and allow voice startup to continue");
assert.equal(neverEndingClose.retireCount, 1, "a stalled text transport must be retired exactly once");
assert.equal(neverEndingClose.startingMode, null, "a completed retry must clear the voice progress state");

const staleAfterPermission = await simulateVoiceAttempt({ capturedEpoch: 1, currentEpoch: 2 });
assert.equal(staleAfterPermission.result, false, "an epoch change during microphone permission must stop the stale start");
assert.equal(staleAfterPermission.startingMode, null, "an epoch change must clear the stale attempt's progress state");
assert.equal(staleAfterPermission.startRef.current, null, "an epoch change must release the stale attempt entry");

let resolveDeferredClose;
const deferredClose = new Promise((resolve) => { resolveDeferredClose = resolve; });
const mutableEpoch = { current: 7 };
const resetDuringClosePromise = simulateVoiceAttempt({
  capturedEpoch: 7,
  epochRef: mutableEpoch,
  endSession: () => deferredClose,
});
await Promise.resolve();
mutableEpoch.current = 8;
resolveDeferredClose();
const resetDuringClose = await resetDuringClosePromise;
assert.equal(resetDuringClose.result, false, "a reset or logout during prior-session teardown must stop voice startup");
assert.equal(resetDuringClose.startTransportCalls, 0, "WebRTC must not start after the conversation epoch changes during teardown");
assert.equal(resetDuringClose.startingMode, null, "the invalidated teardown attempt must clear its owned progress state");

let lazyEpoch = 11;
let lazyTransportReads = 0;
const lazyWait = waitForLazyTransport({
  getTransport: () => {
    lazyTransportReads += 1;
    return null;
  },
  isEpochCurrent: () => lazyEpoch === 11,
  isGenerationCurrent: () => true,
  timeoutMs: 100,
  pollMs: 1,
});
lazyEpoch = 12;
assert.equal(await lazyWait, null, "a reset during lazy-host wait must resolve stale without returning a transport");
assert.equal(lazyTransportReads, 1, "lazy-host polling must stop before another transport read after the epoch changes");

let ownedLazyEpoch = 21;
const ownedLazySwitchRef = { current: false };
const ownedLazyOwnerRef = { current: null };
const ownedLazyOwner = beginOwnedSessionSwitch({ ownerRef: ownedLazyOwnerRef, switchingRef: ownedLazySwitchRef });
let ownedLazyTransport;
try {
  const ownedLazyWait = waitForLazyTransport({
    getTransport: () => null,
    isEpochCurrent: () => ownedLazyEpoch === 21,
    isGenerationCurrent: () => true,
    timeoutMs: 100,
    pollMs: 1,
  });
  ownedLazyEpoch = 22;
  ownedLazyTransport = await ownedLazyWait;
} finally {
  finalizeOwnedSessionSwitch({ ownerRef: ownedLazyOwnerRef, switchingRef: ownedLazySwitchRef, owner: ownedLazyOwner });
}
assert.equal(ownedLazyTransport, null, "full voice startup must receive no transport after epoch invalidation during lazy wait");
assert.equal(ownedLazySwitchRef.current, false, "null lazy-host return must release the voice attempt's switching state");

const nullStart = await simulateVoiceAttempt({ startedConversationId: null });
assert.equal(nullStart.result, false, "a null or stale transport start must not report success");
assert.equal(nullStart.startingMode, null, "a null or stale transport start must clear the progress state");

const successfulStart = await simulateVoiceAttempt();
assert.equal(successfulStart.result, true, "a normal text-to-voice transition must still succeed");
assert.equal(successfulStart.retireCount, 0, "a normal close must not retire a healthy transport");
assert.equal(successfulStart.startingMode, null, "a successful transition must clear the progress state");

let rejectedCloseRetireCount = 0;
await assert.rejects(
  endTransportWithRetirement({
    transport: { endSession: async () => { throw new Error("close failed"); } },
    retire: () => { rejectedCloseRetireCount += 1; },
    timeoutMs: 25,
  }),
  /close failed/,
  "a direct SDK close failure must remain visible to the caller",
);
assert.equal(rejectedCloseRetireCount, 1, "a directly rejected close must retire the unhealthy transport exactly once");

const priorTransport = { id: "prior-text-transport" };
const restorablePriorSession = {
  previousMode: "text",
  previousTransport: priorTransport,
  previousGeneration: 3,
  endedPreviousSession: false,
  currentMode: "text",
  currentTransport: priorTransport,
  currentGeneration: 3,
  currentStatus: "connected",
};
assert.equal(canRestorePreviousSession(restorablePriorSession), true, "permission rejection must preserve the same still-connected text session");
assert.equal(canRestorePreviousSession({
  ...restorablePriorSession,
  currentMode: null,
  currentStatus: "disconnected",
}), false, "permission rejection after an intervening disconnect must not resurrect the old text mode");
assert.equal(canRestorePreviousSession({
  ...restorablePriorSession,
  currentTransport: { id: "replacement-transport" },
  currentGeneration: 4,
}), false, "permission rejection after transport replacement must not restore the old mode onto the new generation");

const sharedStartRef = { current: null };
const oldEntry = { mode: "voice", promise: Promise.resolve(false) };
const newEntry = { mode: "voice", promise: Promise.resolve(true) };
let newerStartingMode = "voice";
sharedStartRef.current = newEntry;
assert.equal(finalizeOwnedSessionStart({
  startRef: sharedStartRef,
  entry: oldEntry,
  clearStartingMode: () => { newerStartingMode = null; },
}), false, "an older attempt must not finalize a newer attempt");
assert.equal(sharedStartRef.current, newEntry, "the newer attempt must retain ownership");
assert.equal(newerStartingMode, "voice", "the older attempt must not hide newer progress");

const switchOwnerRef = { current: null };
const switchingRef = { current: false };
const closingOwner = beginOwnedSessionSwitch({ ownerRef: switchOwnerRef, switchingRef });
assert.equal(switchingRef.current, true, "prior-session teardown must claim switching state");
resetOwnedSessionSwitch({ ownerRef: switchOwnerRef, switchingRef });
assert.equal(switchingRef.current, false, "reset during teardown must clear switching state");
const newerSwitchOwner = beginOwnedSessionSwitch({ ownerRef: switchOwnerRef, switchingRef });
assert.equal(finalizeOwnedSessionSwitch({
  ownerRef: switchOwnerRef,
  switchingRef,
  owner: closingOwner,
}), false, "the stale teardown must not finalize a newer switch after reset");
assert.equal(switchingRef.current, true, "a stale post-teardown return must leave the newer switch active");
assert.equal(finalizeOwnedSessionSwitch({
  ownerRef: switchOwnerRef,
  switchingRef,
  owner: newerSwitchOwner,
}), true, "the current switch owner must be able to finalize its state");
assert.equal(switchingRef.current, false, "the current switch must clear switching state when it finishes");

async function simulateEpochBoundModeTransition({ epochRef, closePromise }) {
  const operationEpoch = epochRef.current;
  const ownerRef = { current: null };
  const stateRef = { current: false };
  const owner = beginOwnedSessionSwitch({ ownerRef, switchingRef: stateRef });
  let modeWrites = 0;
  let restarts = 0;
  try {
    await closePromise;
    if (operationEpoch !== epochRef.current) return { continued: false, modeWrites, restarts, switching: stateRef.current };
    modeWrites += 1;
    restarts += 1;
    return { continued: true, modeWrites, restarts, switching: stateRef.current };
  } finally {
    finalizeOwnedSessionSwitch({ ownerRef, switchingRef: stateRef, owner });
  }
}

let resolveLanguageClose;
const languageEpoch = { current: 31 };
const languageTransition = simulateEpochBoundModeTransition({
  epochRef: languageEpoch,
  closePromise: new Promise((resolve) => { resolveLanguageClose = resolve; }),
});
languageEpoch.current = 32;
resolveLanguageClose();
const resetDuringLanguageRestart = await languageTransition;
assert.equal(resetDuringLanguageRestart.continued, false, "reset during language teardown must stop the stale language transition");
assert.equal(resetDuringLanguageRestart.modeWrites, 0, "stale language teardown must perform no later mode writes");
assert.equal(resetDuringLanguageRestart.restarts, 0, "stale language teardown must not restart voice or text");

let resolveVoiceEndClose;
const voiceEndEpoch = { current: 41 };
const voiceEndTransition = simulateEpochBoundModeTransition({
  epochRef: voiceEndEpoch,
  closePromise: new Promise((resolve) => { resolveVoiceEndClose = resolve; }),
});
voiceEndEpoch.current = 42;
resolveVoiceEndClose();
const resetDuringVoiceEnd = await voiceEndTransition;
assert.equal(resetDuringVoiceEnd.continued, false, "reset during voice-end teardown must stop the stale transition");
assert.equal(resetDuringVoiceEnd.modeWrites, 0, "stale voice-end teardown must perform no later mode writes");
assert.equal(resetDuringVoiceEnd.restarts, 0, "stale voice-end teardown must not restart text");

function beginSimulatedIdleTimeout({ state, endSession, timeoutMs = 5 }) {
  if (state.operationRef.current) return state.operationRef.current.promise;
  state.epochRef.current += 1;
  const invalidatedEpoch = state.epochRef.current;
  const operation = { promise: null, noticeSent: false, stateCleared: false };
  state.operationRef.current = operation;
  state.immediateRetireCount += 1;
  operation.stateCleared = true;
  state.clearCount += 1;
  operation.noticeSent = true;
  state.noticeCount += 1;
  operation.promise = (async () => {
    try {
      await endTransportWithRetirement({
        transport: { endSession },
        retire: () => { state.retireCount += 1; },
        timeoutMs,
      });
    } catch {}
    finally {
      const ownsOperation = state.operationRef.current === operation;
      const ownsEpoch = state.epochRef.current === invalidatedEpoch;
      if (ownsOperation && ownsEpoch) {
        if (!operation.stateCleared) {
          operation.stateCleared = true;
          state.clearCount += 1;
        }
        if (operation.stateCleared && !operation.noticeSent) {
          operation.noticeSent = true;
          state.noticeCount += 1;
        }
      }
      if (ownsOperation) state.operationRef.current = null;
    }
  })();
  return operation.promise;
}

function idleState(epoch = 50) {
  return {
    epochRef: { current: epoch },
    operationRef: { current: null },
    clearCount: 0,
    noticeCount: 0,
    retireCount: 0,
    immediateRetireCount: 0,
  };
}

const stalledIdleState = idleState();
let stalledIdleCloseCalls = 0;
const stalledIdle = beginSimulatedIdleTimeout({
  state: stalledIdleState,
  endSession: () => {
    stalledIdleCloseCalls += 1;
    return new Promise(() => {});
  },
});
assert.equal(stalledIdleState.epochRef.current, 51, "idle expiry must invalidate the session epoch before awaiting transport close");
assert.equal(stalledIdleState.immediateRetireCount, 1, "idle expiry must retire the captured generation synchronously");
assert.equal(stalledIdleState.clearCount, 1, "idle expiry must clear conversation state synchronously");
assert.equal(stalledIdleState.noticeCount, 1, "idle expiry must publish its timeout notice synchronously");
assert.equal(beginSimulatedIdleTimeout({ state: stalledIdleState, endSession: async () => {} }), stalledIdle, "a second idle tick must reuse the in-flight timeout instead of overlapping teardown");
await stalledIdle;
assert.equal(stalledIdleCloseCalls, 1, "stalled idle teardown must issue only one SDK close");
assert.equal(stalledIdleState.clearCount, 1, "stalled idle teardown must clear conversation state exactly once");
assert.equal(stalledIdleState.noticeCount, 1, "stalled idle teardown must publish exactly one timeout notice");

const rejectedIdleState = idleState(60);
await beginSimulatedIdleTimeout({
  state: rejectedIdleState,
  endSession: async () => { throw new Error("idle close rejected"); },
});
assert.equal(rejectedIdleState.clearCount, 1, "rejected idle teardown must still clear conversation state in finally");
assert.equal(rejectedIdleState.noticeCount, 1, "rejected idle teardown must still publish one timeout notice");

let resolveStaleIdleClose;
const staleIdleState = idleState(70);
const staleIdle = beginSimulatedIdleTimeout({
  state: staleIdleState,
  endSession: () => new Promise((resolve) => { resolveStaleIdleClose = resolve; }),
  timeoutMs: 100,
});
staleIdleState.epochRef.current += 1;
await Promise.resolve();
resolveStaleIdleClose();
await staleIdle;
assert.equal(staleIdleState.clearCount, 1, "stale idle completion must not clear state again after a newer conversation starts");
assert.equal(staleIdleState.noticeCount, 1, "stale idle completion must not add another timeout notice to a newer conversation");

assert.match(voiceStart, /const closingGeneration = transportGenerationRef\.current;[\s\S]*const closingTransport = transportRef\.current;[\s\S]*endTransportWithRetirement\(\{[\s\S]*retire:\s*\(\) => retireTransportGeneration\(closingGeneration\)/, "text-to-voice teardown must be bounded and retire only its captured generation");
assert.doesNotMatch(voiceStart, /await conversation\.endSession\(\)/, "voice startup must not wait indefinitely for the prior session to close");
assert.match(voiceStart, /if \(epoch !== sessionEpochRef\.current\) return false;/, "voice startup must stop after an epoch change during permission");
assert.match(voiceStart, /endTransportWithRetirement\(\{[\s\S]*if \(closeResult\.retired\)[^\n]*\n\s*\}\s*if \(epoch !== sessionEpochRef\.current\) \{\s*return false;\s*\}\s*requestedSessionEpochRef\.current = epoch;/, "voice startup must recheck the epoch after teardown and before requesting WebRTC");
assert.match(voiceStart, /if \(!startedConversationId \|\| epoch !== sessionEpochRef\.current\) return false;/, "voice startup must stop after a null or stale transport start");
assert.match(voiceStart, /const previousTransport = transportRef\.current;\s*const previousTransportGeneration = transportGenerationRef\.current;/, "voice startup must capture the prior transport identity and generation before microphone permission");
assert.match(voiceStart, /canRestorePreviousSession\(\{[\s\S]*previousTransport,[\s\S]*previousGeneration: previousTransportGeneration,[\s\S]*currentMode: sessionModeRef\.current,[\s\S]*currentTransport: transportRef\.current,[\s\S]*currentGeneration: transportGenerationRef\.current,[\s\S]*currentStatus: transportStatusRef\.current/, "failed voice startup must restore only the same still-connected prior session");
assert.match(voiceStart, /finally\s*\{\s*finalizeOwnedSessionStart\(\{[\s\S]*startRef:\s*sessionStartRef,[\s\S]*clearStartingMode:\s*\(\) => setStartingMode\(null\)/, "every terminal path must use attempt-owned progress cleanup");
assert.match(textStart, /finally\s*\{\s*finalizeOwnedSessionStart\(\{[\s\S]*startRef:\s*sessionStartRef,[\s\S]*clearStartingMode:\s*\(\) => setStartingMode\(null\)/, "null, stale, success, and error text starts must use attempt-owned progress cleanup");
assert.match(voiceStart, /connectionType:\s*"webrtc"/, "voice startup must remain WebRTC");
assert.match(voiceStart, /agentId:\s*import\.meta\.env\.VITE_AGENT_ID/, "voice startup must preserve the configured agent ID");
assert.match(guardedTransportStart, /if \(epoch !== sessionEpochRef\.current \|\| generation !== transportGenerationRef\.current\)[\s\S]*endTransportWithRetirement\(\{[\s\S]*transport,[\s\S]*retire:\s*\(\) => retireTransportGeneration\(generation\)/, "stale post-start cleanup must be bounded and target only the captured transport");
assert.doesNotMatch(guardedTransportStart, /try \{ await transport\.endSession\(\); \}/, "stale post-start cleanup must not await an unbounded SDK close");
assert.match(guardedTransportStart, /waitForLazyTransport\(\{[\s\S]*isEpochCurrent:\s*\(\) => epoch === sessionEpochRef\.current,[\s\S]*isGenerationCurrent:\s*\(\) => generation === transportGenerationRef\.current/, "lazy transport wait must observe both epoch and generation");
const immediatePreStartGuard = guardedTransportStart.indexOf("if (!transport || epoch !== sessionEpochRef.current || generation !== transportGenerationRef.current) return null;");
const guardedStartCall = guardedTransportStart.indexOf("const startedConversationId = await startTransportWithRetirement");
const staleCleanupCall = guardedTransportStart.indexOf("await endTransportWithRetirement");
assert.ok(immediatePreStartGuard >= 0 && immediatePreStartGuard < guardedStartCall, "epoch and generation must be rechecked immediately before SDK start");
assert.ok(guardedStartCall >= 0 && staleCleanupCall > guardedStartCall, "stale cleanup must be reachable only after an SDK start was attempted");
assert.match(voiceStart, /if \(!startedConversationId \|\| epoch !== sessionEpochRef\.current\) return false;[\s\S]*finally\s*\{\s*finalizeOwnedSessionSwitch\(\{[\s\S]*owner: transitionOwner/, "null or stale guarded voice start must release switching state through the attempt-owned finally");
assert.match(languageRestart, /const closingGeneration = transportGenerationRef\.current;[\s\S]*const closingTransport = transportRef\.current;[\s\S]*endTransportWithRetirement\(\{[\s\S]*retire:\s*\(\) => retireTransportGeneration\(closingGeneration\)/, "language transport restart must use bounded generation-safe teardown");
assert.doesNotMatch(languageRestart, /await conversation\.endSession\(\)/, "language transport restart must not wait indefinitely for SDK close");
assert.match(languageRestart, /const operationEpoch = sessionEpochRef\.current;[\s\S]*endTransportWithRetirement\(\{[\s\S]*if \(operationEpoch !== sessionEpochRef\.current\) return false;[\s\S]*requestedSessionModeRef\.current = null;[\s\S]*await start(?:Voice|Text)Session/, "language restart must stop before mode writes or transport restart when its epoch is stale");
assert.match(languageRestart, /finally\s*\{\s*finalizeOwnedSessionSwitch\(\{[\s\S]*owner: transitionOwner/, "language restart must finalize only its owned switching state");
assert.match(voiceEnd, /const closingGeneration = transportGenerationRef\.current;[\s\S]*const closingTransport = transportRef\.current;[\s\S]*endTransportWithRetirement\(\{[\s\S]*retire:\s*\(\) => retireTransportGeneration\(closingGeneration\)/, "ending voice must use bounded generation-safe teardown");
assert.doesNotMatch(voiceEnd, /await conversation\.endSession\(\)/, "ending voice must not wait indefinitely for SDK close");
assert.match(voiceEnd, /const operationEpoch = sessionEpochRef\.current;[\s\S]*endTransportWithRetirement\(\{[\s\S]*if \(operationEpoch !== sessionEpochRef\.current\) return false;[\s\S]*requestedSessionModeRef\.current = null;[\s\S]*return await startTextSession\(\)/, "ending voice must stop before mode writes or text restart when its epoch is stale");
const restartEpochInvalidation = conversationRestart.indexOf("sessionEpochRef.current += 1;");
const restartBoundedClose = conversationRestart.indexOf("await endTransportWithRetirement");
assert.ok(restartEpochInvalidation >= 0 && restartEpochInvalidation < restartBoundedClose, "conversation restart must invalidate the epoch synchronously before awaiting teardown");
assert.match(conversationRestart, /const closingGeneration = transportGenerationRef\.current;[\s\S]*const closingTransport = transportRef\.current;[\s\S]*await endTransportWithRetirement\(\{[\s\S]*retire:\s*\(\) => retireTransportGeneration\(closingGeneration\)/, "conversation restart must use bounded captured-generation teardown");
assert.match(conversationRestart, /clearConversationState\(reason, \{ sessionEpochAlreadyInvalidated: true \}\)/, "conversation restart must not increment the already-invalidated epoch twice");
assert.doesNotMatch(conversationRestart, /await conversation\.endSession\(\)/, "conversation restart must not await an unbounded SDK close");
assert.match(typedConversationEnd, /const closingGeneration = transportGenerationRef\.current;[\s\S]*const closingTransport = transportRef\.current;[\s\S]*clearConversationState\("conversation_ended"\)[\s\S]*await endTransportWithRetirement\(\{[\s\S]*transport: closingTransport,[\s\S]*retire:\s*\(\) => retireTransportGeneration\(closingGeneration\)/, "explicit text conversation end must use bounded teardown on the captured transport");
assert.doesNotMatch(typedConversationEnd, /await conversation\.endSession\(\)/, "explicit text conversation end must not await an unbounded SDK close");
const idleEpochInvalidation = idleTimeoutFlow.indexOf("sessionEpochRef.current += 1;");
const idleImmediateRetirement = idleTimeoutFlow.indexOf("retireTransportGeneration(closingGeneration);");
const idleImmediateClear = idleTimeoutFlow.indexOf('clearConversationState("timeout", { sessionEpochAlreadyInvalidated: true })');
const idleBoundedClose = idleTimeoutFlow.indexOf("await endTransportWithRetirement");
assert.ok(idleEpochInvalidation >= 0 && idleEpochInvalidation < idleBoundedClose, "idle timeout must invalidate the session epoch before bounded teardown");
assert.ok(idleEpochInvalidation < idleImmediateRetirement && idleImmediateRetirement < idleImmediateClear && idleImmediateClear < idleBoundedClose, "idle timeout must retire and privacy-clear synchronously before background close");
assert.match(idleTimeoutFlow, /if \(idleTimeoutOperationRef\.current\) return;[\s\S]*const closingGeneration = transportGenerationRef\.current;[\s\S]*const closingTransport = transportRef\.current;[\s\S]*idleTimeoutOperationRef\.current = timeoutOperation/, "idle timeout must prevent overlapping operations and capture its transport generation");
assert.match(idleTimeoutFlow, /timeoutOperation\.stateCleared = clearConversationState\("timeout", \{ sessionEpochAlreadyInvalidated: true \}\);[\s\S]*timeoutOperation\.noticeSent = true;[\s\S]*say\("system", t\("app\.timeoutMessage"\)\);[\s\S]*timeoutOperation\.promise = \(async \(\) =>/, "idle timeout must synchronously clear state and publish one notice before background cleanup");
assert.match(idleTimeoutFlow, /finally\s*\{[\s\S]*idleTimeoutOperationRef\.current === timeoutOperation[\s\S]*sessionEpochRef\.current === invalidatedEpoch[\s\S]*if \(!timeoutOperation\.stateCleared\)[\s\S]*if \(timeoutOperation\.stateCleared && !timeoutOperation\.noticeSent\)/, "idle background completion may only repair missing cleanup while it still owns the operation and epoch");
assert.doesNotMatch(idleTimeoutFlow, /finally\s*\{[\s\S]*setSessionMode\(null\)/, "idle background completion must never overwrite a newer session mode");
assert.doesNotMatch(app, /conversation\.endSession/, "all App transport closes must use bounded captured handles");

console.log("Validated bounded text-to-voice teardown, stale-attempt cleanup, successful voice transition, and newer-attempt ownership.");
