import { assessCancellationEligibility } from "./cancellationEligibility.js";
import { CINEMA_ALIASES } from "./cinemaRouting.js";
import { findCrossScriptMovieTitleRange } from "./crossScriptMovieTitles.js";

const DUBAI_DATE_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ARABIC_DIGITS = Object.freeze({
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
});

const SPOKEN_NUMBERS = Object.freeze({
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
});

const ARABIC_SPOKEN_CLOCK_HOURS = new Map([
  ["الواحده", 1],
  ["الاولي", 1],
  ["الثانيه", 2],
  ["الثالثه", 3],
  ["الرابعه", 4],
  ["الخامسه", 5],
  ["السادسه", 6],
  ["السابعه", 7],
  ["الثامنه", 8],
  ["التاسعه", 9],
  ["العاشره", 10],
]);

const MONTHS = new Map([
  ["january", 1], ["jan", 1], ["يناير", 1],
  ["february", 2], ["feb", 2], ["فبراير", 2],
  ["march", 3], ["mar", 3], ["مارس", 3],
  ["april", 4], ["apr", 4], ["ابريل", 4],
  ["may", 5], ["مايو", 5],
  ["june", 6], ["jun", 6], ["يونيو", 6],
  ["july", 7], ["jul", 7], ["يوليو", 7],
  ["august", 8], ["aug", 8], ["اغسطس", 8],
  ["september", 9], ["sep", 9], ["sept", 9], ["سبتمبر", 9],
  ["october", 10], ["oct", 10], ["اكتوبر", 10],
  ["november", 11], ["nov", 11], ["نوفمبر", 11],
  ["december", 12], ["dec", 12], ["ديسمبر", 12],
]);

const WEEKDAYS = new Map([
  ["sunday", 0], ["sun", 0], ["الاحد", 0],
  ["monday", 1], ["mon", 1], ["الاثنين", 1],
  ["tuesday", 2], ["tue", 2], ["الثلاثاء", 2],
  ["wednesday", 3], ["wed", 3], ["الاربعاء", 3],
  ["thursday", 4], ["thu", 4], ["الخميس", 4],
  ["friday", 5], ["fri", 5], ["الجمعه", 5],
  ["saturday", 6], ["sat", 6], ["السبت", 6],
]);

const ORDINALS = Object.freeze({
  first: 1,
  one: 1,
  second: 2,
  two: 2,
  third: 3,
  three: 3,
  fourth: 4,
  four: 4,
  fifth: 5,
  five: 5,
  sixth: 6,
  six: 6,
  seventh: 7,
  seven: 7,
  eighth: 8,
  eight: 8,
  ninth: 9,
  nine: 9,
  tenth: 10,
  ten: 10,
  "الاول": 1,
  "اول": 1,
  "الثاني": 2,
  "ثاني": 2,
  "الثالث": 3,
  "ثالث": 3,
  "الرابع": 4,
  "رابع": 4,
  "الخامس": 5,
  "خامس": 5,
});

const TITLE_STOP_WORDS = new Set([
  "a", "an", "the", "and", "part", "movie", "film",
  "فيلم", "الفيلم", "جزء", "و",
]);

const CINEMA_STOP_WORDS = new Set([
  "vox", "cinema", "cinemas", "uae", "at", "of", "the",
  "فوكس", "سينما", "سينماز", "في", "من", "ال",
]);

const INTENT_WORDS = new Set([
  "cancel", "cancellation", "refund", "void", "please", "booking", "reservation", "ticket", "tickets",
  "select", "choose", "pick", "open", "view", "show",
  "detail", "details",
  "my", "the", "this", "that", "one", "for", "at", "on", "made", "i", "want", "need", "to",
  "it", "current", "active", "upcoming", "selected", "would", "like", "can", "could", "you", "me",
  "id", "its", "d",
  "mean", "meant", "sorry", "actually", "instead",
  "reference", "ref", "movie", "film", "cinema", "location", "showtime", "time", "date",
  "رقم", "مرجع", "المرجع", "فيلم", "الفيلم", "سينما", "السينما", "تاريخ", "وقت", "عرض",
  "الغ", "الغي", "الغاء", "لغ", "الحجز", "حجز", "حجزي", "تذكره", "تذاكر", "من", "في", "هذا", "هذه",
  "اريد", "ابي", "ابغي", "ابغى", "ممكن", "تلغي", "رجع", "استرد", "استرداد", "لو", "سمحت", "من", "فضلك", "الحالي", "القادم",
  "افتح", "فتح", "اختر", "اختار", "اعرض", "اظهر", "شوف", "وريني", "تفاصيل", "التفاصيل",
]);
const TEMPORAL_SELECTOR_WORDS = new Set([
  ...MONTHS.keys(),
  ...WEEKDAYS.keys(),
  ...Object.keys(ORDINALS),
  "today", "tomorrow", "tonight", "day", "after", "morning", "afternoon", "evening", "night",
  "am", "pm", "last", "number",
  "اليوم", "غد", "غدا", "الغد", "بكرا", "باكر", "يوم", "بتاريخ", "الساعه", "ساعه",
  "الليله", "صباح", "ظهر", "مساء", "ليل",
]);
const CONNECTOR_WORDS = new Set([
  "in", "from", "with", "of", "is", "are", "what", "tell", "about", "yes", "yeah", "think", "probably", "maybe",
  "mean", "meant", "sorry", "actually", "instead",
  "نعم", "ايوه", "ايوا", "هو", "هي", "اعتقد", "غالبا", "يمكن", "مع", "عن", "و",
]);

