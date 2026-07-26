import { CINEMA_ALIASES, resolveCinemaCandidate } from "./cinemaRouting.js";
import { resolveFilmCandidate } from "./fuzzyResolvers.js";
import { stripLanguageControlCommand } from "./languageSwitch.js";

export const DISCOVERY_PREFERENCE_KEYS = Object.freeze([
  "cinemaId",
  "cinemaName",
  "city",
  "date",
  "dateSignal",
  "preferredTime",
  "timeRangeStart",
  "timeRangeEnd",
  "timeRangeStrict",
  "timeBand",
  "genre",
  "language",
  "experience",
  "movieId",
  "movieTitle",
  "audience",
  "openChoice",
  "recommendationIntent",
]);

export const EMPTY_DISCOVERY_PREFERENCES = Object.freeze(
  Object.fromEntries(DISCOVERY_PREFERENCE_KEYS.map((key) => [key, null])),
);

export function hasDiscoveryTimePreference(preferences = {}) {
  return Boolean(
    preferences.preferredTime
    || (preferences.timeRangeStart && preferences.timeRangeEnd)
    || preferences.timeBand
  );
}

export function formatDiscoveryTimePreference(preferences = {}, { locale = "en" } = {}) {
  if (preferences.timeRangeStart && preferences.timeRangeEnd) {
    return locale === "ar"
      ? `${preferences.timeRangeStart} إلى ${preferences.timeRangeEnd}`
      : `${preferences.timeRangeStart} to ${preferences.timeRangeEnd}`;
  }
  return preferences.preferredTime || preferences.timeBand || "";
}

const PREFERENCE_KEY_SET = new Set(DISCOVERY_PREFERENCE_KEYS);
const TIME_BANDS = Object.freeze({
  morning: [360, 720],
  afternoon: [720, 1020],
  evening: [1020, 1440],
  late: [1260, 1800],
});

const ENGLISH_CLOCK_HOURS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
});
const ARABIC_CLOCK_HOURS = Object.freeze({
  "واحد": 1,
  "واحدة": 1,
  "الواحدة": 1,
  "اثنان": 2,
  "اثنين": 2,
  "اثنتان": 2,
  "اثنتين": 2,
  "اتنين": 2,
  "الثانية": 2,
  "ثلاثة": 3,
  "ثلاثه": 3,
  "الثالثة": 3,
  "اربعة": 4,
  "أربعة": 4,
  "اربع": 4,
  "الرابعة": 4,
  "خمسة": 5,
  "خمسه": 5,
  "الخامسة": 5,
  "ستة": 6,
  "سته": 6,
  "السادسة": 6,
  "سبعة": 7,
  "سبعه": 7,
  "السابعة": 7,
  "ثمانية": 8,
  "ثمانيه": 8,
  "الثامنة": 8,
  "تسعة": 9,
  "تسعه": 9,
  "التاسعة": 9,
  "عشرة": 10,
  "عشره": 10,
  "العاشرة": 10,
  "احد عشر": 11,
  "أحد عشر": 11,
  "احدى عشرة": 11,
  "إحدى عشرة": 11,
  "الحادية عشرة": 11,
  "اثنا عشر": 12,
  "إثنا عشر": 12,
  "اثني عشر": 12,
  "اثنتا عشرة": 12,
  "الثانية عشرة": 12,
});

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const normalizeClockDigits = (value) => String(value ?? "").replace(/[٠-٩۰-۹]/gu, (digit) => {
  const arabicIndic = ARABIC_INDIC_DIGITS.indexOf(digit);
  if (arabicIndic >= 0) return String(arabicIndic);
  return String(EASTERN_ARABIC_DIGITS.indexOf(digit));
});
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_CLOCK_HOURS = Object.freeze({ ...ENGLISH_CLOCK_HOURS, ...ARABIC_CLOCK_HOURS });
const CLOCK_HOUR_TOKEN = `(?:${Object.keys(WORD_CLOCK_HOURS)
  .sort((left, right) => right.length - left.length)
  .map(escapeRegex)
  .join("|")}|[0-9]|1[0-9]|2[0-3])`;
const DAY_PART_TOKEN = "(?:a\\s*m|p\\s*m|night|evening|morning|afternoon|صباحا|صباح|مساء|ليلا)";

function clockHour(value) {
  const key = normalizeClockDigits(value).toLowerCase().trim();
  const hour = WORD_CLOCK_HOURS[key] ?? Number(key);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function hourForDayPart(hour, dayPart) {
  const part = String(dayPart || "").toLowerCase();
  if (/night|ليلا/u.test(part)) {
    if (hour === 12) return 0;
    if (hour >= 1 && hour <= 5) return hour;
    return hour < 12 ? hour + 12 : hour;
  }
  if (/p\s*m|evening|afternoon|مساء/u.test(part)) return hour === 12 ? 12 : hour < 12 ? hour + 12 : hour;
  if (/a\s*m|morning|صباح/u.test(part)) return hour === 12 ? 0 : hour;
  return hour;
}

const CINEMA_CITY_BY_ID = Object.freeze({
  "0001": "Dubai",
  "0002": "Dubai",
  "0004": "Ajman",
  "0005": "Dubai",
  "0006": "Fujairah",
  "0007": "Dubai",
  "0009": "Ras Al Khaimah",
  "0012": "Abu Dhabi",
  "0013": "Dubai",
  "0014": "Abu Dhabi",
  "0015": "Dubai",
  "0017": "Dubai",
  "0035": "Sharjah",
  "0036": "Abu Dhabi",
  "0039": "Al Ain",
  "0045": "Dubai",
  "0046": "Abu Dhabi",
  "0049": "Dubai",
  "0055": "Sharjah",
  "0057": "Dubai",
  "0104": "Abu Dhabi",
  "0105": "Dubai",
});

const CITY_ALIASES = Object.freeze([
  ["Ras Al Khaimah", ["ras al khaimah", "ras al-khaimah", "rak", "رأس الخيمة", "راس الخيمة"]],
  ["Abu Dhabi", ["abu dhabi", "أبو ظبي", "ابو ظبي", "أبوظبي", "ابوظبي"]],
  ["Al Ain", ["al ain", "al-ain", "العين"]],
  ["Sharjah", ["sharjah", "الشارقة"]],
  ["Fujairah", ["fujairah", "الفجيرة"]],
  ["Ajman", ["ajman", "عجمان"]],
  ["Dubai", ["dubai", "دبي"]],
]);

const GENRE_ALIASES = Object.freeze([
  ["Science Fiction", ["science fiction", "sci fi", "sci-fi", "scifi", "خيال علمي", "الخيال العلمي"]],
  ["Animation", ["animation", "animated", "cartoon", "رسوم متحركة", "الرسوم المتحركة", "كرتوني", "كرتونية", "انيميشن"]],
  ["Documentary", ["documentary", "وثائقي", "وثائقية", "الوثائقي", "الوثائقية"]],
  ["Adventure", ["adventure", "مغامرات", "مغامرة", "المغامرات", "المغامرة"]],
  ["Thriller", ["thriller", "إثارة", "اثارة", "الإثارة", "الاثارة", "تشويق"]],
  ["Romance", ["romance", "romantic", "رومانسي", "رومانسية", "الرومانسي", "الرومانسية"]],
  ["Comedy", ["comedy", "funny", "كوميدي", "كوميدية", "كوميديا", "الكوميدي", "الكوميدية", "الكوميديا"]],
  ["Musical", ["musical", "موسيقي", "موسيقية", "الموسيقي", "الموسيقية"]],
  ["Action", ["action", "أكشن", "اكشن", "الأكشن", "الاكشن"]],
  ["Horror", ["horror", "scary", "رعب", "الرعب", "مرعب", "مرعبة"]],
  ["Drama", ["drama", "دراما", "الدراما", "درامي", "درامية"]],
  ["Family", ["family", "عائلي", "عائلية", "العائلي", "العائلية", "العائلة"]],
  ["Crime", ["crime", "جريمة", "الجريمة", "جرائم"]],
  ["Sports", ["sports", "sport", "رياضي", "رياضية", "الرياضي", "الرياضية"]],
  ["Fantasy", ["fantasy", "خيال", "الخيال", "فانتازيا"]],
  ["Mystery", ["mystery", "mysteries", "غموض", "الغموض"]],
  ["Biography", ["biography", "biographical", "سيرة ذاتية", "السيرة الذاتية"]],
  ["War", ["war", "war movie", "حرب", "الحرب", "حربي", "حربية"]],
  ["Western", ["western", "cowboy", "رعاة البقر"]],
  ["Film Noir", ["film noir", "noir"]],
]);

const LANGUAGE_ALIASES = Object.freeze([
  ["Kannada", ["kannada", "kan", "كانادا"]],
  ["Malayalam", ["malayalam", "مالايالامية", "مالايالام"]],
  ["English", ["english", "إنجليزي", "انجليزي", "الإنجليزية", "الانجليزية"]],
  ["Arabic", ["arabic", "عربي", "عربية", "العربية", "بالعربي", "بالعربية", "ناطق بالعربية", "مدبلج بالعربية"]],
  ["Spanish", ["spanish", "espanol", "español", "إسباني", "اسباني"]],
  ["Korean", ["korean", "كوري", "الكورية"]],
  ["Punjabi", ["punjabi", "بنجابي"]],
  ["Tagalog", ["tagalog", "filipino", "تاغالوغ"]],
  ["Turkish", ["turkish", "تركي"]],
  ["Telugu", ["telugu", "تيلوغو"]],
  ["Tamil", ["tamil", "تاميل"]],
  ["Hindi", ["hindi", "هندي"]],
  ["French", ["french", "francais", "français", "فرنسي", "فرنسية"]],
  ["German", ["german", "deutsch", "ألماني", "الماني"]],
  ["Italian", ["italian", "italiano", "إيطالي", "ايطالي"]],
  ["Japanese", ["japanese", "ياباني"]],
  ["Chinese", ["chinese", "mandarin", "cantonese", "صيني", "ماندرين", "كانتوني"]],
  ["Urdu", ["urdu", "أردو", "اردو"]],
  ["Bengali", ["bengali", "bangla", "بنغالي"]],
  ["Marathi", ["marathi", "ماراثي"]],
  ["Gujarati", ["gujarati", "غوجاراتي"]],
  ["Nepali", ["nepali", "نيبالي"]],
  ["Russian", ["russian", "روسي"]],
  ["Portuguese", ["portuguese", "portugues", "português", "برتغالي"]],
  ["Dutch", ["dutch", "هولندي"]],
  ["Persian", ["persian", "farsi", "فارسي"]],
  ["Dari", ["dari", "دری", "داري"]],
  ["Pashto", ["pashto", "pushto", "پښتو", "بشتو"]],
  ["Indonesian", ["indonesian", "bahasa indonesia", "إندونيسي", "اندونيسي"]],
  ["Thai", ["thai", "تايلندي"]],
  ["Vietnamese", ["vietnamese", "فيتنامي"]],
]);

const EXPERIENCE_ALIASES = Object.freeze([
  ["THEATRE PODS IN IMAX", ["theatre pods in imax", "theater pods in imax", "imax pods"]],
  ["PRIVATE CINEMA", ["private cinema", "private screening"]],
  ["Couch - 2 Seater", ["couch 2 seater", "couch", "sofa"]],
  ["CINEMANIUM", ["cinemanium", "cinemaniam", "سينيمانيوم"]],
  ["PREMIER", ["premier", "premiere"]],
  ["PREMIUM", ["premium"]],
  ["THEATRE", ["theatre", "theater"]],
  ["STANDARD", ["standard", "regular", "2d", "2-d"]],
  ["PRIVATE CINEMA", ["private"]],
  ["ONYX", ["onyx"]],
  ["IMAX", ["imax", "آيماكس", "ايماكس"]],
  ["4DX", ["4dx", "4d", "فور دي إكس", "فور دي اكس"]],
  ["GOLD", ["gold", "ذهبي"]],
  ["KIDS", ["kids cinema", "kids experience"]],
  ["MAX", ["max"]],
  ["DOLBY CINEMA", ["dolby cinema", "dolby", "دولبي سينما", "دولبي"]],
  ["SCREENX", ["screenx", "screen x"]],
  ["D-BOX", ["d box", "dbox"]],
  ["ICE IMMERSIVE", ["ice immersive"]],
]);

const normalizeText = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[٠-٩۰-۹]/gu, (digit) => normalizeClockDigits(digit))
  .replace(/[\u064b-\u065f\u0670]/g, "")
  .replace(/&/g, " and ")
  .replace(/[_\u2013\u2014-]+/g, " ")
  .replace(/[^\p{L}\p{N}:]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const normalizeKey = (value) => normalizeText(value).replace(/\s+/g, " ");
const phraseInText = (text, phrase) => ` ${text} `.includes(` ${normalizeText(phrase)} `);
const pad2 = (value) => String(value).padStart(2, "0");
const isoDate = (date) => `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
const addUtcDays = (date, days) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

function validCalendarDate(year, month, day) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() + 1 !== month
    || candidate.getUTCDate() !== day) return null;
  return candidate;
}

function dateInTimeZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`);
}

