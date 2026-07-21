import { extractDiscoveryPreferencePatch } from "./discoveryPreferences.js";

const INFORMATION_ONLY = /^\s*(?:what|which|when|is there|are there|do you have|tell me|ما|ماذا|متى|هل يوجد|هل توجد)\b|[?؟]\s*$/iu;

/**
 * Resolve one exact, visible showtime from a conversational time choice.
 * Ambiguous same-time sessions remain unresolved until the guest names the
 * experience or taps one of the visible options.
 */
export function resolveVisibleShowtimeSelectionTurn({ text, stage } = {}) {
  if (stage?.view !== "showtimes" || !Array.isArray(stage.sessions) || !stage.sessions.length) return null;
  const value = String(text || "").trim();
  if (!value || INFORMATION_ONLY.test(value)) return null;

  const signal = extractDiscoveryPreferencePatch(value, { expectingTime: true });
  const requestedTime = signal.patch.preferredTime;
  if (!requestedTime) return null;

  let matches = stage.sessions.filter((session) => session.time === requestedTime);
  if (signal.patch.experience) {
    const requestedExperience = signal.patch.experience.toUpperCase();
    matches = matches.filter((session) => String(session.exp || session.experience).toUpperCase() === requestedExperience);
  }
  return matches.length === 1 ? matches[0] : null;
}
