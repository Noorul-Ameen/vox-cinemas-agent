export function createLocalDeterministicToolAuthorization({ toolName, turnSequence, journeyId } = {}) {
  return Object.freeze({
    toolName: String(toolName || ""),
    turnSequence: Number(turnSequence) || 0,
    journeyId: String(journeyId || ""),
  });
}

export function shouldBlockConcurrentDeterministicToolCall({
  activeAuthorization,
  presentedAuthorization,
  toolName,
} = {}) {
  return Boolean(
    activeAuthorization
    && activeAuthorization.toolName === toolName
    && presentedAuthorization !== activeAuthorization
  );
}
