export const ELEVENLABS_WORKLET_PATHS = Object.freeze({
  rawAudioProcessor: "/elevenlabs/rawAudioProcessor.js",
  audioConcatProcessor: "/elevenlabs/audioConcatProcessor.js",
});

export const VOICE_MIC_PERMISSION_TIMEOUT_MS = 45_000;
export const VOICE_TRANSPORT_START_TIMEOUT_MS = 45_000;

export function requireMicrophoneCapture(mediaDevices) {
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
    const error = new Error("Microphone capture API is unavailable");
    error.name = "NotSupportedError";
    throw error;
  }
  return mediaDevices;
}

export function voiceStartupErrorKey(error) {
  const name = String(error?.name || "").toLowerCase();
  const message = String(error?.message || error || "").toLowerCase();
  const combined = `${name} ${message}`;

  if (/notallowederror|securityerror|permission denied|permission dismissed|not permitted/.test(combined)) {
    return "app.voicePermissionError";
  }
  if (/microphone permission.*(?:timeout|timed out)|permission.*(?:timeout|timed out)/.test(combined)) {
    return "app.voicePermissionError";
  }
  if (/notfounderror|devicesnotfounderror|no microphone|requested device not found/.test(combined)) {
    return "app.voiceDeviceError";
  }
  if (/notsupportederror|microphone capture api|mediadevices|getusermedia|secure context/.test(combined)) {
    return "app.voiceUnsupportedError";
  }
  if (/audioworklet|rawaudioprocessor|audioconcatprocessor|worklet module/.test(combined)) {
    return "app.voiceComponentError";
  }
  if (/authorization|unauthorized|forbidden|invalid agent|agentid|agent id|origin|conversationtoken|conversation token|\b401\b|\b403\b/.test(combined)) {
    return "app.voiceServiceError";
  }
  if (/timeout|timed out|network|failed to fetch|webrtc|ice connection/.test(combined)) {
    return "app.voiceTimeoutError";
  }
  return "app.voiceStartError";
}
