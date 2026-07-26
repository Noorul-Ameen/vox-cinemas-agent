import { extractDiscoveryPreferencePatch } from "./discoveryPreferences.js";
import { parseSpokenShowtimeHourChoice } from "./spokenShowtimeChoice.js";

const INFORMATION_ONLY = /^\s*(?:(?:what|which|when|is there|are there|do you have|tell me)\b|(?:ماذا|متى|ما|هل يوجد|هل توجد)(?=\s|$))|[?؟]\s*$/iu;
const HOUR_ONLY_CHOICE = /^\s*(?:(?:at|around|about|near|approximately|by|الساعة|حوالي)\s*)?(\d{1,2})\s*(a\s*m|p\s*m|صباحا|صباح|مساء|ليلا)?\s*(?:please|من فضلك)?[.!،]*$/iu;
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function explicitlyNamedVisibleExperience(value, sessions) {
  const text = String(value || "");
  return [...new Set((sessions || [])
    .map((session) => String(session?.exp || session?.experience || "").trim())
    .filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .find((experience) => new RegExp(`(?:^|\\s)${escapeRegex(experience)}(?=\\s|[.!?،؟]|$)`, "iu").test(text))
    || null;
}

function visibleSessionTime(session) {
  const match = String(session?.time || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

function possibleHoursForChoice(match) {
  const rawHour = Number(match[1]);
  if (!Number.isInteger(rawHour) || rawHour < 0 || rawHour > 23) return [];

  const marker = String(match[2] || "").replace(/\s/g, "").toLowerCase();
  if (/^pm$|مساء|ليلا/u.test(marker)) return rawHour <= 12 ? [(rawHour % 12) + 12] : [];
  if (/^am$|صباح/u.test(marker)) return rawHour <= 12 ? [rawHour % 12] : [];
  if (rawHour === 0 || rawHour > 12) return [rawHour];

  const twelveHour = rawHour % 12;
  return [...new Set([twelveHour, twelveHour + 12])];
}

/**
 * Resolve one exact, visible showtime from a conversational time choice.
 * Ambiguous same-time sessions remain unresolved until the guest names the
 * experience or taps one of the visible options.
 */
export function visibleShowtimeSelectionCandidates({ text, stage } = {}) {
  if (stage?.view !== "showtimes" || !Array.isArray(stage.sessions) || !stage.sessions.length) return [];
  const value = String(text || "").trim();
  if (!value || INFORMATION_ONLY.test(value)) return [];

  const signal = extractDiscoveryPreferencePatch(value, { expectingTime: true });
  const requestedTime = signal.patch.preferredTime;

  const experience = (signal.patch.experience || explicitlyNamedVisibleExperience(value, stage.sessions))?.toUpperCase();
  const visibleSessions = experience
    ? stage.sessions.filter((session) => String(session.exp || session.experience).toUpperCase() === experience)
    : stage.sessions;
  const spokenHourChoice = parseSpokenShowtimeHourChoice(value);
  if (spokenHourChoice) {
    const possibleHours = new Set(spokenHourChoice.hours);
    const hourMatches = visibleSessions.filter((session) => {
      const sessionTime = visibleSessionTime(session);
      return sessionTime
        && possibleHours.has(sessionTime.hour)
        && (!spokenHourChoice.minuteSpecified || sessionTime.minute === spokenHourChoice.minute);
    });
    if (spokenHourChoice.minuteSpecified) return hourMatches;
    const onTheHourMatches = hourMatches.filter((session) => visibleSessionTime(session)?.minute === 0);
    return onTheHourMatches.length ? onTheHourMatches : hourMatches;
  }

  if (!requestedTime) return [];
  const hourOnlyChoice = value.match(HOUR_ONLY_CHOICE);
  if (hourOnlyChoice) {
    const possibleHours = new Set(possibleHoursForChoice(hourOnlyChoice));
    if (!possibleHours.size) return [];
    const hourMatches = visibleSessions.filter((session) => {
      const sessionTime = visibleSessionTime(session);
      return sessionTime && possibleHours.has(sessionTime.hour);
    });
    const onTheHourMatches = hourMatches.filter((session) => visibleSessionTime(session)?.minute === 0);
    return onTheHourMatches.length ? onTheHourMatches : hourMatches;
  }

  return visibleSessions.filter((session) => session.time === requestedTime);
}

export function resolveVisibleShowtimeSelectionTurn({ text, stage } = {}) {
  const matches = visibleShowtimeSelectionCandidates({ text, stage });
  return matches.length === 1 ? matches[0] : null;
}