const toAsciiDigits = (value) => String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit);

export const normalizeCancellationText = (value) => toAsciiDigits(value)
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[ً-ٰٟ]/g, "")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ؤ/g, "و")
  .replace(/ئ/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[\u2018\u2019'`]/g, "")
  .replace(/[^\p{L}\p{N}:/#-]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const normalizeSpokenNumbers = (value) => normalizeCancellationText(value)
  .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => SPOKEN_NUMBERS[word] || word);

const normalizedTokens = (value) => normalizeCancellationText(value).split(" ").filter(Boolean);
const referenceKey = (value) => normalizeCancellationText(value).replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
const bookingReference = (booking) => String(booking?.ref || booking?.BookingId || "").trim();
const bookingMovie = (booking) => String(booking?.movieTitle || booking?.movie || booking?.filmTitle || "").trim();
const bookingCinema = (booking) => String(booking?.cinemaName || booking?.cinema || booking?.siteName || "").trim();
const bookingShowtime = (booking) => String(booking?.showtime || booking?.time || "").trim();

function dateKeyFromDate(value) {
  const parts = Object.fromEntries(
    DUBAI_DATE_PARTS.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addCalendarDays(dateKey, count) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + count, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function bookingDateKey(booking) {
  const raw = booking?.performanceDate || booking?.sourceDate || booking?.date || booking?.showtimeAt || booking?.sessionStartAt;
  const direct = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? dateKeyFromDate(parsed) : null;
}

function parseDateCriterion(query, now) {
  const today = dateKeyFromDate(now);
  if (/\bday after tomorrow\b|(?:\u0628\u0639\u062f\s+\u063a\u062f|\u0628\u0639\u062f\s+\u0628\u0643\u0631\u0627)/u.test(query)) {
    return { kind: "exact", key: addCalendarDays(today, 2), source: "relative_date", selectorTokens: ["day", "after", "tomorrow"] };
  }
  if (/\btomorrow(?:s)?\b|(?:\u063a\u062f\u0627?|\u0627\u0644\u063a\u062f|\u0628\u0643\u0631\u0627|\u0628\u0627\u0643\u0631)/u.test(query)) {
    return { kind: "exact", key: addCalendarDays(today, 1), source: "relative_date", selectorTokens: ["tomorrow"] };
  }
  if (/\btoday(?:s)?\b|\btonight(?:s)?\b|(?:\u0627\u0644\u064a\u0648\u0645|\u0627\u0644\u0644\u064a\u0644\u0647)/u.test(query)) {
    return { kind: "exact", key: today, source: "relative_date", selectorTokens: ["today", "tonight"] };
  }

  const iso = query.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    return { kind: "exact", key: `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}-${String(Number(iso[3])).padStart(2, "0")}`, source: "date", selectorTokens: [iso[0]] };
  }

  const numeric = query.match(/\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])(?:[/-](20\d{2}|\d{2}))?\b/);
  if (numeric) {
    const year = numeric[3] ? (numeric[3].length === 2 ? Number(`20${numeric[3]}`) : Number(numeric[3])) : null;
    return { kind: "parts", day: Number(numeric[1]), month: Number(numeric[2]), year, source: "date", selectorTokens: [numeric[0]] };
  }

  const tokens = query.split(" ");
  const monthIndex = tokens.findIndex((token) => MONTHS.has(token));
  if (monthIndex >= 0) {
    const nearby = tokens.slice(Math.max(0, monthIndex - 2), monthIndex + 3);
    const dayToken = nearby.find((token) => /^(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?$/.test(token));
    const yearToken = nearby.find((token) => /^20\d{2}$/.test(token));
    if (dayToken) {
      return {
        kind: "parts",
        day: Number(dayToken.replace(/(?:st|nd|rd|th)$/, "")),
        month: MONTHS.get(tokens[monthIndex]),
        year: yearToken ? Number(yearToken) : null,
        source: "date",
        selectorTokens: [dayToken, tokens[monthIndex], yearToken].filter(Boolean),
      };
    }
  }

  const ordinalDay = query.match(/\b(?:on\s+(?:the\s+)?|for\s+(?:the\s+)?)([12]?\d|3[01])(?:st|nd|rd|th)?\b/)
    || query.match(/\b([12]?\d|3[01])(?:st|nd|rd|th)\b/)
    || query.match(/(?:\u064a\u0648\u0645|\u0628\u062a\u0627\u0631\u064a\u062e|\u062a\u0627\u0631\u064a\u062e)\s+([12]?\d|3[01])\b/u);
  if (ordinalDay) return { kind: "parts", day: Number(ordinalDay[1]), month: null, year: null, source: "date", selectorTokens: [ordinalDay[1]] };

  const weekdayToken = tokens.find((token) => WEEKDAYS.has(token));
  if (weekdayToken) return { kind: "weekday", weekday: WEEKDAYS.get(weekdayToken), source: "natural_date", selectorTokens: [weekdayToken] };
  return null;
}

function dateMatches(booking, criterion) {
  const key = bookingDateKey(booking);
  if (!key || !criterion) return false;
  if (criterion.kind === "exact") return key === criterion.key;
  const [year, month, day] = key.split("-").map(Number);
  if (criterion.kind === "parts") {
    return day === criterion.day
      && (!criterion.month || month === criterion.month)
      && (!criterion.year || year === criterion.year);
  }
  if (criterion.kind === "weekday") {
    const date = new Date(`${key}T12:00:00+04:00`);
    return date.getDay() === criterion.weekday;
  }
  return false;
}

function parseClockCriterion(value) {
  const query = normalizeCancellationText(value);
  let match = query.match(/(?:^|[^\p{L}\p{N}])([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm|\u0635|\u0645|\u0635\u0628\u0627\u062d\u0627|\u0645\u0633\u0627\u0621)?(?=$|[^\p{L}\p{N}])/u);
  if (!match) match = query.match(/(?:^|[^\p{L}\p{N}])(1[0-2]|0?[1-9])\s*(am|pm|\u0635|\u0645|\u0635\u0628\u0627\u062d\u0627|\u0645\u0633\u0627\u0621)(?=$|[^\p{L}\p{N}])/u);
  let hour;
  let minute = 0;
  let suffix = "";
  let selectorTokens = [];
  let hourToken = "";
  if (match) {
    hour = Number(match[1]);
    minute = Number(match[2] && /^\d{2}$/.test(match[2]) ? match[2] : 0);
    suffix = String(match[3] || match[2] || "").toLowerCase();
    selectorTokens = normalizedTokens(match[0]);
    hourToken = String(match[1]);
  } else {
    const tokens = normalizedTokens(query);
    const hourIndex = tokens.findIndex((token) => ARABIC_SPOKEN_CLOCK_HOURS.has(token));
    const spokenSuffix = hourIndex >= 0 ? tokens[hourIndex + 1] : "";
    if (hourIndex < 0 || !["ص", "م", "صباح", "صباحا", "مساء"].includes(spokenSuffix)) return null;
    hour = ARABIC_SPOKEN_CLOCK_HOURS.get(tokens[hourIndex]);
    suffix = spokenSuffix;
    selectorTokens = [tokens[hourIndex], spokenSuffix];
    hourToken = tokens[hourIndex];
  }
  if (["pm", "م", "مساء"].includes(suffix) && hour < 12) hour += 12;
  if (["am", "ص", "صباح", "صباحا"].includes(suffix) && hour === 12) hour = 0;
  return {
    minutes: hour * 60 + minute,
    hourToken,
    selectorTokens,
  };
}

function parseClockMinutes(value) {
  return parseClockCriterion(value)?.minutes ?? null;
}

function parseTimeBand(query, exactMinutes) {
  if (exactMinutes !== null) return null;
  const tokens = new Set(normalizedTokens(query));
  if (/\bmorning\b/u.test(query) || ["صباح", "صباحا", "الصباح"].some((token) => tokens.has(token))) return "morning";
  if (/\bafternoon\b/u.test(query) || ["ظهر", "ظهرا", "الظهر"].some((token) => tokens.has(token))) return "afternoon";
  if (/\bevening\b/u.test(query) || ["مساء", "المساء"].some((token) => tokens.has(token))) return "evening";
  if (/\b(?:night|tonight)\b/u.test(query) || ["ليل", "ليلا", "الليل", "الليله"].some((token) => tokens.has(token))) return "night";
  return null;
}

function timeBandMatches(minutes, band) {
  if (!Number.isFinite(minutes)) return false;
  if (band === "morning") return minutes >= 300 && minutes < 720;
  if (band === "afternoon") return minutes >= 720 && minutes < 1020;
  if (band === "evening") return minutes >= 1020 && minutes < 1260;
  if (band === "night") return minutes >= 1260 || minutes < 300;
  return false;
}

function parseOrdinal(query) {
  if (/\b(?:the\s+)?last\s+(?:one|booking|reservation)?\b|(?:\u0627\u0644اخير|\u0627\u062eر)\s*(?:\u062d\u062c\u0632)?/u.test(query)) return "last";
  const numeric = query.match(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\s+(?:one|booking|reservation)\b/)
    || query.match(/\b(?:booking|reservation|one)\s*(?:number\s*)?#?(\d{1,2})\b/)
    || query.match(/(?:\u0627\u0644\u062d\u062c\u0632|\u062d\u062c\u0632)\s+(?:\u0631\u0642\u0645\s+)?(\d{1,2})\b/u);
  if (numeric) return Number(numeric[1]);
  for (const [word, position] of Object.entries(ORDINALS)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const englishPattern = new RegExp(`\\b(?:the\\s+)?${escaped}\\s+(?:one|booking|reservation)\\b`);
    const arabicPattern = new RegExp(`(?:الحجز|حجز)?\\s*${escaped}(?:\\s|$)`, "u");
    if (englishPattern.test(query) || (/\p{Script=Arabic}/u.test(word) && arabicPattern.test(query))) return position;
  }
  return null;
}

function displayOrder(bookings, displayedBookingRefs, displayedBookings) {
  const byRef = new Map(bookings.map((booking) => [referenceKey(bookingReference(booking)), booking]));
  const requestedOrder = Array.isArray(displayedBookingRefs) && displayedBookingRefs.length
    ? displayedBookingRefs
    : Array.isArray(displayedBookings) && displayedBookings.length
      ? displayedBookings.map((booking) => bookingReference(booking))
      : bookings.map((booking) => bookingReference(booking));
  const ordered = [];
  const seen = new Set();
  for (const ref of requestedOrder) {
    const key = referenceKey(ref);
    const booking = byRef.get(key);
    if (booking && !seen.has(key)) {
      ordered.push(booking);
      seen.add(key);
    }
  }
  return ordered;
}

function findReferenceCriterion(rawText, query, bookings) {
  const compactQuery = referenceKey(query);
  const known = bookings.find((booking) => {
    const key = referenceKey(bookingReference(booking));
    return key.length >= 4 && compactQuery.includes(key);
  });
  if (known) return { key: referenceKey(bookingReference(known)), raw: bookingReference(known), known: true };

  const explicit = toAsciiDigits(rawText).match(/(?:booking\s+)?(?:reference\b|ref\b)\s*[:#-]?\s*([a-z0-9][a-z0-9-]{2,})/i)
    || normalizeCancellationText(rawText).match(/(?:\u0631\u0642\u0645\s+\u0627\u0644\u062d\u062c\u0632|\u0645\u0631\u062c\u0639\s+\u0627\u0644\u062d\u062c\u0632)\s*[:#-]?\s*([a-z0-9][a-z0-9-]{2,})/iu);
  return explicit ? { key: referenceKey(explicit[1]), raw: explicit[1], known: false } : null;
}

function titleWords(value) {
  return normalizedTokens(value).filter((token) => !TITLE_STOP_WORDS.has(token));
}

function queryMentionsMovie(query, title) {
  const normalizedQuery = normalizeSpokenNumbers(query);
  const normalizedTitle = normalizeSpokenNumbers(title);
  if (!normalizedTitle) return false;
  if (` ${normalizedQuery} `.includes(` ${normalizedTitle} `)) return true;
  const titleTokens = titleWords(normalizedTitle);
  const queryTokenList = normalizedTokens(normalizedQuery).filter((token) => !INTENT_WORDS.has(token));
  const queryTokens = new Set(queryTokenList);
  if (titleTokens.length === 1 && titleTokens[0].length >= 3 && queryTokens.has(titleTokens[0])) return true;
  const matched = titleTokens.filter((token) => queryTokens.has(token));
  if (matched.length >= 2 && matched.length >= Math.min(2, titleTokens.length)) return true;
  return Boolean(findCrossScriptMovieTitleRange(normalizedTokens(normalizedQuery), title));
}

function cinemaWords(value) {
  return normalizedTokens(value).filter((token) => !CINEMA_STOP_WORDS.has(token) && /[\p{L}\p{N}]/u.test(token));
}

function matchingCinemaAliases(query, cinema) {
  const normalizedCinema = normalizeCancellationText(cinema).replace(/\bcenter\b/g, "centre");
  for (const aliases of Object.values(CINEMA_ALIASES)) {
    const belongsToCinema = aliases.some((alias) => {
      const normalizedAlias = normalizeCancellationText(alias).replace(/\bcenter\b/g, "centre");
      return normalizedAlias.length >= 4 && ` ${normalizedCinema} `.includes(` ${normalizedAlias} `);
    });
    if (!belongsToCinema) continue;
    return aliases.filter((alias) => {
      const normalizedAlias = normalizeCancellationText(alias);
      return normalizedAlias && ` ${query} `.includes(` ${normalizedAlias} `);
    });
  }
  return [];
}

function hasUnrecognizedSelector(query, matchedBy) {
  const criteria = arguments[2] || {};
  const consumed = new Set();
  const addConsumed = (value) => normalizedTokens(normalizeSpokenNumbers(value)).forEach((token) => consumed.add(token));
  for (const movie of Array.isArray(criteria.movie) ? criteria.movie : []) {
    addConsumed(movie);
    const queryTokenList = normalizedTokens(normalizeSpokenNumbers(query));
    const range = findCrossScriptMovieTitleRange(queryTokenList, movie);
    if (range) range.tokens.forEach((token) => consumed.add(token));
  }
  for (const cinema of Array.isArray(criteria.cinema) ? criteria.cinema : []) {
    addConsumed(cinema);
    matchingCinemaAliases(query, cinema).forEach(addConsumed);
    const words = cinemaWords(cinema);
    if (words.includes("mall") && words.includes("emirates")) consumed.add("moe");
    if (words.includes("city") && words.includes("centre") && words.includes("mirdif")) consumed.add("ccm");
  }
  if (criteria.reference) addConsumed(criteria.reference);
  for (const token of Array.isArray(criteria.date?.selectorTokens) ? criteria.date.selectorTokens : []) addConsumed(token);
  if (Number.isInteger(criteria.date?.day)) {
    addConsumed(criteria.date.day);
    for (const suffix of ["st", "nd", "rd", "th"]) addConsumed(`${criteria.date.day}${suffix}`);
  }
  for (const token of Array.isArray(criteria.showtimeTokens) ? criteria.showtimeTokens : []) addConsumed(token);
  if (criteria.ordinal !== undefined && criteria.ordinal !== null) addConsumed(criteria.ordinal);
  const temporalMatched = matchedBy.some((item) => ["date", "relative_date", "natural_date", "showtime", "time_band", "ordinal"].includes(item));
  const substantiveMatched = matchedBy.some((item) => ["reference", "movie", "cinema", "context_movie", "context_booking"].includes(item));
  const contextualOne = substantiveMatched && (/\bthe\s+one\b/.test(query) || /\bone(?:\s+please)?\s*$/.test(query))
    || temporalMatched && (/\bthe\s+one\b/.test(query) || /\bone(?:\s+please)?\s*$/.test(query));
  return normalizedTokens(normalizeSpokenNumbers(query)).some((token) => {
    if (INTENT_WORDS.has(token) || consumed.has(token)) return false;
    if (substantiveMatched && CONNECTOR_WORDS.has(token)) return false;
    if (contextualOne && token === "1") return false;
    if (temporalMatched && TEMPORAL_SELECTOR_WORDS.has(token)) return false;
    return true;
  });
}

function queryMentionsCinema(query, cinema, ignoredTokens = new Set()) {
  const normalizedCinema = normalizeCancellationText(cinema);
  if (!normalizedCinema) return false;
  if (` ${query} `.includes(` ${normalizedCinema} `)) return true;
  if (matchingCinemaAliases(query, cinema).length) return true;
  const words = cinemaWords(cinema);
  const queryTokens = new Set(normalizedTokens(query));
  if (queryTokens.has("moe") && words.includes("mall") && words.includes("emirates")) return true;
  if (queryTokens.has("ccm") && words.includes("city") && words.includes("centre") && words.includes("mirdif")) return true;
  if (!words.length) return false;
  if (words.length === 1) return words[0].length >= 4 && queryTokens.has(words[0]);
  if (words.every((word) => queryTokens.has(word))) return true;
  const distinctiveQueryWords = [...queryTokens].filter((token) => token.length >= 4
    && !ignoredTokens.has(token)
    && !CINEMA_STOP_WORDS.has(token)
    && !INTENT_WORDS.has(token)
    && !CONNECTOR_WORDS.has(token)
    && !TEMPORAL_SELECTOR_WORDS.has(token)
    && !/^\d/.test(token));
  return distinctiveQueryWords.length > 0 && distinctiveQueryWords.every((token) => words.includes(token));
}

function contextMovieMatches(booking, context) {
  const current = context?.currentMovie || context?.movie || context?.visibleMovie || null;
  const contextId = String(current?.id || current?.movieId || context?.movieId || "").trim();
  const bookingId = String(booking?.movieId || booking?.filmId || "").trim();
  if (contextId && bookingId) return contextId === bookingId;
  const contextTitle = String(current?.title || current?.movieTitle || context?.movieTitle || context?.currentMovieTitle || "").trim();
  return Boolean(contextTitle && normalizeCancellationText(bookingMovie(booking)) === normalizeCancellationText(contextTitle));
}

function lifecycleAssessment(booking, options) {
  const status = normalizeCancellationText(booking?.bookingStatus || booking?.status || "");
  if (booking?.cancelled || /\b(?:cancelled|canceled|refunded|voided)\b/.test(status)) {
    return { category: "already_cancelled", reason: "already_cancelled", assessment: null };
  }
  if (/\b(?:expired|failed)\b/.test(status)) {
    return { category: "ineligible", reason: status.includes("expired") ? "booking_expired" : "booking_failed", assessment: null };
  }
  const eligibilityBooking = booking?.performanceDate && !booking?.sourceDate && !booking?.date
    ? { ...booking, sourceDate: booking.performanceDate }
    : booking;
  const assessment = assessCancellationEligibility(eligibilityBooking, options);
  if (assessment.reason === "already_cancelled") return { category: "already_cancelled", reason: assessment.reason, assessment };
  if (assessment.status === "ineligible") return { category: "ineligible", reason: assessment.reason, assessment };
  return { category: "selectable", reason: assessment.reason, assessment };
}

function candidateSummary(booking, displayed, assessment = null) {
  const ref = bookingReference(booking);
  const position = displayed.findIndex((item) => referenceKey(bookingReference(item)) === referenceKey(ref));
  return Object.freeze({
    bookingRef: ref || null,
    movie: bookingMovie(booking) || null,
    date: bookingDateKey(booking),
    showtime: bookingShowtime(booking) || null,
    cinema: bookingCinema(booking) || null,
    position: position >= 0 ? position + 1 : null,
    eligibilityStatus: assessment?.status || null,
    eligibilityReason: assessment?.reason || null,
  });
}

function focusedDifferentiators(candidates) {
  if (candidates.length < 2) return [];
  const fieldOrder = ["movie", "date", "showtime", "cinema", "bookingRef"];
  let groups = [candidates];
  const selected = [];
  for (const field of fieldOrder) {
    const nextGroups = [];
    let splitOccurred = false;
    for (const group of groups) {
      if (group.length < 2) {
        nextGroups.push(group);
        continue;
      }
      const buckets = new Map();
      for (const candidate of group) {
        const key = normalizeCancellationText(candidate[field] || "not_available");
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(candidate);
      }
      if (buckets.size > 1) splitOccurred = true;
      nextGroups.push(...buckets.values());
    }
    if (splitOccurred) {
      selected.push(field === "bookingRef" ? "reference" : field);
      groups = nextGroups;
    }
    if (groups.every((group) => group.length === 1)) break;
  }
  return selected;
}

function frozenResult({
  status,
  booking = null,
  candidates = [],
  matchedBy = [],
  criteria = {},
  differentiators = [],
  reason = null,
  eligibility = null,
}) {
  return Object.freeze({
    status,
    booking,
    bookingRef: booking ? bookingReference(booking) || null : null,
    candidates: Object.freeze(candidates),
    candidateRefs: Object.freeze(candidates.map((candidate) => candidate.bookingRef).filter(Boolean)),
    matchedBy: Object.freeze(matchedBy),
    criteria: Object.freeze(criteria),
    differentiators: Object.freeze(differentiators),
    reason,
    eligibility,
  });
}

/**
 * Resolves a natural-language cancellation target without changing booking data.
 * The caller remains responsible for confirmation, provider calls, persistence,
 * and rendering. displayedBookingRefs must use the same order shown to the guest.
 */
export function resolveConversationalCancellation({
  text = "",
  bookings = [],
  displayedBookingRefs = [],
  displayedBookings = [],
  conversationContext = {},
  now = new Date(),
  cutoffMinutes,
  ignoreLifecycle = false,
} = {}) {
  const safeBookings = Array.isArray(bookings) ? bookings.filter((booking) => booking && typeof booking === "object") : [];
  const query = normalizeCancellationText(text);
  const displayed = displayOrder(safeBookings, displayedBookingRefs, displayedBookings);
  const matchedBy = [];
  const criteria = {};
  let matches = [...safeBookings];

  if (!query || !safeBookings.length) {
    return frozenResult({ status: "none", matchedBy, criteria, reason: !safeBookings.length ? "no_booking_history" : "empty_request" });
  }

  const reference = findReferenceCriterion(text, query, safeBookings);
  if (reference) {
    matchedBy.push("reference");
    criteria.reference = reference.raw;
    matches = matches.filter((booking) => referenceKey(bookingReference(booking)) === reference.key);
    if (!matches.length) return frozenResult({ status: "none", matchedBy, criteria, reason: "unknown_reference" });
  }

  const dateCriterion = parseDateCriterion(query, now);
  const clockCriterion = parseClockCriterion(query);
  let ordinal = parseOrdinal(query);
  if (Number.isInteger(ordinal)
    && dateCriterion?.kind === "parts"
    && ordinal === dateCriterion.day) {
    ordinal = null;
  }
  if (Number.isInteger(ordinal)
    && /^\d+$/.test(clockCriterion?.hourToken || "")
    && ordinal === Number(clockCriterion.hourToken)) {
    ordinal = null;
  }
  if (Number.isInteger(ordinal)
    && ordinal > displayed.length
    && !/\b(?:booking|reservation|number)\b|(?:الحجز|حجز|رقم)/u.test(query)) {
    ordinal = null;
  }
  if (ordinal !== null) {
    matchedBy.push("ordinal");
    criteria.ordinal = ordinal;
    const selected = ordinal === "last" ? displayed.at(-1) : displayed[Number(ordinal) - 1];
    if (!selected) return frozenResult({ status: "none", matchedBy, criteria, reason: "ordinal_out_of_range" });
    const selectedKey = referenceKey(bookingReference(selected));
    matches = matches.filter((booking) => referenceKey(bookingReference(booking)) === selectedKey);
  }

  const contextualMovie = /\b(?:this|that)\s+(?:movie|film)\b|(?:\u0647\u0630ا|\u0647\u0630ك)\s+(?:\u0627\u0644)?\u0641يلم/u.test(query);
  if (contextualMovie) {
    matchedBy.push("context_movie");
    criteria.contextMovie = true;
    const contextualMatches = matches.filter((booking) => contextMovieMatches(booking, conversationContext));
    if (!contextualMatches.length) {
      return frozenResult({ status: "none", matchedBy, criteria, reason: "context_movie_unavailable" });
    }
    matches = contextualMatches;
  } else {
    const movieMatches = safeBookings.filter((booking) => queryMentionsMovie(query, bookingMovie(booking)));
    if (movieMatches.length) {
      matchedBy.push("movie");
      criteria.movie = [...new Set(movieMatches.map(bookingMovie).filter(Boolean))];
      const keys = new Set(movieMatches.map((booking) => referenceKey(bookingReference(booking))));
      matches = matches.filter((booking) => keys.has(referenceKey(bookingReference(booking))));
    }
  }

  const contextualBooking = /\b(?:this|that|my|visible|current)\s+(?:booking|reservation)\b|^(?:cancel|refund|void)(?:\s+(?:it|this|that))?$|(?:هذا|هذه|حجزي|الحجز\s+الحالي)\s*(?:الحجز)?|^(?:الغي|الغاء|لغي|استرد|استرجع)(?:\s+(?:هذا|هذه|الحجز))?$/u.test(query);
  if (contextualBooking && conversationContext?.currentBookingRef) {
    matchedBy.push("context_booking");
    criteria.contextBooking = true;
    const currentBookingKey = referenceKey(conversationContext.currentBookingRef);
    matches = matches.filter((booking) => referenceKey(bookingReference(booking)) === currentBookingKey);
    if (!matches.length) {
      return frozenResult({ status: "none", matchedBy, criteria, reason: "context_booking_unavailable" });
    }
  }

  if (dateCriterion) {
    matchedBy.push(dateCriterion.source);
    criteria.date = dateCriterion;
    matches = matches.filter((booking) => dateMatches(booking, dateCriterion));
  }

  const exactMinutes = clockCriterion?.minutes ?? null;
  if (exactMinutes !== null) {
    matchedBy.push("showtime");
    criteria.showtimeMinutes = exactMinutes;
    criteria.showtimeTokens = clockCriterion.selectorTokens;
    matches = matches.filter((booking) => parseClockMinutes(bookingShowtime(booking)) === exactMinutes);
  }
  const timeBand = parseTimeBand(query, exactMinutes);
  if (timeBand) {
    matchedBy.push("time_band");
    criteria.timeBand = timeBand;
    matches = matches.filter((booking) => timeBandMatches(parseClockMinutes(bookingShowtime(booking)), timeBand));
  }

  const consumedMovieTokens = new Set(
    (Array.isArray(criteria.movie) ? criteria.movie : [])
      .flatMap((movie) => normalizedTokens(normalizeSpokenNumbers(movie))),
  );
  const cinemaMatches = safeBookings.filter((booking) => queryMentionsCinema(query, bookingCinema(booking), consumedMovieTokens));
  if (cinemaMatches.length) {
    matchedBy.push("cinema");
    criteria.cinema = [...new Set(cinemaMatches.map(bookingCinema).filter(Boolean))];
    const keys = new Set(cinemaMatches.map((booking) => referenceKey(bookingReference(booking))));
    matches = matches.filter((booking) => keys.has(referenceKey(bookingReference(booking))));
  }

  if (hasUnrecognizedSelector(query, matchedBy, criteria)) {
    return frozenResult({ status: "none", matchedBy, criteria, reason: "unrecognized_selector" });
  }

  if (!matches.length) return frozenResult({ status: "none", matchedBy, criteria, reason: "no_matching_booking" });

  const displayedRank = new Map(displayed.map((booking, index) => [referenceKey(bookingReference(booking)), index]));
  matches = matches
    .map((booking, inputIndex) => ({ booking, inputIndex }))
    .sort((left, right) => {
      const leftRank = displayedRank.get(referenceKey(bookingReference(left.booking)));
      const rightRank = displayedRank.get(referenceKey(bookingReference(right.booking)));
      return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
        || left.inputIndex - right.inputIndex;
    })
    .map(({ booking }) => booking);

  if (ignoreLifecycle) {
    const summaries = matches.map((booking) => candidateSummary(booking, displayed));
    if (matches.length === 1) {
      return frozenResult({
        status: "unique",
        booking: matches[0],
        candidates: summaries,
        matchedBy,
        criteria,
        reason: "unique_history_match",
      });
    }
    return frozenResult({
      status: "ambiguous",
      candidates: summaries,
      matchedBy,
      criteria,
      differentiators: focusedDifferentiators(summaries),
      reason: "multiple_history_matches",
    });
  }

  const assessed = matches.map((booking) => ({
    booking,
    ...lifecycleAssessment(booking, { now, ...(cutoffMinutes === undefined ? {} : { cutoffMinutes }) }),
  }));
  const selectable = assessed.filter((entry) => entry.category === "selectable");
  const ineligible = assessed.filter((entry) => entry.category === "ineligible");
  const cancelled = assessed.filter((entry) => entry.category === "already_cancelled");

  if (selectable.length === 1) {
    const entry = selectable[0];
    return frozenResult({
      status: "unique",
      booking: entry.booking,
      candidates: [candidateSummary(entry.booking, displayed, entry.assessment)],
      matchedBy,
      criteria,
      reason: entry.assessment?.status === "review_required" ? "unique_match_requires_review" : "unique_match",
      eligibility: entry.assessment,
    });
  }
  if (selectable.length > 1) {
    const summaries = selectable.map((entry) => candidateSummary(entry.booking, displayed, entry.assessment));
    return frozenResult({
      status: "ambiguous",
      candidates: summaries,
      matchedBy,
      criteria,
      differentiators: focusedDifferentiators(summaries),
      reason: "multiple_matching_bookings",
    });
  }
  if (ineligible.length) {
    const summaries = ineligible.map((entry) => candidateSummary(entry.booking, displayed, entry.assessment));
    const uniqueReasons = [...new Set(ineligible.map((entry) => entry.reason))];
    return frozenResult({
      status: "ineligible",
      booking: ineligible.length === 1 ? ineligible[0].booking : null,
      candidates: summaries,
      matchedBy,
      criteria,
      differentiators: focusedDifferentiators(summaries),
      reason: uniqueReasons.length === 1 ? uniqueReasons[0] : "multiple_ineligibility_reasons",
      eligibility: ineligible.length === 1 ? ineligible[0].assessment : null,
    });
  }
  const summaries = cancelled.map((entry) => candidateSummary(entry.booking, displayed, entry.assessment));
  return frozenResult({
    status: "already_cancelled",
    booking: cancelled.length === 1 ? cancelled[0].booking : null,
    candidates: summaries,
    matchedBy,
    criteria,
    differentiators: focusedDifferentiators(summaries),
    reason: "already_cancelled",
  });
}
