export const TRANSPORT_START_TIMEOUT_MS = 15_000;
export const TRANSPORT_END_TIMEOUT_MS = 8_000;

function operationTimeout(timeoutMs, message) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return {
    promise,
    cancel: () => globalThis.clearTimeout(timer),
  };
}

/**
 * Starts one SDK transport with a bounded wait. When the SDK promise outlives
 * that bound, the caller retires the transport host synchronously. Cleanup is
 * deliberately attached to the original handle and never awaited, so a fresh
 * host can retry even if the old SDK promise never settles.
 */
export async function startTransportWithRetirement({
  transport,
  options,
  retire,
  timeoutMs = TRANSPORT_START_TIMEOUT_MS,
}) {
  const rawStart = transport.startSession(options);
  const timeout = operationTimeout(timeoutMs, "Conversation start timed out");

  try {
    return await Promise.race([rawStart, timeout.promise]);
  } catch (error) {
    if (/timed out/i.test(error?.message || "")) {
      retire();
      void Promise.resolve(rawStart)
        .then(() => transport.endSession())
        .catch(() => {});
    }
    throw error;
  } finally {
    timeout.cancel();
  }
}

/**
 * Ends one SDK transport with a bounded wait. If the SDK close promise stalls,
 * the caller retires that exact transport generation and can continue on a
 * fresh host. The late promise remains attached only to the retired handle.
 */
export async function endTransportWithRetirement({
  transport,
  retire,
  timeoutMs = TRANSPORT_END_TIMEOUT_MS,
}) {
  if (!transport || typeof transport.endSession !== "function") return { ended: true, retired: false };

  const rawEnd = Promise.resolve().then(() => transport.endSession());
  const timeout = operationTimeout(timeoutMs, "Conversation end timed out");

  try {
    await Promise.race([rawEnd, timeout.promise]);
    return { ended: true, retired: false };
  } catch (error) {
    retire();
    if (/timed out/i.test(error?.message || "")) {
      void rawEnd.catch(() => {});
      return { ended: false, retired: true };
    }
    void rawEnd.catch(() => {});
    throw error;
  } finally {
    timeout.cancel();
  }
}

/**
 * Clears start UI only when the settling attempt still owns the shared ref.
 * An older attempt must never hide the progress state of a newer attempt.
 */
export function finalizeOwnedSessionStart({ startRef, entry, clearStartingMode }) {
  if (startRef.current !== entry) return false;
  startRef.current = null;
  clearStartingMode();
  return true;
}

export function canRestorePreviousSession({
  previousMode,
  previousTransport,
  previousGeneration,
  endedPreviousSession,
  currentMode,
  currentTransport,
  currentGeneration,
  currentStatus,
}) {
  return Boolean(
    previousMode
    && previousTransport
    && !endedPreviousSession
    && currentMode === previousMode
    && currentTransport === previousTransport
    && currentGeneration === previousGeneration
    && currentStatus === "connected"
  );
}

export function beginOwnedSessionSwitch({ ownerRef, switchingRef }) {
  const owner = {};
  ownerRef.current = owner;
  switchingRef.current = true;
  return owner;
}

export function finalizeOwnedSessionSwitch({ ownerRef, switchingRef, owner }) {
  if (!owner || ownerRef.current !== owner) return false;
  ownerRef.current = null;
  switchingRef.current = false;
  return true;
}

export function resetOwnedSessionSwitch({ ownerRef, switchingRef }) {
  ownerRef.current = null;
  switchingRef.current = false;
}

export function waitForLazyTransport({
  getTransport,
  isEpochCurrent,
  isGenerationCurrent,
  timeoutMs = 10_000,
  pollMs = 20,
}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      if (!isEpochCurrent()) {
        resolve(null);
        return;
      }
      if (!isGenerationCurrent()) {
        reject(new Error("Conversation transport restarted while loading"));
        return;
      }
      const transport = getTransport();
      if (transport) {
        resolve(transport);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Conversation transport could not load"));
        return;
      }
      globalThis.setTimeout(poll, pollMs);
    };
    poll();
  });
}