function canonicalDateSignal(input, { now = new Date(), timeZone = "Asia/Dubai" } = {}) {
  const raw = String(input ?? "").normalize("NFKC").toLowerCase();
  const text = normalizeText(input);
  const today = dateInTimeZone(now, timeZone);
  const normalizedRaw = normalizeClockDigits(raw);
  const directIso = normalizedRaw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (directIso) {
    const candidate = validCalendarDate(Number(directIso[1]), Number(directIso[2]), Number(directIso[3]));
    return candidate ? { date: isoDate(candidate), dateSignal: "explicit" } : null;
  }

  if (/\bday after tomorrow\b|بعد غد|بعد بكرة/.test(text)) {
    return { date: isoDate(addUtcDays(today, 2)), dateSignal: "day_after_tomorrow" };
  }
  if (/\btomorrow\b|\btmrw\b|غدا|بكرة/.test(text)) {
    return { date: isoDate(addUtcDays(today, 1)), dateSignal: "tomorrow" };
  }
  if (/\btonight\b|الليلة/.test(text)) return { date: isoDate(today), dateSignal: "tonight" };
  if (/\btoday\b|اليوم/.test(text)) return { date: isoDate(today), dateSignal: "today" };

  const numeric = normalizedRaw.match(/(?:^|\D)(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?(?:\D|$)/);
  if (numeric) {
    const yearValue = Number(numeric[3]) || today.getUTCFullYear();
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const candidate = validCalendarDate(year, Number(numeric[2]), Number(numeric[1]));
    return candidate ? { date: isoDate(candidate), dateSignal: "explicit" } : null;
  }

  const monthAliases = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
    may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
    september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11,
    december: 12, dec: 12,
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, مايو: 5, يونيو: 6,
    يوليو: 7, أغسطس: 8, اغسطس: 8, سبتمبر: 9, أكتوبر: 10, اكتوبر: 10,
    نوفمبر: 11, ديسمبر: 12,
  };
  for (const [monthName, month] of Object.entries(monthAliases)) {
    const monthToken = escapeRegex(monthName);
    const match = text.match(new RegExp(
      `(?:^|\\s)(?:(?:يوم|بتاريخ)\\s+)?(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthToken}|${monthToken}\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?=\\s|$)`,
      "u",
    ));
    if (match) {
      const day = Number(match[1] || match[2]);
      let year = today.getUTCFullYear();
      let candidate = validCalendarDate(year, month, day);
      if (!candidate) return null;
      if (candidate < today) candidate = validCalendarDate(year += 1, month, day);
      return candidate ? { date: isoDate(candidate), dateSignal: "explicit" } : null;
    }
  }

  const ordinalDay = raw.match(/\bon(?:(?:[\s,.-]+)(?:the|um+|uh+))*[\s,.-]+(\d{1,2})(?:st|nd|rd|th)\b(?=\s*(?:$|[,.!?;:]|\b(?:at|around|in|for|please)\b))/)
    || text.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)(?:\s+please)?$/);
  if (ordinalDay) {
    const day = Number(ordinalDay[1]);
    for (let monthOffset = 0; monthOffset < 12; monthOffset += 1) {
      const candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, day));
      if (candidate.getUTCDate() !== day || candidate < today) continue;
      return { date: isoDate(candidate), dateSignal: "explicit" };
    }
  }

  const weekdays = [
    ["sunday", "الأحد", "الاحد"],
    ["monday", "الإثنين", "الاثنين"],
    ["tuesday", "الثلاثاء"],
    ["wednesday", "الأربعاء", "الاربعاء"],
    ["thursday", "الخميس"],
    ["friday", "الجمعة"],
    ["saturday", "السبت"],
  ];
  const weekday = weekdays.findIndex((aliases) => aliases.some((name) => phraseInText(text, name)));
  if (weekday >= 0) {
    const namedWeekday = weekdays[weekday][0];
    const explicitlyNext = weekdays[weekday]
      .slice(1)
      .some((name) => new RegExp(
        `(?:^|\\s)(?:يوم\\s+)?${escapeRegex(normalizeText(name))}\\s+(?:القادم(?:ة)?|الجاي(?:ة)?)(?=\\s|$)`,
        "u",
      ).test(text));
    for (let offset = explicitlyNext ? 1 : 0; offset < 8; offset += 1) {
      const candidate = addUtcDays(today, offset);
      if (candidate.getUTCDay() === weekday) return { date: isoDate(candidate), dateSignal: namedWeekday };
    }
  }
  return null;
}

function timeBandFromText(text) {
  if (/\blate(?:\s+at)?\s+night\b|\bafter midnight\b|آخر الليل|بعد منتصف الليل/.test(text)) return "late";
  if (/\btonight\b|\bevening\b|\b(?:at|in the)\s+night\b|\bnight\b|الليلة|مساء|ليلا/.test(text)) return "evening";
  if (/\bafternoon\b|بعد الظهر/.test(text)) return "afternoon";
  if (/\bmorning\b|صباح/.test(text)) return "morning";
  return null;
}

function timeRangeFromText(text, timeBand) {
  const endpoint = `(${CLOCK_HOUR_TOKEN})(?::([0-5]\\d))?\\s*(?:(?:at|in\\s+the)\\s+)?(${DAY_PART_TOKEN})?`;
  const rangePattern = new RegExp(
    `(?:^|\\s)(?:(?:around|between|from|من|بين)\\s+)?${endpoint}\\s*(?:to|through|until|and|إلى|الى|حتى|و)\\s*${endpoint}(?=\\s|$)`,
    "u",
  );
  const match = text.match(rangePattern);
  if (!match) return null;

  let startHour = clockHour(match[1]);
  let endHour = clockHour(match[4]);
  const startMinute = Number(match[2] || 0);
  const endMinute = Number(match[5] || 0);
  if (startHour == null || endHour == null || startMinute > 59 || endMinute > 59) return null;

  // A meridiem or day-part supplied on only one endpoint applies to the whole
  // spoken range ("8 to 10 PM" and "from 8 PM to 10").
  const startDayPart = match[3] || match[6] || timeBand;
  const endDayPart = match[6] || match[3] || timeBand;
  startHour = hourForDayPart(startHour, startDayPart);
  endHour = hourForDayPart(endHour, endDayPart);

  return {
    start: `${pad2(startHour)}:${pad2(startMinute)}`,
    end: `${pad2(endHour)}:${pad2(endMinute)}`,
  };
}

