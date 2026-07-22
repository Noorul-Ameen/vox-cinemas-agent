const HOUR_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  "واحد": 1, "واحدة": 1, "الواحدة": 1,
  "اثنان": 2, "اثنين": 2, "اثنتان": 2, "اثنتين": 2, "اتنين": 2, "الثانية": 2,
  "ثلاثة": 3, "ثلاثه": 3, "الثالثة": 3,
  "اربعة": 4, "أربعة": 4, "اربع": 4, "الرابعة": 4,
  "خمسة": 5, "خمسه": 5, "الخامسة": 5,
  "ستة": 6, "سته": 6, "السادسة": 6,
  "سبعة": 7, "سبعه": 7, "السابعة": 7,
  "ثمانية": 8, "ثمانيه": 8, "الثامنة": 8,
  "تسعة": 9, "تسعه": 9, "التاسعة": 9,
  "عشرة": 10, "عشره": 10, "العاشرة": 10,
  "احد عشر": 11, "أحد عشر": 11, "احدى عشرة": 11, "إحدى عشرة": 11, "الحادية عشرة": 11,
  "اثنا عشر": 12, "إثنا عشر": 12, "اثني عشر": 12, "اثنتا عشرة": 12, "الثانية عشرة": 12,
});

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const normalizeClockDigits = (value) => String(value ?? "").replace(/[٠-٩۰-۹]/gu, (digit) => {
  const arabicIndic = ARABIC_INDIC_DIGITS.indexOf(digit);
  if (arabicIndic >= 0) return String(arabicIndic);
  return String(EASTERN_ARABIC_DIGITS.indexOf(digit));
});
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HOUR_TOKEN = `(?:${Object.keys(HOUR_WORDS)
  .sort((left, right) => right.length - left.length)
  .map(escapeRegex)
  .join("|")}|[0-9]|1[0-9]|2[0-3])`;
const CHOICE_PREFIX = "(?:(?:i|we)\\s+(?:want|would\\s+like|will\\s+take)|i\\s+d\\s+like|(?:book|choose|select|take)|give\\s+(?:me|us)|at|around|about|near|approximately|by|for|(?:اريد|أريد)(?:\\s+عرض)?(?:\\s+الساعة)?|(?:اختر|اختار|احجز)(?:\\s+لي)?(?:\\s+عرض)?(?:\\s+الساعة)?|الساعة|حوالي)";
const CHOICE_SUFFIX = "(?:show|showtime|session|one|عرض|العرض|موعد)";
const DAY_PART_TOKEN = "(?:am|pm|night|evening|morning|afternoon|صباحا|صباح|مساء|ليلا)";
const SPOKEN_HOUR_CHOICE = new RegExp(
  `^(?:${CHOICE_PREFIX}\\s+)?(?:the\\s+)?(${HOUR_TOKEN})(?::([0-5]\\d))?\\s*(?:(?:at|in\\s+the)\\s+)?(${DAY_PART_TOKEN})?(?:\\s+${CHOICE_SUFFIX})?(?:\\s+(?:please|من\\s+فضلك))?$`,
  "u",
);

function normalizeSpokenClockChoice(input) {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/gu, "")
    .replace(/[٠-٩۰-۹]/gu, (digit) => normalizeClockDigits(digit))
    .replace(/[’']/gu, " ")
    .replace(/\ba\s*\.?\s*m\.?(?=\s|$)/gu, " am ")
    .replace(/\b(?:ay|aye)\s+em\b/gu, " am ")
    .replace(/\bp\s*\.?\s*m\.?(?=\s|$)/gu, " pm ")
    .replace(/\bpee\s+em\b/gu, " pm ")
    .replace(/[,.!?;،؟]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Parse a complete English or Arabic showtime-choice utterance without guessing from
 * unrelated prose. An hour without AM or PM deliberately keeps both possible
 * 24-hour values so the visible schedule can resolve, or expose, ambiguity.
 */
export function parseSpokenShowtimeHourChoice(input) {
  const normalized = normalizeSpokenClockChoice(input);
  const match = normalized.match(SPOKEN_HOUR_CHOICE);
  if (!match) return null;

  const rawHour = HOUR_WORDS[match[1]] ?? Number(match[1]);
  const minuteSpecified = match[2] != null;
  const minute = Number(match[2] || 0);
  const meridiem = match[3] || null;
  if (!Number.isInteger(rawHour) || rawHour < 0 || rawHour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (meridiem && rawHour > 12) return null;

  if (/^(?:am|morning|صباحا|صباح)$/u.test(meridiem || "")) {
    return { hours: [rawHour % 12], minute, minuteSpecified, meridiem };
  }
  if (/^(?:pm|evening|afternoon|مساء)$/u.test(meridiem || "")) {
    return { hours: [(rawHour % 12) + 12], minute, minuteSpecified, meridiem };
  }
  if (/^(?:night|ليلا)$/u.test(meridiem || "")) {
    const contextualHour = rawHour === 12
      ? 0
      : rawHour >= 1 && rawHour <= 5
        ? rawHour
        : rawHour < 12
          ? rawHour + 12
          : rawHour;
    return { hours: [contextualHour], minute, minuteSpecified, meridiem };
  }
  if (rawHour === 0 || rawHour > 12) {
    return { hours: [rawHour], minute, minuteSpecified, meridiem };
  }

  const twelveHour = rawHour % 12;
  return {
    hours: [...new Set([twelveHour, twelveHour + 12])],
    minute,
    minuteSpecified,
    meridiem,
  };
}
