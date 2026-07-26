const tidy = (value) => String(value || "")
  .toLowerCase()
  .replace(/[\u064b-\u065f\u0670]/g, "")
  .replace(/[أإآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/[.!?؟،,]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const DIRECT_ARABIC = [
  /^(?:please )?(?:switch|change)(?: the)? conversation and (?:the )?interface to arabic(?: please)?$/,
  /^(?:please )?(?:switch|change)(?: the)? interface and (?:the )?conversation to arabic(?: please)?$/,
  /^(?:please )?(?:speak|continue|switch)(?: in| to)? arabic(?: please)?$/,
  /^(?:could|would|will|can) you (?:please )?(?:continue|switch)(?: in| to)? arabic(?: please)?$/,
  /^(?:please )?(?:use|talk to me in|talk with me in|speak with me in|reply in|respond in|answer in) arabic(?: please)?$/,
  /^(?:please )?(?:change|set|switch)(?: the)? language to arabic(?: please)?$/,
  /^(?:please )?(?:change|switch) to arabic(?: please)?$/,
  /^(تكلم|تحدث|كمل|اكمل|استمر)(?: باللغة العربية| بالعربية| بالعربي| عربي| العربية)$/,
  /^(?:تكلم|تحدث) معي (?:باللغة العربية|بالعربية|بالعربي)$/,
  /^(?:استخدم|استعمل)(?: اللغة)? (?:العربية|العربي)$/,
  /^(?:اريد|ابي|ابغى) (?:التحدث|الكلام|ان اتحدث) بالعربية$/,
  /^(?:حول|غير|بدل)(?: اللغة)? (?:الي العربية|للعربية|للعربي|العربية)$/,
];

const DIRECT_ENGLISH = [
  /^(?:please )?(?:switch|change)(?: the)? conversation and (?:the )?interface to english(?: please)?$/,
  /^(?:please )?(?:switch|change)(?: the)? interface and (?:the )?conversation to english(?: please)?$/,
  /^(?:please )?(?:speak|continue|switch)(?: in| to)? english(?: please)?$/,
  /^(?:could|would|will|can) you (?:please )?(?:continue|switch)(?: in| to)? english(?: please)?$/,
  /^(?:please )?(?:use|talk to me in|talk with me in|speak with me in|reply in|respond in|answer in) english(?: please)?$/,
  /^(?:please )?(?:change|set|switch)(?: the)? language to english(?: please)?$/,
  /^(?:please )?(?:change|switch) to english(?: please)?$/,
  /^(تكلم|تحدث|كمل|اكمل|استمر)(?: باللغة الانجليزية| بالانجليزية| بالانجليزي| انجليزي| الانجليزية)$/,
  /^(?:تكلم|تحدث) معي (?:باللغة الانجليزية|بالانجليزية|بالانجليزي)$/,
  /^(?:استخدم|استعمل)(?: اللغة)? (?:الانجليزية|الانجليزي)$/,
  /^(?:اريد|ابي|ابغى) (?:التحدث|الكلام|ان اتحدث) بالانجليزية$/,
  /^(?:حول|غير|بدل)(?: اللغة)? (?:الي الانجليزية|للانجليزية|للانجليزي|الانجليزية)$/,
];

const YES_ARABIC = new Set([
  "yes", "yes arabic", "continue arabic", "continue in arabic", "arabic", "arabic please",
  "نعم", "اي", "ايوه", "نعم بالعربية", "نعم بالعربي", "تمام بالعربي", "عربي", "كمل عربي", "كمل بالعربي", "اكمل بالعربية", "اكمل بالعربي",
]);

const YES_ENGLISH = new Set([
  "yes", "yes english", "continue english", "continue in english", "speak english", "english", "english please", "switch to english",
  "نعم بالانجليزية", "نعم بالانجليزي", "كمل انجليزي", "كمل بالانجليزي", "اكمل بالانجليزية", "اكمل بالانجليزي",
]);

const NO = new Set(["no", "no thanks", "no thank you", "لا", "لأ", "لا شكرا", "لا شكرًا"]);

const COMBINED_LANGUAGE_PREFIX = /^\s*(?:please\s+)?(?:switch(?:\s+(?:the\s+)?language)?\s+to|change(?:\s+the)?\s+language\s+to|set(?:\s+the)?\s+language\s+to|speak(?:\s+in)?|continue(?:\s+in)?|reply\s+in|respond\s+in)\s+(arabic|english)\s*(?:,|;|\band\b|\bthen\b)\s*/iu;

export function stripLanguageControlCommand(text) {
  const raw = String(text || "").trim();
  const match = raw.match(COMBINED_LANGUAGE_PREFIX);
  return match ? raw.slice(match[0].length).trim() : raw;
}

export function explicitLanguageRequest(text) {
  const raw = String(text || "").trim();
  const combined = raw.match(COMBINED_LANGUAGE_PREFIX);
  if (combined && stripLanguageControlCommand(raw)) return combined[1].toLowerCase() === "arabic" ? "ar" : "en";
  const value = tidy(text);
  if (/^can you speak arabic$/.test(value) || /^هل (يمكنك|تستطيع) التحدث بالعربية$/.test(value)) return null;
  if (/^can you speak english$/.test(value) || /^هل (يمكنك|تستطيع) التحدث بالانجليزية$/.test(value)) return null;
  if (DIRECT_ARABIC.some((pattern) => pattern.test(value))) return "ar";
  if (DIRECT_ENGLISH.some((pattern) => pattern.test(value))) return "en";
  return null;
}

function offeredLanguage(text, currentLocale) {
  const value = tidy(text);
  if (currentLocale === "en"
    && /(?:would you (?:like|prefer)|do you want|shall i|should i|can i).*(?:continue|speak|switch|reply|respond|answer).*arabic/.test(value)) return "ar";
  if (currentLocale === "ar"
    && /(?:(?:هل تريد|هل تفضل|اتريد)(?: ان)?\s+(?:اتابع|نكمل|استمر|اتحدث|اتكلم|استخدم|ارد|اجيب|احول|اغير)|هل\s+(?:استمر|اتابع|اتكلم|اتحدث|احول|اغير))(?:\s+(?:الي|ل))?.*(?:بالانجليزية|باللغة الانجليزية|الانجليزية)/.test(value)) return "en";
  return null;
}

export function conversationLanguageContinuityContext(text, currentLocale) {
  if (explicitLanguageRequest(text)) return "";
  const source = String(text || "");
  const hasArabicScript = /\p{Script=Arabic}/u.test(source);
  const hasLatinScript = /[A-Za-z]/u.test(source);
  if (currentLocale === "en" && hasArabicScript) {
    return "UI language: English. Arabic script is not a switch. Reply in English, keep the journey, and treat Arabic as a film filter when relevant.";
  }
  if (currentLocale === "ar" && hasLatinScript && !hasArabicScript) {
    return "UI language: Arabic. Latin script is not a switch. Reply in Arabic and keep the journey.";
  }
  return "";
}

function confirmed(text, targetLocale) {
  const value = tidy(text);
  return targetLocale === "ar" ? YES_ARABIC.has(value) : YES_ENGLISH.has(value);
}

export function resolveLanguageSignal({ role, text, currentLocale, pendingLocale = null }) {
  if (role === "agent") {
    return { nextLocale: null, pendingLocale: offeredLanguage(text, currentLocale) || pendingLocale };
  }

  const direct = explicitLanguageRequest(text);
  if (direct) return { nextLocale: direct, pendingLocale: null };
  if (pendingLocale && confirmed(text, pendingLocale)) return { nextLocale: pendingLocale, pendingLocale: null };
  if (pendingLocale && NO.has(tidy(text))) return { nextLocale: null, pendingLocale: null };
  return { nextLocale: null, pendingLocale: null };
}