function directionalTimeRangeFromText(text, timeBand) {
  const endpoint = `(?:(?:at|the\\s+hour|الساعة)\\s+)?(${CLOCK_HOUR_TOKEN})(?::([0-5]\\d))?\\s*(?:(?:at|in\\s+the)\\s+)?(${DAY_PART_TOKEN})?`;
  const directionBoundary = `(?=[\\s\\u064b-\\u065f]|$)`;
  const patterns = [
    ["after", new RegExp(`(?:^|\\s)(?:after|later\\s+than|بعد)\\s+${endpoint}${directionBoundary}`, "u")],
    ["after", new RegExp(`(?:^|\\s)(?:from|من)\\s+${endpoint}\\s+(?:onwards?|or\\s+later|فما\\s+بعد|وما\\s+بعد|فصاعدا)${directionBoundary}`, "u")],
    ["before", new RegExp(`(?:^|\\s)(?:before|earlier\\s+than|قبل)\\s+${endpoint}${directionBoundary}`, "u")],
  ];
  for (const [direction, pattern] of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    let hour = clockHour(match[1]);
    const minute = Number(match[2] || 0);
    if (hour == null || minute > 59) return null;
    hour = hourForDayPart(hour, match[3] || timeBand);
    const boundary = `${pad2(hour)}:${pad2(minute)}`;
    return direction === "after"
      ? { start: boundary, end: "05:59", strict: true }
      : { start: "06:00", end: boundary, strict: true };
  }
  return null;
}

function preferredTimeFromText(text, timeBand, { expectingTime = false } = {}) {
  if (/\bnoon\b|منتصف النهار/.test(text)) return "12:00";
  if (/\bmidnight\b|منتصف الليل/.test(text)) return "00:00";

  const markedClockPattern = new RegExp(
    `(?:^|\\s)(?:(?:at|around|about|near|approximately|by|الساعة|حوالي)\\s+)?(${CLOCK_HOUR_TOKEN})(?::([0-5]\\d))?\\s*(?:(?:at|in\\s+the)\\s+)?(${DAY_PART_TOKEN})(?=\\s|$)`,
    "u",
  );
  const contextualClockPattern = new RegExp(
    `(?:^|\\s)(?:at|around|about|near|approximately|by|الساعة|حوالي)\\s+(${CLOCK_HOUR_TOKEN})(?::([0-5]\\d))?(?=\\s|$)`,
    "u",
  );
  const markedClockMatch = text.match(markedClockPattern);
  const twentyFourHourMatch = text.match(/(?:\b(?:at|around|about|near|approximately|by|showtime|time)\s*)?\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const contextualHourMatch = text.match(contextualClockPattern);
  const standaloneClockMatch = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const expectedBarePattern = new RegExp(`^(${CLOCK_HOUR_TOKEN})(?::([0-5]\\d))?$`, "u");
  const expectedBareHourMatch = expectingTime ? text.match(expectedBarePattern) : null;
  const match = markedClockMatch || twentyFourHourMatch || contextualHourMatch || standaloneClockMatch || expectedBareHourMatch;
  if (!match) return null;

  let hour = clockHour(match[1]);
  const minute = Number(match[2] || 0);
  if (hour == null || minute < 0 || minute > 59) return null;
  const marker = String(match[3] || "");
  hour = hourForDayPart(hour, marker);
  if (!marker && timeBand) hour = hourForDayPart(hour, timeBand);
  return `${pad2(hour)}:${pad2(minute)}`;
}

function findAliasValue(text, groups) {
  const matches = [];
  for (const [canonical, aliases] of groups) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      if (phraseInText(text, normalizedAlias)) matches.push({ canonical, length: normalizedAlias.length });
    }
  }
  return matches.sort((left, right) => right.length - left.length || left.canonical.localeCompare(right.canonical))[0]?.canonical || null;
}

function dynamicAliasGroups(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))]
    .map((value) => [value, [value]]);
}

function movieIdentity(movie) {
  return String(movie?.id ?? movie?.code ?? movie?.ScheduledFilmId ?? movie?.scheduledFilmId ?? movie?.movieId ?? "").trim();
}

function movieTitle(movie) {
  return String(movie?.title ?? movie?.Title ?? movie?.name ?? "").trim();
}

function uniqueMovieCatalog(movies) {
  const seen = new Set();
  return (Array.isArray(movies) ? movies : []).filter((movie) => {
    const identity = movieIdentity(movie);
    const title = normalizeText(movieTitle(movie));
    const key = identity ? `id:${normalizeText(identity)}` : `title:${title}`;
    if (!title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TITLE_CONNECTOR_TOKENS = new Set(["a", "an", "and", "of", "the"]);
const TITLE_PARTIAL_BLOCKLIST = new Set([
  "action", "adventure", "animation", "arabic", "comedy", "documentary", "drama", "english",
  "family", "fantasy", "french", "german", "hindi", "horror", "imax", "italian", "kids",
  "malayalam", "movie", "movies", "musical", "mystery", "premier", "romance", "screenx",
  "showtime", "showtimes", "standard", "tamil", "telugu", "theatre", "thriller", "tonight",
  "tomorrow", "urdu", "western",
]);

function distinctiveTitleTokens(value) {
  return normalizeText(value).split(" ").filter((token) => (
    token.length >= 4
    && !TITLE_CONNECTOR_TOKENS.has(token)
    && !TITLE_PARTIAL_BLOCKLIST.has(token)
  ));
}

function hasNaturalTitleReference(text) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  return words.length <= 5
    || /\b(?:book|called|named|rated|rating|see|show|suitable|tell|watch|what|which)\b/.test(text)
    || /\b(?:i want|i need|tickets for|movie|film)\b/.test(text);
}

function findMovieInText(text, movies) {
  const titleSearchText = text.replace(/\b(?:i want|i need)\s+to\s+go(?:\s+for)?\b/g, "i want");
  const entries = uniqueMovieCatalog(movies)
    .map((movie) => ({ movie, title: normalizeText(movieTitle(movie)) }))
    .filter(({ title }) => title.length >= 2);
  const exact = entries
    .filter(({ title }) => phraseInText(titleSearchText, title))
    .sort((left, right) => right.title.length - left.title.length || movieTitle(left.movie).localeCompare(movieTitle(right.movie)));
  if (exact.length) return exact[0].movie;
  if (!hasNaturalTitleReference(titleSearchText)) return null;

  // A guest often says only the distinctive portion of a published title,
  // such as "Minions" for "Minions & Monsters". Accept that shorthand only
  // when it identifies one catalog movie. This is deliberately separate from
  // the protected fuzzy resolver and never guesses on a tie.
  const partial = entries.map((entry) => {
    const matched = distinctiveTitleTokens(entry.title).filter((token) => phraseInText(titleSearchText, token));
    return { ...entry, matched, score: matched.reduce((total, token) => total + token.length, 0) };
  }).filter(({ matched }) => matched.length > 0)
    .sort((left, right) => right.matched.length - left.matched.length || right.score - left.score || right.title.length - left.title.length);
  if (!partial.length) return null;
  const best = partial[0];
  const tied = partial.filter((entry) => entry.matched.length === best.matched.length && entry.score === best.score);
  return tied.length === 1 ? best.movie : null;
}

function withoutResolvedCinemaPhrase(text, cinema) {
  if (!cinema) return text;
  const cinemaId = String(cinema.id ?? cinema.ID ?? "").trim();
  const normalizedName = normalizeText(cinema.name ?? cinema.Name ?? "");
  const phrases = [
    normalizedName,
    normalizedName.replace(/^vox\s+/, ""),
    ...(CINEMA_ALIASES[cinemaId] || []).map(normalizeText),
  ]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  let remaining = ` ${text} `;
  for (const phrase of new Set(phrases)) {
    remaining = remaining.split(` ${phrase} `).join(" ");
  }
  return remaining.replace(/\s+/g, " ").trim();
}

const REPLACEMENT_MOVIE_DISCOVERY = /\b(?:any\s+(?:new|different)\s+(?:movie|film)|(?:new|different)\s+(?:movies?|films?))\b|(?:اي|أي)\s+فيلم\s+(?:جديد|مختلف)|فيلم\s+(?:جديد|مختلف)|(?:افلام|أفلام)\s+(?:جديدة|مختلفة|اخرى|أخرى)/iu;
const SUGGESTED_MOVIE_LIST = /\b(?:suggest|recommend)\b[\s\S]{0,48}\b(?:movies|films)\b|(?:اقترح|رشح)[\s\S]{0,48}(?:افلام|أفلام)/iu;
const EXPLICIT_CONTENT_REPLACEMENT = /\b(?:i\s+ve\s+|i\s+have\s+|i\s+)?changed?\s+my\s+mind\b|(?:غيرت|غيّرت)\s+رأيي/iu;

const UNSUPPORTED_AFGHAN_LANGUAGE = /\bafghan(?:i)?\b|(?:\u0623|\u0627)\u0641\u063a\u0627\u0646\u064a(?:\u0629|\u0647)?/iu;

function isReplacementMovieDiscovery(text) {
  return REPLACEMENT_MOVIE_DISCOVERY.test(text) || SUGGESTED_MOVIE_LIST.test(text);
}

function isExplicitContentReplacement(text) {
  return EXPLICIT_CONTENT_REPLACEMENT.test(text);
}

function explicitClears(text) {
  const clear = new Set();
  if (/\b(?:start over|reset everything|clear all filters)\b|ابدأ من جديد|امسح كل/.test(text)) {
    DISCOVERY_PREFERENCE_KEYS.forEach((key) => clear.add(key));
    return clear;
  }
  if (/\b(?:any|another)\s+(?:cinema|location|venue)\b|\bwherever\b|اي سينما|أي سينما/.test(text)) {
    ["cinemaId", "cinemaName", "city"].forEach((key) => clear.add(key));
  }
  if (/\b(?:any|another)\s+(?:date|day)\b|اي يوم|أي يوم/.test(text)) ["date", "dateSignal"].forEach((key) => clear.add(key));
  if (/\b(?:any time|whenever|no time preference)\b|اي وقت|أي وقت/.test(text)) {
    ["preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand"].forEach((key) => clear.add(key));
  }
  if (/\b(?:any genre|no genre preference)\b|اي نوع|أي نوع/.test(text)) ["genre", "audience"].forEach((key) => clear.add(key));
  if (/\b(?:any language|no language preference)\b|اي لغة|أي لغة/.test(text)) clear.add("language");
  if (/\b(?:any (?:format|experience)|regular is fine|no (?:format|experience) preference)\b|اي تجربة|أي تجربة/.test(text)) clear.add("experience");
  if (isExplicitContentReplacement(text)) {
    // A content change retains the guest's established place, date, and time,
    // but cannot safely intersect with an earlier movie or content facet.
    ["movieId", "movieTitle", "genre", "language", "experience", "audience", "openChoice", "recommendationIntent"]
      .forEach((key) => clear.add(key));
  }
  if (/\b(?:any movie|another movie|other movies|something else)\b|فيلم آخر|فيلم اخر/.test(text) || isReplacementMovieDiscovery(text)) {
    ["movieId", "movieTitle"].forEach((key) => clear.add(key));
  }
  if (isReplacementMovieDiscovery(text)) {
    ["preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand"].forEach((key) => clear.add(key));
  }
  const filterClearRequest = /\b(?:remove|clear|drop|reset)\b.*\b(?:filters?|preferences?)\b|(?:امسح|احذف|الغ|ألغي).*(?:الفلاتر|المرشحات|التفضيلات)/u.test(text);
  if (filterClearRequest) {
    const optionalKeys = ["preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand", "genre", "audience", "language", "experience", "openChoice", "recommendationIntent"];
    const clearEverythingOptional = /\b(?:all|every)\b|(?:كل|جميع)/u.test(text);
    let namedFilter = false;
    if (/\b(?:time|showtime)\b|(?:وقت|موعد)/u.test(text)) {
      ["preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand"].forEach((key) => clear.add(key));
      namedFilter = true;
    }
    if (/\bgenre\b|(?:نوع|تصنيف)/u.test(text)) {
      ["genre", "audience"].forEach((key) => clear.add(key));
      namedFilter = true;
    }
    if (/\blanguage\b|(?:لغة|اللغه|اللغة)/u.test(text)) {
      clear.add("language");
      namedFilter = true;
    }
    if (/\b(?:experience|format)\b|(?:تجربة|صيغة)/u.test(text)) {
      clear.add("experience");
      namedFilter = true;
    }
    if (clearEverythingOptional || !namedFilter) optionalKeys.forEach((key) => clear.add(key));
  }
  if (/\b(?:not for kids|no kids)\b|ليس للاطفال|مش للاطفال/.test(text)) clear.add("audience");
  if (/\b(?:not educational|no educational (?:filter|preference)|without (?:an )?educational (?:filter|preference)|show (?:the )?(?:family|other) options instead)\b|بدون تفضيل تعليمي|ليس تعليميا/.test(text)) clear.add("recommendationIntent");
  return clear;
}

/**
 * Recognize an explicit request to continue without another movie preference.
 * Previously supplied filters remain active. For example, "anything is fine"
 * after "French movies" means any French movie, not any language.
 */
export function isOpenDiscoveryChoiceReply(input) {
  const text = normalizeText(input);
  if (!text) return false;
  if (REPLACEMENT_MOVIE_DISCOVERY.test(text)) return true;
  // The preference can share a turn with a cinema, date, or time. Recognize
  // an unambiguous open-choice phrase before applying the exact-reply matrix.
  if (/\b(?:anything(?:\s+(?:is|would be))?\s+(?:fine|okay|ok|good)|anything\s+(?:works|will\s+do)|whatever\s+(?:works|is\s+fine)|no\s+(?:particular|specific)\s+preference|any\s+(?:suitable\s+|available\s+)?(?:movie|film)|any\s+option\s+works|show\s+me\s+(?:(?:anything|whatever)(?:\s+(?:available|suitable))?|what\s+is\s+available)|i(?:\s+am|\s+m)?\s+flexible|surprise\s+me|you\s+(?:choose|pick|decide)|your\s+choice)\b|(?:\u0627\u064a|\u0623\u064a)\s+\u0634\u064a(?:\u0621|\u0626)(?:\s+\u0645\u0646\u0627\u0633\u0628)?|(?:\u0627\u064a|\u0623\u064a)\s+\u0641\u064a\u0644\u0645|\u0639\u0644\u0649\s+\u0630\u0648\u0642\u0643|\u0627\u062e\u062a\u0627\u0631\s+(?:\u0627\u0646\u062a|\u0623\u0646\u062a)|\u0641\u0627\u062c\u0626\u0646\u064a/iu.test(text)) return true;
  return /^(?:(?:yes|okay|ok|sure|please)\s+)?(?:anything(?:\s+(?:is|would be))?\s+(?:fine|okay|ok|good)|anything\s+(?:works|will\s+do|goes|available|suitable)|(?:i\s+m\s+)?(?:fine|okay|ok)\s+with\s+anything|whatever(?:\s+(?:is|you have|s available|you recommend))?(?:\s+(?:fine|works))?|no\s+(?:other\s+|particular\s+|specific\s+)?preference|i\s+(?:do not|don t)\s+(?:mind|have\s+a\s+preference)|you\s+(?:choose|pick|decide)|your\s+choice|surprise\s+me|any\s+(?:suitable\s+|available\s+)?(?:movie|film)(?:\s+is\s+fine)?|show\s+me\s+(?:anything|whatever)(?:\s+(?:available|suitable))?|(?:اي|أي)\s+شي(?:ء|ئ)(?:\s+مناسب)?|(?:اي|أي)\s+فيلم|ما\s+عندي\s+تفضيل|(?:لا|ما)\s+فرق|على\s+ذوقك|اختار\s+(?:انت|أنت)|فاجئني)$/iu.test(text);
}

const OPEN_CHOICE_NO_RESULT_CLEARS = Object.freeze({
  no_language_match: ["language"],
  no_genre_match: ["genre"],
  no_experience_match: ["experience"],
  no_audience_match: ["audience"],
  no_suitable_time: ["preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand"],
  movie_unavailable_for_criteria: ["movieId", "movieTitle"],
});

/**
 * Interpret an open-choice reply against the immediately visible empty result.
 * The same reply keeps existing filters when a visible empty result has not
 * proved that one or more optional criteria are incompatible.
 */
export function contextualOpenChoicePreferenceClears({ input, noResultsReason, preferences = {} } = {}) {
  if (!isOpenDiscoveryChoiceReply(input)) return [];
  const candidates = OPEN_CHOICE_NO_RESULT_CLEARS[noResultsReason] || [];
  return candidates.filter((key) => preferences?.[key] != null);
}

export function createDiscoveryPreferences(seed = {}) {
  const preferences = { ...EMPTY_DISCOVERY_PREFERENCES };
  for (const key of DISCOVERY_PREFERENCE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(seed || {}, key)) continue;
    const value = seed[key];
    preferences[key] = typeof value === "string" ? value.trim() || null : value ?? null;
  }
  return preferences;
}

/**
 * Extract only criteria explicitly present in this turn. Omitted keys are not
 * cleared, which lets the caller retain preferences across text and voice.
 */
export function extractDiscoveryPreferencePatch(input, {
  cinemas = [],
  movies = [],
  knownGenres = [],
  knownLanguages = [],
  knownExperiences = [],
  expectingTime = false,
  now = new Date(),
  timeZone = "Asia/Dubai",
} = {}) {
  const discoveryInput = stripLanguageControlCommand(input);
  const text = normalizeText(discoveryInput);
  const patch = {};
  const clear = explicitClears(text);
  const filterClearRequest = /\b(?:remove|clear|drop|reset)\b.*\b(?:filters?|preferences?)\b|(?:\u0627\u0645\u0633\u062d|\u0627\u062d\u0630\u0641|\u0627\u0644\u063a|\u0623\u0644\u063a\u064a).*(?:\u0627\u0644\u0641\u0644\u0627\u062a\u0631|\u0627\u0644\u0645\u0631\u0634\u062d\u0627\u062a|\u0627\u0644\u062a\u0641\u0636\u064a\u0644\u0627\u062a)/u.test(text);
  const replacementIntent = isExplicitContentReplacement(text) ? "content" : null;
  if (!text) return { patch, clear: [...clear], provided: [], hasDiscoverySignal: false, replacementIntent };

  const openChoice = filterClearRequest || isOpenDiscoveryChoiceReply(discoveryInput);
  if (openChoice) {
    patch.openChoice = true;
    clear.add("recommendationIntent");
  }

  const cinema = resolveCinemaCandidate(cinemas, discoveryInput);
  if (cinema) {
    patch.cinemaId = String(cinema.id ?? cinema.ID ?? "").trim() || null;
    patch.cinemaName = String(cinema.name ?? cinema.Name ?? "").trim() || null;
    const mappedCity = cinema.city || cinema.City || CINEMA_CITY_BY_ID[patch.cinemaId];
    if (mappedCity) patch.city = String(mappedCity);
  } else {
    const city = findAliasValue(text, CITY_ALIASES);
    if (city) {
      patch.city = city;
      clear.add("cinemaId");
      clear.add("cinemaName");
    }
  }

  const dateResult = canonicalDateSignal(discoveryInput, { now, timeZone });
  if (dateResult) Object.assign(patch, dateResult);

  const timeBand = timeBandFromText(text);
  const timeRange = timeRangeFromText(text, timeBand) || directionalTimeRangeFromText(text, timeBand);
  const preferredTime = timeRange ? null : preferredTimeFromText(text, timeBand, { expectingTime });
  if (timeRange) {
    patch.timeRangeStart = timeRange.start;
    patch.timeRangeEnd = timeRange.end;
    patch.timeRangeStrict = Boolean(timeRange.strict);
    clear.add("preferredTime");
    clear.add("timeBand");
  } else if (preferredTime) {
    patch.preferredTime = preferredTime;
    clear.add("timeRangeStart");
    clear.add("timeRangeEnd");
    clear.add("timeRangeStrict");
    clear.add("timeBand");
  } else if (timeBand) {
    patch.timeBand = timeBand;
    clear.add("preferredTime");
    clear.add("timeRangeStart");
    clear.add("timeRangeEnd");
    clear.add("timeRangeStrict");
  }

  // A cinema name can share distinctive words with a film title. Once the
  // cinema has been grounded, do not let that same phrase create a second,
  // unrelated movie constraint when cinema-specific results are reparsed.
  const movie = findMovieInText(withoutResolvedCinemaPhrase(text, cinema), movies);
  if (movie) {
    patch.movieId = movieIdentity(movie) || null;
    patch.movieTitle = movieTitle(movie) || null;
  }
  const matchedTitle = movie ? normalizeText(movieTitle(movie)) : "";
  const facetText = matchedTitle
    ? ` ${text} `.replace(` ${matchedTitle} `, " ").replace(/\s+/g, " ").trim()
    : text;

  const catalogGenres = (movies || []).flatMap((item) => item?.genres || item?.Genres || [item?.genre || item?.Genre]).filter(Boolean);
  const genre = findAliasValue(facetText, [
    ...dynamicAliasGroups(knownGenres),
    ...dynamicAliasGroups(catalogGenres),
    ...GENRE_ALIASES,
  ]);
  if (genre) patch.genre = genre;

  const catalogLanguages = (movies || []).flatMap((item) => item?.languages || item?.Languages || [item?.languageName, item?.language]).filter(Boolean);
  const language = findAliasValue(facetText, [
    ...dynamicAliasGroups(knownLanguages),
    ...dynamicAliasGroups(catalogLanguages),
    ...LANGUAGE_ALIASES,
  ]);
  if (language) patch.language = language;

  // Afghan and Afghani describe a nationality, not a supported VOX catalog
  // language. Preserve the criterion as a structured clarification signal and
  // prevent it from being guessed as a movie title.
  if (UNSUPPORTED_AFGHAN_LANGUAGE.test(facetText)) {
    delete patch.language;
    clear.add("language");
    patch.recommendationIntent = "unsupported_language_afghan";
  }

  const kidsFamilyRequest = /\b(?:kids?|children|childrens|family|families|family friendly)\b|أطفال|اطفال|عائلي|عائلية|العائلي|العائلية|العائلة/.test(facetText);
  const explicitKidsExperience = /\b(?:kids?\s+(?:cinema|experience|format)|in\s+kids|kids?\s+(?:at|showtime))\b|(?:سينما|تجربة|صيغة)\s+(?:الأطفال|الاطفال)/.test(facetText);
  const catalogExperiences = (movies || []).flatMap((item) => item?.experiences || item?.Experiences || []).filter(Boolean);
  const experience = findAliasValue(facetText, [
    ...dynamicAliasGroups(knownExperiences),
    ...dynamicAliasGroups(catalogExperiences),
    ...EXPERIENCE_ALIASES,
  ]);
  if (experience && !(normalizeKey(experience) === "kids" && kidsFamilyRequest && !explicitKidsExperience)) {
    patch.experience = experience;
  }

  if (kidsFamilyRequest) {
    patch.audience = "kids_family";
    // "Family movies" is an audience request, not a demand that the source
    // catalog use the literal Family genre (many suitable titles use Animation).
    if (patch.genre === "Family") delete patch.genre;
  }

  const educationalRequest = /\b(?:educational|educative|learning focused|informative for (?:kids?|children|families))\b|تعليمي|تثقيفي/.test(facetText);
  if (educationalRequest && !patch.recommendationIntent) patch.recommendationIntent = "educational";

  // Genre and audience are two ways guests narrow the same content choice.
  // A later turn that supplies only one replaces the stale value from the
  // other dimension ("family movies" -> "action movies"), instead of
  // accidentally requiring an often-empty intersection. If both are stated
  // together ("family action movies"), both remain explicit constraints.
  if (patch.genre && !patch.audience) clear.add("audience");
  if (patch.audience && !patch.genre) clear.add("genre");

  if ((patch.genre || patch.audience) && !patch.movieId && !patch.movieTitle) {
    clear.add("movieId");
    clear.add("movieTitle");
  }

  const suppliedNarrowingPreference = Boolean(
    patch.movieId || patch.movieTitle || patch.preferredTime || patch.timeRangeStart || patch.timeRangeEnd || patch.timeBand
    || patch.genre || patch.language || patch.experience || patch.audience
  );
  if (suppliedNarrowingPreference && !openChoice) clear.add("openChoice");
  if (patch.genre || patch.language) clear.add("recommendationIntent");

  for (const key of Object.keys(patch)) clear.delete(key);
  const provided = [...new Set([...Object.keys(patch), ...clear])].sort();
  return {
    patch,
    clear: [...clear].sort(),
    provided,
    hasDiscoverySignal: provided.length > 0,
    replacementIntent,
  };
}

const DISCOVERY_ACTION_PATTERN = /\b(?:book|booking|i want|i need|show me|find me|find|suggest|recommend|watch|see|playing|showing|available|prefer|instead|change|switch|make that)\b|(?:أريد|اريد|أحتاج|احتاج|احجز|حجز|اعرض|ابحث|اقترح|رشح|أشاهد|اشاهد|يعرض|متاح|أفضّل|افضل|بدلاً|بدلا|غيّر|غير)/iu;
const INFORMATION_QUESTION_PATTERN = /^\s*(?:what\s+(?:is|are|does|do|can)|is|are|does|do|can|could|would|how|where|why|when|tell me|explain|ما|هل|كيف|أين|اين|متى|اشرح|أخبرني)/iu;
const INFORMATION_TOPIC_PATTERN = /\b(?:accessible|accessibility|wheelchair|parking|park|food|snacks?|menu|policy|refund|age limit|rating|facilit(?:y|ies)|opening hours?|close|closing|open|loyalty|gift card|prayer room|toilet|restroom)\b|(?:ذوي الإعاقة|كرسي متحرك|مواقف|طعام|وجبات|سياسة|استرداد|تصنيف عمري|مرافق|ساعات العمل|يفتح|يغلق|ولاء|بطاقة هدايا|دورة مياه)/iu;

const GENERIC_DISCOVERY_TITLE_RESIDUAL = /^(?:(?:what(?:\s+(?:is|are|s))?|what\s+(?:movies?|films?)|which\s+(?:movies?|films?)|movies?|films?)\s+)?(?:(?:is|are)\s+)?(?:now\s+)?(?:playing|showing|available|on)(?:\s+now)?$/iu;

/**
 * Decide whether a transcript is a booking-filter turn rather than an FAQ.
 * Criteria words inside policy/accessibility questions must not mutate an
 * active journey (for example, "Is IMAX wheelchair accessible?").
 */
export function shouldTreatAsDiscoveryFilterTurn(input, {
  view = "empty",
  missing = [],
  signal = null,
} = {}) {
  const value = String(input || "").trim();
  if (!value) return false;
  const parsed = signal || { patch: {}, clear: [], hasDiscoverySignal: false };
  const explicitAction = DISCOVERY_ACTION_PATTERN.test(value);
  const informational = INFORMATION_QUESTION_PATTERN.test(value) || INFORMATION_TOPIC_PATTERN.test(value);
  const genericDiscovery = /\b(?:movies?|films?|showtimes?|cinemas?)\b|(?:أفلام|افلام|فيلم|مواعيد عرض|سينما)/iu.test(value);
  const hasSignal = Boolean(parsed.hasDiscoverySignal || genericDiscovery);
  if (!hasSignal) return false;
  if (informational && !explicitAction) return false;
  if (explicitAction) return true;

  const activeDiscovery = ["discovery", "cinemas", "movies", "showtimes", "seatmap", "checkout"].includes(view);
  if (!activeDiscovery) return false;
  const fields = new Set(Array.isArray(missing) ? missing : []);
  const patch = parsed.patch || {};
  const satisfiesMissing = (fields.has("cinema") && (patch.cinemaId || patch.cinemaName || patch.city))
    || (fields.has("date") && patch.date)
    || (fields.has("preference") && (patch.movieTitle || patch.genre || patch.language || patch.experience || patch.audience || patch.preferredTime || patch.timeRangeStart || patch.timeRangeEnd || patch.timeBand))
    || (fields.has("time") && (patch.preferredTime || (patch.timeRangeStart && patch.timeRangeEnd) || patch.timeBand));
  return Boolean(parsed.hasDiscoverySignal || satisfiesMissing);
}

/**
 * Returns a likely unrecognised title fragment only when the guest appears to
 * name a film. Broad requests such as "watch a comedy" or "watch a movie
 * tomorrow" deliberately return null so they can continue as normal filters.
 */
export function unresolvedMovieTitleCandidate(input, signal = {}) {
  const value = stripLanguageControlCommand(input);
  const patch = signal.patch || {};
  const clear = new Set(signal.clear || []);
  if (!value || patch.movieTitle || patch.movieId || patch.openChoice === true || patch.recommendationIntent || clear.has("movieTitle") || clear.has("movieId")) return null;
  if (/^\s*(?:ما|ماذا|أي|اي)\s+(?:(?:هي|هو)\s+)?(?:الأفلام|الافلام|أفلام|افلام)(?:\s|$)/iu.test(value)) return null;
  if (/^(?:أريد|اريد)\s+فيلم(?:ا[\u064b-\u065f]*)?\s+(?:في|حوالي)(?:\s|$)/iu.test(value)) return null;

  const direct = value.match(/\b(?:movie|film)\s+(?:called|named)\s+(.+)/iu)
    || value.match(/\b(?:watch|see)\s+(.+)/iu)
    || value.match(/\b(?:suggest|recommend)(?:\s+me)?\s+(.+)/iu)
    || value.match(/\b(?:tickets?\s+for|book(?:\s+me)?|show\s+me|i\s+(?:want|need))\s+(.+)/iu)
    || value.match(/(?:فيلم\s+(?:اسمه|يدعى)|أشاهد|اشاهد|(?:أريد|اريد)\s+فيلم(?:ا[\u064b-\u065f]*)?|(?:اقترح|رشح)(?:\s+لي)?)\s+(.+)/iu);
  let candidateSource = direct?.[1] || "";
  if (candidateSource && direct) {
    candidateSource = candidateSource.replace(/^\s*to\s+go(?:\s+for)?\s+/iu, "");
    candidateSource = /^(?:at|in|on|في|حوالي)(?:\s|$)/iu.test(candidateSource.trim())
      ? ""
      : candidateSource.split(/\b(?:at|in|on|tomorrow|today|tonight|around|near|after|before|with)\b|(?:\sفي\s|\sغدا|\sغداً|\sاليوم|\sالليلة|\sحوالي|\sبعد|\sقبل|\sمع)/iu)[0].trim();
  }
  if (!candidateSource && (patch.cinemaId || patch.cinemaName || patch.city || patch.date)) {
    candidateSource = value;
  }
  if (!candidateSource) return null;

  const escapePattern = (item) => String(item || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const removePhrase = (source, phrase) => phrase
    ? source.replace(new RegExp(`\\b${escapePattern(phrase)}\\b`, "giu"), " ")
    : source;
  for (const knownLocation of [patch.cinemaName, patch.city]) {
    if (!knownLocation) continue;
    const withoutBrand = String(knownLocation).replace(/^\s*VOX\s*[\u2014\u2013-]?\s*/iu, "");
    candidateSource = removePhrase(candidateSource, knownLocation);
    candidateSource = removePhrase(candidateSource, withoutBrand);
  }
  for (const alias of CINEMA_ALIASES[String(patch.cinemaId || "")] || []) {
    candidateSource = removePhrase(candidateSource, alias);
  }
  const removeCanonicalAliases = (source, canonical, groups) => {
    if (!canonical) return source;
    let next = removePhrase(source, canonical);
    const group = groups.find(([name]) => normalizeKey(name) === normalizeKey(canonical));
    for (const alias of group?.[1] || []) next = removePhrase(next, alias);
    return next;
  };
  candidateSource = removeCanonicalAliases(candidateSource, patch.genre, GENRE_ALIASES);
  candidateSource = removeCanonicalAliases(candidateSource, patch.language, LANGUAGE_ALIASES);
  candidateSource = removeCanonicalAliases(candidateSource, patch.experience, EXPERIENCE_ALIASES);
  if (patch.audience === "kids_family") candidateSource = candidateSource.replace(/\b(?:kids?|children|childrens|family|families|family friendly)\b|(?:أطفال|اطفال|عائلي|عائلية|العائلي|العائلية|العائلة)/giu, " ");
  candidateSource = candidateSource
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b(?:today|tomorrow|tonight|day after tomorrow|morning|afternoon|evening|late at night)\b|(?:اليوم|غدا|غداً|الليلة|بعد غد|صباح|بعد الظهر|مساء)/giu, " ")
    .replace(/\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?|\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/giu, " ")
    .replace(/\b(?:at|in|on|around|near|after|before|with|for|please|suggest|recommend|movie|film|cinema|showtime)\b|(?:(?:أريد|اريد|أحتاج|احتاج|اعرض|اقترح|رشح)|فيلم(?:ا[\u064b-\u065f]*)?|في|حوالي|بعد|قبل|مع|سينما|موعد عرض|الساعة|من فضلك)/giu, " ")
    .replace(/^\s*(?:to\s+)?(?:a|an|the)\s+/iu, "")
    .replace(/^\s*(?:a|an|the)\s+/iu, "")
    .replace(/\s+(?:movies?|films?)\s*$/iu, "")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
  const candidate = candidateSource;
  if (!candidate) return null;
  const normalized = normalizeText(candidate);
  if (GENERIC_DISCOVERY_TITLE_RESIDUAL.test(normalized)) return null;
  if (!normalized || /^(?:a|an|the|this|that|movies?|films?|showtimes?|options?|choices?|something|anything|one|tickets?|seats?|instead|only|أفلام|افلام|فيلم|خيارات|شيء|أي شيء|تذاكر|مقاعد|بدلا|بدلاً|فقط)$/iu.test(normalized)) return null;
  if (/\b(?:tickets?|seats?)\b|(?:تذاكر|مقاعد)/iu.test(normalized)) return null;
  return candidate;
}

/**
 * Reuses the established fuzzy film resolver after the real cinema/date
 * catalog is available, while rejecting tied or weak fuzzy guesses.
 */
export function resolveDiscoveryMovieCandidate(movies, candidate) {
  const list = uniqueMovieCatalog(movies);
  const query = normalizeText(candidate);
  if (!query) return null;
  const exact = list.filter((movie) => normalizeText(movieTitle(movie)) === query);
  if (exact.length === 1) return exact[0];
  const partial = list.filter((movie) => {
    const title = normalizeText(movieTitle(movie));
    if (!title || query.length < 4) return false;
    return phraseInText(title, query);
  });
  if (partial.length === 1) return partial[0];
  const resolved = resolveFilmCandidate(list, candidate);
  if (!resolved) return null;

  const queryTokens = query.split(/\s+/).filter((token) => token && !["a", "an", "the", "film", "movie", "please", "show", "watch"].includes(token));
  if (!queryTokens.length) return null;
  const scored = list.map((movie) => {
    const title = normalizeText(movieTitle(movie));
    const titleTokens = new Set(title.split(/\s+/).filter(Boolean));
    const matches = queryTokens.filter((token) => titleTokens.has(token)).length;
    const exactPhrase = phraseInText(title, query) || phraseInText(query, title);
    return { movie, exactPhrase, score: matches / queryTokens.length, matches };
  }).filter((item) => item.exactPhrase || item.score >= 0.5);
  const resolvedItem = scored.find((item) => movieIdentity(item.movie) === movieIdentity(resolved));
  if (!resolvedItem) return null;
  if (resolvedItem.exactPhrase) {
    const exactMatches = scored.filter((item) => item.exactPhrase);
    return exactMatches.length === 1 ? resolved : null;
  }
  const bestScore = Math.max(...scored.map((item) => item.score));
  const best = scored.filter((item) => item.score === bestScore);
  return resolvedItem.score === bestScore && best.length === 1 ? resolved : null;
}

/**
 * Keeps common same-script matching synchronous and loads the bilingual
 * resolver only when the fast path cannot identify a catalog movie.
 */
export async function resolveBilingualDiscoveryMovieCandidate(movies, candidate) {
  const sameScript = resolveDiscoveryMovieCandidate(movies, candidate);
  if (sameScript) return sameScript;
  const list = uniqueMovieCatalog(movies);
  if (!list.length) return null;
  const { resolveCrossScriptMovieCandidate } = await import("./crossScriptMovieTitles.js");
  return resolveCrossScriptMovieCandidate(list, candidate, movieTitle);
}

/** Clear first, then apply this turn's explicit values; a supplied value wins. */
export function mergeDiscoveryPreferences(current, update = {}) {
  const previous = createDiscoveryPreferences(current);
  const patch = update?.patch && typeof update.patch === "object" ? update.patch : update;
  const clear = Array.isArray(update?.clear) ? update.clear : [];
  const next = { ...previous };

  for (const key of clear) {
    if (PREFERENCE_KEY_SET.has(key)) next[key] = null;
  }
  for (const [key, rawValue] of Object.entries(patch || {})) {
    if (!PREFERENCE_KEY_SET.has(key)) continue;
    next[key] = typeof rawValue === "string" ? rawValue.trim() || null : rawValue ?? null;
  }

  const changedKeys = DISCOVERY_PREFERENCE_KEYS.filter((key) => previous[key] !== next[key]);
  const clearedKeys = changedKeys.filter((key) => previous[key] != null && next[key] == null);
  const resultKeys = new Set(changedKeys.filter((key) => key !== "dateSignal"));
  const movieSelectionKeys = new Set(["cinemaId", "cinemaName", "city", "date", "genre", "language", "experience", "movieId", "movieTitle", "audience", "openChoice", "recommendationIntent"]);
  const sessionSelectionKeys = new Set([...movieSelectionKeys, "preferredTime", "timeRangeStart", "timeRangeEnd", "timeRangeStrict", "timeBand"]);
  const intersects = (keys) => [...resultKeys].some((key) => keys.has(key));

  return {
    preferences: next,
    changedKeys,
    clearedKeys,
    invalidates: {
      movieResults: resultKeys.size > 0,
      movieSelection: intersects(movieSelectionKeys),
      sessionResults: resultKeys.size > 0,
      sessionSelection: intersects(sessionSelectionKeys),
      seatSelection: intersects(sessionSelectionKeys),
      pricing: intersects(sessionSelectionKeys),
    },
  };
}

export function parseAndMergeDiscoveryPreferences(current, input, options = {}) {
  const update = extractDiscoveryPreferencePatch(input, options);
  return { ...mergeDiscoveryPreferences(current, update), update };
}

function fieldIsPresent(preferences, field) {
  if (field === "cinema") return Boolean(preferences.cinemaId || preferences.cinemaName);
  if (field === "location") return Boolean(preferences.cinemaId || preferences.cinemaName || preferences.city);
  if (field === "time") return Boolean(preferences.preferredTime || (preferences.timeRangeStart && preferences.timeRangeEnd) || preferences.timeBand);
  if (field === "movie") return Boolean(preferences.movieId || preferences.movieTitle);
  if (field === "movieOrPreference") {
    return Boolean(preferences.movieId || preferences.movieTitle || preferences.genre || preferences.language || preferences.experience || preferences.audience || preferences.openChoice || preferences.recommendationIntent);
  }
  return Boolean(preferences[field]);
}

/** Returns only caller-declared requirements that the guest has not supplied. */
export function getMissingDiscoveryCriteria(preferences, required = ["location", "date"]) {
  const current = createDiscoveryPreferences(preferences);
  return [...new Set(required)].filter((field) => !fieldIsPresent(current, field));
}

function splitValues(value) {
  const input = Array.isArray(value) ? value : [value];
  return input
    .flatMap((item) => String(item ?? "").split(/[,/|]+/))
    .map(normalizeKey)
    .filter(Boolean);
}

function movieGenres(movie) {
  return splitValues(movie?.genres ?? movie?.Genres ?? movie?.genre ?? movie?.Genre);
}

function movieLanguages(movie) {
  return splitValues(movie?.languages ?? movie?.Languages ?? [movie?.languageName, movie?.LanguageName, movie?.language, movie?.Language]);
}

function movieExperiences(movie) {
  return splitValues(movie?.experiences ?? movie?.Experiences ?? movie?.experience ?? movie?.Experience);
}

function sessionMovieId(session) {
  return String(session?.scheduledFilmId ?? session?.ScheduledFilmId ?? session?.movieId ?? session?.code ?? "").trim();
}

function sessionCinemaId(session) {
  return String(session?.cinemaId ?? session?.CinemaId ?? session?.cinemaCode ?? session?.CinemaCode ?? "").trim();
}

function sessionDate(session) {
  return String(session?.programmingDate ?? session?.ProgrammingDate ?? session?.date ?? session?.Date ?? session?.showtimeAt ?? session?.showtime ?? session?.Showtime ?? "").slice(0, 10);
}

function sessionTime(session) {
  const direct = String(session?.time ?? session?.Time ?? "").match(/\b([0-2]\d):([0-5]\d)\b/);
  if (direct) return `${direct[1]}:${direct[2]}`;
  const source = String(session?.showtimeAt ?? session?.showtime ?? session?.Showtime ?? "");
  const match = source.match(/T([0-2]\d):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function sessionExperience(session) {
  return splitValues(session?.exp ?? session?.experience ?? session?.Experience ?? session?.experienceCode ?? session?.ExperienceCode ?? session?.sessionAttributesNames ?? session?.SessionAttributesNames);
}

function cinemaIdentity(cinema) {
  return String(cinema?.id ?? cinema?.ID ?? cinema?.code ?? "").trim();
}

function cityForCinemaId(cinemaId, cinemas) {
  const cinema = (cinemas || []).find((item) => cinemaIdentity(item) === String(cinemaId || ""));
  const direct = cinema?.city ?? cinema?.City;
  if (direct) return String(direct);
  return CINEMA_CITY_BY_ID[String(cinemaId || "")] || null;
}

function valuesMatch(values, requested) {
  const canonical = (value) => {
    const normalized = normalizeKey(value);
    if (["sci fi", "scifi", "science fiction"].includes(normalized)) return "science fiction";
    return normalized === "2d" ? "standard" : normalized;
  };
  const wanted = canonical(requested);
  if (!wanted) return true;
  return values.some((value) => {
    const canonicalValue = canonical(value);
    return canonicalValue === wanted
      || ` ${canonicalValue} `.includes(` ${wanted} `)
      || ` ${wanted} `.includes(` ${canonicalValue} `);
  });
}

function kidsFamilyMovie(movie) {
  const rating = String(movie?.rating ?? movie?.Rating ?? movie?.movieRating ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/PLUS/g, "+");
  // KIDS is an auditorium experience, not an age certificate. A restricted
  // certificate can never become a family recommendation because of a KIDS
  // session or a loose metadata tag. PG15 also carries a content-suitability
  // warning, so generic kids/family discovery is limited to G, PG, and PG13.
  if (rating && !["G", "PG", "PG13"].includes(rating)) return false;
  const genres = movieGenres(movie);
  const tags = splitValues([movie?.audience, movie?.audiences, movie?.categories, movie?.Category]);
  return genres.some((genre) => ["family", "animation", "children", "kids"].includes(genre))
    || tags.some((tag) => /\b(?:family|children|kids)\b/.test(tag))
    || movieExperiences(movie).includes("kids");
}

function movieMatchesSpecific(movie, preferences) {
  if (preferences.movieId && movieIdentity(movie) !== String(preferences.movieId)) return false;
  if (!preferences.movieTitle) return true;
  const title = normalizeKey(movieTitle(movie));
  const wanted = normalizeKey(preferences.movieTitle);
  return title === wanted || phraseInText(title, wanted) || phraseInText(wanted, title);
}

function movieMatchesMetadata(movie, preferences, kidsSessionMovieIds, cinemas, { ignoreExperience = false } = {}) {
  if (!movieMatchesSpecific(movie, preferences)) return false;
  const directCinemaId = sessionCinemaId(movie);
  const directDate = sessionDate(movie);
  const directCity = movie?.city ?? movie?.City ?? (directCinemaId ? cityForCinemaId(directCinemaId, cinemas) : null);
  if (preferences.cinemaId && directCinemaId && directCinemaId !== String(preferences.cinemaId)) return false;
  if (preferences.city && directCity && normalizeKey(directCity) !== normalizeKey(preferences.city)) return false;
  if (preferences.date && directDate && directDate !== preferences.date) return false;
  if (preferences.genre && !valuesMatch(movieGenres(movie), preferences.genre)) return false;
  if (preferences.language && !valuesMatch(movieLanguages(movie), preferences.language)) return false;
  if (preferences.audience === "kids_family") {
    const rating = String(movie?.rating ?? movie?.Rating ?? movie?.movieRating ?? "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/PLUS/g, "+");
    if (rating && !["G", "PG", "PG13"].includes(rating)) return false;
    if (!kidsFamilyMovie(movie) && !kidsSessionMovieIds.has(movieIdentity(movie))) return false;
  }
  if (!ignoreExperience && preferences.experience && movieExperiences(movie).length && !valuesMatch(movieExperiences(movie), preferences.experience)) return false;
  return true;
}

function toMinutes(time, programmingDayCutoffHour = 6) {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute + (hour < programmingDayCutoffHour ? 1440 : 0);
}

function sessionStableId(session) {
  return String(session?.sessionId ?? session?.SessionId ?? session?.id ?? "");
}

function sortChronologically(sessions, cutoff) {
  return [...sessions].sort((left, right) => {
    const timeDifference = (toMinutes(sessionTime(left), cutoff) ?? Infinity) - (toMinutes(sessionTime(right), cutoff) ?? Infinity);
    return timeDifference || sessionStableId(left).localeCompare(sessionStableId(right));
  });
}

/**
 * Applies every supplied criterion. If a requested minute is unavailable,
 * sessions are ranked by distance and the closest suitable options are
 * returned with explicit fallback metadata.
 */
export function filterDiscoveryResults({
  movies = [],
  sessions = null,
  cinemas = [],
  preferences = EMPTY_DISCOVERY_PREFERENCES,
  timeToleranceMinutes = 60,
  nearestLimit = 3,
  maxFallbackMinutes = Infinity,
  programmingDayCutoffHour = 6,
} = {}) {
  const criteria = createDiscoveryPreferences(preferences);
  const movieList = Array.isArray(movies) ? movies : [];
  const cinemaList = Array.isArray(cinemas) ? cinemas : [];
  const filteredCinemas = cinemaList.filter((cinema) => {
    const id = cinemaIdentity(cinema);
    if (criteria.cinemaId && id !== String(criteria.cinemaId)) return false;
    if (criteria.cinemaName && !criteria.cinemaId && normalizeKey(cinema?.name ?? cinema?.Name) !== normalizeKey(criteria.cinemaName)) return false;
    if (criteria.city && normalizeKey(cityForCinemaId(id, cinemaList)) !== normalizeKey(criteria.city)) return false;
    return true;
  });
  const hasSessionCatalog = Array.isArray(sessions);
  const sessionList = hasSessionCatalog ? sessions : [];
  const kidsSessionMovieIds = new Set(sessionList
    .filter((session) => {
      const cinemaId = sessionCinemaId(session);
      if (criteria.cinemaId && cinemaId !== String(criteria.cinemaId)) return false;
      if (criteria.cinemaName && !criteria.cinemaId) {
        const cinema = cinemaList.find((item) => cinemaIdentity(item) === cinemaId);
        if (!cinema || normalizeKey(cinema.name ?? cinema.Name) !== normalizeKey(criteria.cinemaName)) return false;
      }
      if (criteria.city && normalizeKey(cityForCinemaId(cinemaId, cinemaList)) !== normalizeKey(criteria.city)) return false;
      if (criteria.date && sessionDate(session) !== criteria.date) return false;
      return true;
    })
    .filter((session) => valuesMatch(sessionExperience(session), "KIDS"))
    .map(sessionMovieId)
    .filter(Boolean));
  const moviesById = new Map(movieList.map((movie) => [movieIdentity(movie), movie]));

  const metadataMovies = movieList.filter((movie) => movieMatchesMetadata(
    movie,
    criteria,
    kidsSessionMovieIds,
    cinemas,
    { ignoreExperience: hasSessionCatalog },
  ));
  const allowedMovieIds = new Set(metadataMovies.map(movieIdentity).filter(Boolean));
  let baseSessions = sessionList.filter((session) => {
    const cinemaId = sessionCinemaId(session);
    if (criteria.cinemaId && cinemaId !== String(criteria.cinemaId)) return false;
    if (criteria.cinemaName && !criteria.cinemaId) {
      const cinema = (cinemas || []).find((item) => cinemaIdentity(item) === cinemaId);
      if (!cinema || normalizeKey(cinema.name ?? cinema.Name) !== normalizeKey(criteria.cinemaName)) return false;
    }
    if (criteria.city && normalizeKey(cityForCinemaId(cinemaId, cinemas)) !== normalizeKey(criteria.city)) return false;
    if (criteria.date && sessionDate(session) !== criteria.date) return false;
    if (criteria.experience && !valuesMatch(sessionExperience(session), criteria.experience)) return false;

    const filmId = sessionMovieId(session);
    const associatedMovie = moviesById.get(filmId);
    if (associatedMovie && !allowedMovieIds.has(filmId)) return false;
    if (!associatedMovie && (criteria.movieId || criteria.movieTitle || criteria.genre || criteria.language || criteria.audience)) {
      if (!movieMatchesMetadata(session, criteria, kidsSessionMovieIds, cinemas)) return false;
    }
    return true;
  });

  const sessionsBeforeTimeBand = baseSessions.length;
  if (criteria.timeBand && TIME_BANDS[criteria.timeBand]) {
    const [start, end] = TIME_BANDS[criteria.timeBand];
    baseSessions = baseSessions.filter((session) => {
      const minutes = toMinutes(sessionTime(session), programmingDayCutoffHour);
      return minutes != null && minutes >= start && minutes < end;
    });
  }

  const hasTimeRange = Boolean(criteria.timeRangeStart && criteria.timeRangeEnd);
  const requestedTimeLabel = hasTimeRange
    ? `${criteria.timeRangeStart} to ${criteria.timeRangeEnd}`
    : criteria.preferredTime || criteria.timeBand;
  const timeMetadata = {
    requested: Boolean(criteria.preferredTime || hasTimeRange || criteria.timeBand),
    requestedTime: requestedTimeLabel,
    requestedRange: hasTimeRange,
    rangeStart: hasTimeRange ? criteria.timeRangeStart : null,
    rangeEnd: hasTimeRange ? criteria.timeRangeEnd : null,
    rangeSessionCount: 0,
    exactTimeMatch: false,
    exactSessionCount: 0,
    usedNearestFallback: false,
    matchKind: criteria.timeBand
      ? (baseSessions.length ? "band" : "unavailable")
      : criteria.preferredTime || hasTimeRange ? "unavailable" : "not_requested",
    closestDeltaMinutes: null,
    toleranceMinutes: timeToleranceMinutes,
    closestTimes: [],
  };

  let filteredSessions = sortChronologically(baseSessions, programmingDayCutoffHour);
  if (hasTimeRange && baseSessions.length) {
    const rangeStart = toMinutes(criteria.timeRangeStart, programmingDayCutoffHour);
    let rangeEnd = toMinutes(criteria.timeRangeEnd, programmingDayCutoffHour);
    if (rangeStart != null && rangeEnd != null && rangeEnd < rangeStart) rangeEnd += 1440;
    const ranked = rangeStart == null || rangeEnd == null ? [] : baseSessions
      .map((session) => {
        const minutes = toMinutes(sessionTime(session), programmingDayCutoffHour);
        const delta = minutes == null
          ? Infinity
          : minutes < rangeStart
            ? rangeStart - minutes
            : minutes > rangeEnd
              ? minutes - rangeEnd
              : 0;
        return { session, minutes, delta };
      })
      .filter((item) => Number.isFinite(item.delta))
      .sort((left, right) => left.delta - right.delta
        || left.minutes - right.minutes
        || sessionStableId(left.session).localeCompare(sessionStableId(right.session)));
    const inRange = ranked.filter((item) => item.delta === 0);
    timeMetadata.rangeSessionCount = inRange.length;
    timeMetadata.closestDeltaMinutes = ranked[0]?.delta ?? null;

    if (inRange.length) {
      filteredSessions = sortChronologically(inRange.map((item) => item.session), programmingDayCutoffHour);
      timeMetadata.matchKind = "range";
    } else if (criteria.timeRangeStrict) {
      filteredSessions = [];
      timeMetadata.usedNearestFallback = false;
      timeMetadata.matchKind = "unavailable";
    } else {
      const withinTolerance = ranked.filter((item) => item.delta <= timeToleranceMinutes);
      const candidates = withinTolerance.length ? withinTolerance : ranked;
      filteredSessions = candidates
        .filter((item) => item.delta <= maxFallbackMinutes)
        .slice(0, Math.max(1, nearestLimit))
        .map((item) => item.session);
      timeMetadata.usedNearestFallback = filteredSessions.length > 0;
      timeMetadata.matchKind = filteredSessions.length ? "nearest" : "unavailable";
    }
    timeMetadata.closestTimes = [...new Set(filteredSessions.map(sessionTime).filter(Boolean))];
  } else if (criteria.preferredTime && baseSessions.length) {
    const requestedMinutes = toMinutes(criteria.preferredTime, programmingDayCutoffHour);
    const ranked = requestedMinutes == null ? [] : baseSessions
      .map((session) => ({
        session,
        delta: Math.abs((toMinutes(sessionTime(session), programmingDayCutoffHour) ?? Infinity) - requestedMinutes),
      }))
      .filter((item) => Number.isFinite(item.delta))
      .sort((left, right) => left.delta - right.delta
        || (toMinutes(sessionTime(left.session), programmingDayCutoffHour) ?? Infinity) - (toMinutes(sessionTime(right.session), programmingDayCutoffHour) ?? Infinity)
        || sessionStableId(left.session).localeCompare(sessionStableId(right.session)));
    const exact = ranked.filter((item) => item.delta === 0);
    timeMetadata.exactTimeMatch = exact.length > 0;
    timeMetadata.exactSessionCount = exact.length;
    timeMetadata.closestDeltaMinutes = ranked[0]?.delta ?? null;

    if (exact.length) {
      const close = ranked
        .filter((item) => item.delta <= timeToleranceMinutes)
        .slice(0, Math.max(exact.length, Math.max(1, nearestLimit)));
      filteredSessions = close.map((item) => item.session);
      timeMetadata.matchKind = "exact";
    } else {
      const withinTolerance = ranked.filter((item) => item.delta <= timeToleranceMinutes);
      const candidates = withinTolerance.length ? withinTolerance : ranked;
      filteredSessions = candidates
        .filter((item) => item.delta <= maxFallbackMinutes)
        .slice(0, Math.max(1, nearestLimit))
        .map((item) => item.session);
      timeMetadata.usedNearestFallback = filteredSessions.length > 0;
      timeMetadata.matchKind = filteredSessions.length ? "nearest" : "unavailable";
    }
    timeMetadata.closestTimes = [...new Set(filteredSessions.map(sessionTime).filter(Boolean))];
  }

  let filteredMovies = metadataMovies;
  if (hasSessionCatalog) {
    const availableMovieIds = new Set(filteredSessions.map(sessionMovieId).filter(Boolean));
    const sessionsHaveMovieIds = sessionList.some((session) => sessionMovieId(session));
    if (sessionsHaveMovieIds || sessionList.length === 0) {
      filteredMovies = metadataMovies.filter((movie) => availableMovieIds.has(movieIdentity(movie)));
    }
  }

  let noResultsReason = null;
  if (!filteredMovies.length && !filteredSessions.length) {
    const suppliedContentCriteria = [criteria.experience, criteria.language, criteria.genre, criteria.audience, criteria.movieId || criteria.movieTitle].filter(Boolean);
    if ((criteria.preferredTime || hasTimeRange) && baseSessions.length) noResultsReason = "no_suitable_time";
    else if (criteria.timeBand && sessionsBeforeTimeBand > 0 && baseSessions.length === 0) noResultsReason = "no_suitable_time";
    else if (suppliedContentCriteria.length > 1) noResultsReason = "no_results_for_criteria";
    else if (criteria.experience) noResultsReason = "no_experience_match";
    else if (criteria.language) noResultsReason = "no_language_match";
    else if (criteria.genre) noResultsReason = "no_genre_match";
    else if (criteria.audience) noResultsReason = "no_audience_match";
    else if (criteria.movieId || criteria.movieTitle) noResultsReason = "movie_unavailable_for_criteria";
    else noResultsReason = "no_results_for_criteria";
  }

  return {
    cinemas: filteredCinemas,
    movies: filteredMovies,
    sessions: filteredSessions,
    preferences: criteria,
    time: timeMetadata,
    counts: {
      inputMovies: movieList.length,
      inputSessions: sessionList.length,
      metadataMatchedMovies: metadataMovies.length,
      sessionsBeforeTimeFilter: sessionsBeforeTimeBand,
      returnedMovies: filteredMovies.length,
      returnedSessions: filteredSessions.length,
    },
    noResultsReason,
  };
}
