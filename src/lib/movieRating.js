import { resolveFilmCandidate } from "./fuzzyResolvers.js";
import { normalizeCustomerFacingText } from "./customerFacingText.js";

const KNOWN_RATINGS = new Set(["G", "PG", "PG13", "PG15", "15+", "18+", "21+", "18TC"]);

const ENGLISH_NUMBER_WORDS = Object.freeze({
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
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  "twenty one": 21,
});

const ARABIC_NUMBER_WORDS = Object.freeze({
  "واحد وعشرون": 21,
  "واحدة وعشرون": 21,
  "احدى وعشرون": 21,
  "واحد وعشرين": 21,
  "واحدة وعشرين": 21,
  عشرون: 20,
  عشرين: 20,
  "تسعة عشر": 19,
  "تسع عشرة": 19,
  "ثمانية عشر": 18,
  "ثماني عشرة": 18,
  "سبعة عشر": 17,
  "سبع عشرة": 17,
  "ستة عشر": 16,
  "ست عشرة": 16,
  "خمسة عشر": 15,
  "خمس عشرة": 15,
  "اربعة عشر": 14,
  "اربع عشرة": 14,
  "ثلاثة عشر": 13,
  "ثلاث عشرة": 13,
  "اثنا عشر": 12,
  "اثني عشر": 12,
  "اثنتا عشرة": 12,
  "اثنتي عشرة": 12,
  "احد عشر": 11,
  "احدى عشرة": 11,
  عشرة: 10,
  عشر: 10,
  تسعة: 9,
  تسع: 9,
  ثمانية: 8,
  ثمان: 8,
  سبعة: 7,
  سبع: 7,
  ستة: 6,
  ست: 6,
  خمسة: 5,
  خمس: 5,
  اربعة: 4,
  اربع: 4,
  ثلاثة: 3,
  ثلاث: 3,
  اثنان: 2,
  اثنين: 2,
  اثنتان: 2,
  اثنتين: 2,
  واحد: 1,
  واحدة: 1,
});

const CERTIFICATE_PATTERN = /\b(?:age\s*(?:rating|classification|certificate|restriction|limit)|parental\s+guidance|certificate|certification|classified|underage|child|children|kid|kids|year[ -]?old|years?\s+old|y\/?o|take\s+my|bring\s+my|can\s+my\s+(?:son|daughter|child|kid)|suitable\s+for|appropriate\s+for|rated\s+(?:g|pg|1[58]|21)|pg[ -]?(?:13|15)|(?:15|18|21)\s*(?:\+|plus)|(?:fifteen|eighteen|twenty\s+one)\s+plus|18\s*tc|eighteen\s+t\s*c)\b|(?:تصنيف\s*عمري|التصنيف\s*العمري|تصنيف\s+(?:(?:هذا|هذه)\s+)?(?:الفيلم|فيلم)|شهادة\s*عمرية|حد\s*العمر|قيود\s*العمر|إرشاد\s*أبوي|ارشاد\s*ابوي|طفل|أطفال|اطفال|ابني|إبني|بنتي|ابنتي|اصطحب|آخذ|اخذ|مناسب\s*(?:للأطفال|للاطفال)|فوق\s*(?:15|18|21)|بي\s*جي\s*(?:13|15))/iu;
const REVIEW_PATTERN = /\b(?:review|reviews|reviewed|score|stars?|imdb|rotten\s+tomatoes|metacritic|critics?|audience\s+score|box\s+office|out\s+of\s+(?:five|ten|5|10)|worth\s+(?:watching|seeing)|good\s+(?:movie|film|rating)|bad\s+(?:movie|film|rating))\b|(?:مراجعة(?!\s+(?:إتمام\s+الحجز|الدفع|الحجز))|مراجعات|تقييم\s*(?:النقاد|الجمهور|آي\s*إم\s*دي\s*بي|imdb)|نقاط|نجوم|من\s*(?:5|10|خمسة|عشرة)|يستحق\s*المشاهدة|رأيك\s*في|رايك\s*في)/iu;
const GENERIC_RATING_PATTERN = /\b(?:rating|rated|classification)\b|(?:التقييم|تقييم|التصنيف|مصنف|تصنيف(?:ه|ها)?(?!\s*(?:النوع|نوع)))/iu;
const MOVIE_CONTEXT_PATTERN = /\b(?:movie|film|cinema|watch|see)\b|(?:فيلم|الفيلم|سينما|مشاهدة|أشاهد|اشاهد)/iu;
const CURRENT_REFERENCE_PATTERN = /\b(?:this|that|the\s+movie|the\s+film|it)\b|(?:هذا\s+الفيلم|هذه\s+الفيلم|الفيلم|هذا|هذه)/iu;

const digitMap = Object.freeze({
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
});

const normalizeDigits = (value) => String(value ?? "").replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit] || digit);
const clean = (value) => normalizeCustomerFacingText(String(value ?? "").replace(/\s+/g, " ").trim());
const normalizedText = (value) => normalizeDigits(value)
  .normalize("NFKC")
  .toLocaleLowerCase("en")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/[^\p{L}\p{N}+#]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const localeValue = (locale, en, ar) => locale === "ar" ? ar : en;

function rawRating(value) {
  if (value && typeof value === "object") {
    return value.rating ?? value.Rating ?? value.movieRating ?? value.certificate ?? value.code ?? "";
  }
  return value;
}

export function normalizeMovieRating(value) {
  const raw = normalizeDigits(rawRating(value)).normalize("NFKC").toUpperCase().trim();
  if (!raw) return null;
  const spoken = normalizedText(raw);
  const pgSpoken = spoken.match(/^(?:p\s*g|بي\s*جي)\s*(?:(13|15)|(?:one\s*three|thirteen|ثلاثة\s*عشر(?:ة)?)|(?:one\s*five|fifteen|خمسة\s*عشر(?:ة)?))?$/iu);
  if (pgSpoken) {
    if (pgSpoken[1]) return `PG${pgSpoken[1]}`;
    if (/(?:one\s*three|thirteen|ثلاثة\s*عشر)/iu.test(spoken)) return "PG13";
    if (/(?:one\s*five|fifteen|خمسة\s*عشر)/iu.test(spoken)) return "PG15";
    return "PG";
  }
  if (/^(?:fifteen|one\s*five)\s+plus$/iu.test(spoken)) return "15+";
  if (/^(?:eighteen|one\s*eight)\s+plus$/iu.test(spoken)) return "18+";
  if (/^(?:twenty\s*one|two\s*one)\s+plus$/iu.test(spoken)) return "21+";
  if (/^(?:eighteen|one\s*eight)\s*t\s*c$/iu.test(spoken)) return "18TC";
  const arabicAbove = spoken.match(/^فوق\s*(15|18|21)$/u);
  if (arabicAbove) return `${arabicAbove[1]}+`;
  if (/^فوق\s*(?:ثمانية\s*عشر|ثماني\s*عشرة)$/u.test(spoken)) return "18+";
  const compact = raw
    .replace(/\bPLUS\b/g, "+")
    .replace(/\bYEARS?\b|\bYRS?\b|\bAGED?\b/g, "")
    .replace(/[\s._/-]+/g, "")
    .replace(/^\+(15|18|21)$/, "$1+")
    .replace(/^(15|18|21)PLUS$/, "$1+");
  const arabicPg = normalizedText(raw).match(/بي\s*جي\s*(13|15)?/u);
  const canonical = arabicPg ? `PG${arabicPg[1] || ""}` : compact;
  return KNOWN_RATINGS.has(canonical) ? canonical : null;
}

function ageFromWordPhrase(value) {
  const text = normalizedText(value);
  const entries = Object.entries(ENGLISH_NUMBER_WORDS).sort((left, right) => right[0].length - left[0].length);
  for (const [word, age] of entries) {
    const escaped = word.replace(/\s+/g, "\\s+");
    if (new RegExp(`\\b${escaped}[ -]*(?:year[ -]?old|years?[ -]+old|y\\.?\\s*[/.-]?\\s*o\\.?)`, "iu").test(text)) return age;
    if (new RegExp(`\\b(?:aged?|age(?:d)?\\s+is|my\\s+(?:son|daughter|child|kid)\\s+is)\\s+${escaped}\\b`, "iu").test(text)) return age;
  }
  return null;
}

function ageFromArabicWordPhrase(value) {
  const text = normalizedText(value);
  const entries = Object.entries(ARABIC_NUMBER_WORDS).sort((left, right) => right[0].length - left[0].length);
  for (const [word, age] of entries) {
    const escaped = word.replace(/\s+/g, "\\s+");
    const beforeAge = `(?:عمر(?:ه|ها)?|سن(?:ه|ها)?|عمر\\s+(?:ابني|ابنتي|بنتي|طفلي))`;
    const ageUnit = "(?:سنة|سنوات|عام|اعوام)";
    if (new RegExp(`${beforeAge}\\s+${escaped}(?:\\s+${ageUnit})?`, "iu").test(text)) return age;
    if (new RegExp(`${escaped}\\s+${ageUnit}`, "iu").test(text)) return age;
  }
  return null;
}

export function extractViewerAge(input) {
  const value = normalizeDigits(typeof input === "object" && input !== null ? input.text ?? input.query ?? "" : input);
  const text = String(value || "").normalize("NFKC");
  const patterns = [
    /\b(?:aged?|age(?:d)?\s+is|my\s+(?:son|daughter|child|kid)\s+is)\s*(\d{1,2})\b/iu,
    /\b(\d{1,2})[ -]*(?:year[ -]?old|years?[ -]+old|y\.?\s*[/.-]?\s*o\.?)/iu,
    /(?:عمره|عمرها|عمر\s+(?:ابني|ابنتي|بنتي|طفلي)|سن(?:ه|ها)?)\s*(\d{1,2})\b/iu,
    /\b(\d{1,2})\s*(?:سنة|سنوات|عام|أعوام|اعوام)\b/iu,
  ];
  for (const pattern of patterns) {
    const age = Number(text.match(pattern)?.[1]);
    if (Number.isInteger(age) && age >= 0 && age <= 120) return age;
  }
  return ageFromWordPhrase(text) ?? ageFromArabicWordPhrase(text);
}

export function resolveRatingMeaning(input) {
  const value = typeof input === "object" && input !== null ? input.text ?? input.query ?? "" : input;
  const text = String(value || "").normalize("NFKC");
  const explicitCertificate = CERTIFICATE_PATTERN.test(text) || Boolean(normalizeMovieRating(text.match(/(?:PG[\s-]?(?:13|15)?|(?:15|18|21)\s*(?:\+|plus)|18\s*TC|\bG\b)/iu)?.[0]));
  const explicitReview = REVIEW_PATTERN.test(text);
  const genericRating = GENERIC_RATING_PATTERN.test(text);
  if (explicitCertificate && explicitReview) return "ambiguous";
  if (explicitCertificate) return "certificate";
  if (explicitReview) return "review";
  if (genericRating) return "ambiguous";
  return null;
}

export function isMovieRatingQuestion(input) {
  const value = typeof input === "object" && input !== null ? input.text ?? input.query ?? "" : input;
  const meaning = resolveRatingMeaning(value);
  if (meaning !== null) return true;
  const text = String(value || "");
  return Boolean(extractViewerAge(text) != null && (MOVIE_CONTEXT_PATTERN.test(text) || CERTIFICATE_PATTERN.test(text)));
}

const POLICY = Object.freeze({
  G: Object.freeze({
    code: "G",
    category: "general",
    minimumAge: 0,
    companionMinimumAge: null,
    provisional: false,
    restricted: false,
    identificationRequired: false,
    guidance: Object.freeze({
      en: "G is open to all ages.",
      ar: "تصنيف G متاح لجميع الأعمار.",
    }),
  }),
  PG: Object.freeze({
    code: "PG",
    category: "parental_guidance",
    minimumAge: 0,
    companionMinimumAge: null,
    provisional: false,
    restricted: false,
    identificationRequired: false,
    guidance: Object.freeze({
      en: "PG is open to all ages, but parental guidance is advised because some material may not be suitable for children.",
      ar: "تصنيف PG متاح لجميع الأعمار، لكن يوصى بإرشاد الوالدين لأن بعض المحتوى قد لا يكون مناسباً للأطفال.",
    }),
  }),
  PG13: Object.freeze({
    code: "PG13",
    category: "accompanied_guidance",
    minimumAge: 0,
    companionMinimumAge: 13,
    guidanceAge: 13,
    provisional: false,
    restricted: false,
    identificationRequired: false,
    guidance: Object.freeze({
      en: "Guests aged 13 and under may attend only with someone aged 13 or older. The content may not be suitable for guests aged 13 and below, so the decision is at the discretion of a parent or guardian.",
      ar: "يمكن للضيوف بعمر 13 سنة أو أقل الحضور فقط برفقة شخص عمره 13 سنة أو أكثر. قد لا يكون المحتوى مناسباً لمن هم بعمر 13 سنة أو أقل، لذلك يعود القرار لتقدير ولي الأمر.",
    }),
  }),
  PG15: Object.freeze({
    code: "PG15",
    category: "accompanied_guidance",
    minimumAge: 0,
    companionMinimumAge: 15,
    guidanceAge: 15,
    provisional: false,
    restricted: false,
    identificationRequired: false,
    guidance: Object.freeze({
      en: "Guests aged 15 and under may attend only with someone aged 15 or older. The content may not be suitable for guests aged 15 and below, so the decision is at the discretion of a parent or guardian.",
      ar: "يمكن للضيوف بعمر 15 سنة أو أقل الحضور فقط برفقة شخص عمره 15 سنة أو أكثر. قد لا يكون المحتوى مناسباً لمن هم بعمر 15 سنة أو أقل، لذلك يعود القرار لتقدير ولي الأمر.",
    }),
  }),
  "15+": Object.freeze({
    code: "15+",
    category: "restricted",
    minimumAge: 15,
    companionMinimumAge: null,
    provisional: false,
    restricted: true,
    identificationRequired: true,
    guidance: Object.freeze({
      en: "Guests under 15 are not admitted, even with a parent. Identification and proof of age may be required.",
      ar: "لا يسمح بدخول من هم دون 15 سنة حتى برفقة ولي الأمر، وقد تطلب الهوية وإثبات العمر.",
    }),
  }),
  "18+": Object.freeze({
    code: "18+",
    category: "restricted",
    minimumAge: 18,
    companionMinimumAge: null,
    provisional: false,
    restricted: true,
    identificationRequired: true,
    guidance: Object.freeze({
      en: "Guests under 18 are not admitted, even with a parent. Identification and proof of age may be required.",
      ar: "لا يسمح بدخول من هم دون 18 سنة حتى برفقة ولي الأمر، وقد تطلب الهوية وإثبات العمر.",
    }),
  }),
  "21+": Object.freeze({
    code: "21+",
    category: "restricted",
    minimumAge: 21,
    companionMinimumAge: null,
    provisional: false,
    restricted: true,
    identificationRequired: true,
    guidance: Object.freeze({
      en: "Guests under 21 are not admitted, even with a parent. Identification and proof of age may be required.",
      ar: "لا يسمح بدخول من هم دون 21 سنة حتى برفقة ولي الأمر، وقد تطلب الهوية وإثبات العمر.",
    }),
  }),
  "18TC": Object.freeze({
    code: "18TC",
    category: "provisional_restricted",
    minimumAge: 18,
    companionMinimumAge: null,
    provisional: true,
    restricted: true,
    identificationRequired: true,
    guidance: Object.freeze({
      en: "18TC means the final rating is pending. It is provisionally treated as 18+, so guests under 18 are not admitted. Tickets should be treated as non-refundable under the published VOX guidance.",
      ar: "يعني تصنيف 18TC أن التصنيف النهائي قيد الاعتماد. ويعامل مؤقتاً كتصنيف +18، لذلك لا يسمح بدخول من هم دون 18 سنة. وتعد التذاكر غير قابلة للاسترداد وفق إرشادات ڤوكس المنشورة.",
    }),
  }),
});

export function ratingPolicyForCode(value) {
  const code = normalizeMovieRating(value);
  const policy = code ? POLICY[code] : null;
  return Object.freeze({
    code: policy?.code || null,
    kind: policy?.category || "unknown",
    minimumAge: policy?.minimumAge ?? null,
    accompanimentAge: policy?.companionMinimumAge ?? null,
    provisional: Boolean(policy?.provisional),
  });
}

export function evaluateMovieAdmission(options = {}) {
  const input = options && typeof options === "object" && !Array.isArray(options)
    ? options
    : { rating: options };
  const policy = ratingPolicyForCode(input.rating ?? input.code);
  const details = policy.code ? POLICY[policy.code] : null;
  const candidateAge = input.viewerAge ?? input.age;
  const viewerAge = candidateAge === null || candidateAge === undefined || candidateAge === "" ? null : Number(candidateAge);
  if (!policy.code) {
    return Object.freeze({
      status: "unknown",
      allowed: null,
      requiresAccompaniment: false,
      reason: "rating_unavailable",
    });
  }
  if (policy.code === "G" || policy.code === "PG") {
    return Object.freeze({
      status: "allowed",
      allowed: true,
      requiresAccompaniment: false,
      reason: policy.code === "PG" ? "parental_guidance" : "general_admission",
    });
  }
  if (!Number.isFinite(viewerAge) || viewerAge < 0 || viewerAge > 120) {
    return Object.freeze({
      status: "age_required",
      allowed: null,
      requiresAccompaniment: false,
      reason: "viewer_age_required",
    });
  }
  if (details.restricted) {
    const allowed = viewerAge >= policy.minimumAge;
    return Object.freeze({
      status: allowed ? "allowed" : "not_allowed",
      allowed,
      requiresAccompaniment: false,
      reason: allowed ? "minimum_age_met" : "below_minimum_age",
    });
  }
  if (policy.accompanimentAge != null && viewerAge <= policy.accompanimentAge) {
    return Object.freeze({
      status: "requires_accompaniment",
      allowed: true,
      requiresAccompaniment: true,
      reason: "age_requires_accompaniment",
    });
  }
  return Object.freeze({
    status: "allowed",
    allowed: true,
    requiresAccompaniment: false,
    reason: "accompaniment_not_required",
  });
}

function asMovie(value) {
  if (!value || typeof value !== "object") return null;
  const title = clean(value.title ?? value.Title ?? value.movieTitle ?? value.name ?? value.Name);
  if (!title) return null;
  return {
    ...value,
    id: value.id ?? value.ScheduledFilmId ?? value.movieId ?? null,
    title,
    rating: normalizeMovieRating(value.rating ?? value.Rating ?? value.movieRating),
    language: clean(value.language ?? value.LanguageName ?? value.Language),
    runtime: Number(value.runtime ?? value.RunTime) || 0,
  };
}

function moviesFromStage(stage) {
  if (!stage || typeof stage !== "object") return [];
  const values = [
    ...(Array.isArray(stage.movies) ? stage.movies : []),
    stage.movie,
    stage.order ? { id: stage.order.movieId, title: stage.order.movieTitle, rating: stage.order.movieRating } : null,
    stage.booking ? { id: stage.booking.movieId, title: stage.booking.movieTitle, rating: stage.booking.movieRating } : null,
  ];
  return values.map(asMovie).filter(Boolean);
}

function pausedStageMovies(paused) {
  if (!paused || typeof paused !== "object") return [];
  const stages = [paused.stage, paused.snapshot, paused.pausedStage];
  if (paused.entries && typeof paused.entries === "object") {
    for (const entry of Object.values(paused.entries)) stages.push(entry?.snapshot, entry?.stage);
  }
  return stages.flatMap(moviesFromStage);
}

function editDistance(left, right) {
  const a = [...left];
  const b = [...right];
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

const MOVIE_REFERENCE_CONNECTORS = new Set(["a", "an", "and", "of", "the"]);
const MOVIE_REFERENCE_BLOCKLIST = new Set([
  "action", "adventure", "animation", "arabic", "certificate", "child", "children", "comedy",
  "drama", "english", "family", "film", "french", "genre", "hindi", "horror", "kids", "language",
  "malayalam", "movie", "rating", "runtime", "score", "showtime", "subtitles", "tamil", "telugu",
  "tonight", "tomorrow", "trailer", "urdu",
]);

const normalizedMovieReferenceText = (value) => normalizedText(String(value || "").replace(/&/g, " and "));

// Full information questions contain verbs and intent words that are not movie
// titles. Keep those words out of edit-distance matching so, for example,
// "take" cannot be treated as a voice typo for the official title "Wake".
// Explicit movieTitle inputs still use the original token set below.
const MOVIE_INFORMATION_QUESTION_FILLERS = new Set([
  "a", "about", "actor", "actors", "actress", "actresses", "age", "aged", "all", "allowed", "an", "and",
  "appropriate", "are", "bring", "can", "captions", "cast", "certificate", "classification", "could", "daughter",
  "details", "do", "does", "duration", "film", "for", "genre", "genres", "good", "guest", "have", "how", "i",
  "imdb", "in", "information", "is", "it", "its", "kid", "kids", "language", "languages", "long", "may", "me",
  "might", "movie", "my", "of", "old", "our", "parent", "please", "plot", "rating", "rated", "release",
  "released", "review", "runtime", "score", "see", "should", "show", "someone", "son", "stars", "story",
  "storyline", "subtitles", "suitable", "summary", "take", "tell", "that", "the", "this", "to", "trailer",
  "watch", "was", "we", "what", "when", "which", "who", "with", "worth", "would", "year", "years", "you",
  "your",
  "\u0647\u0644", "\u064a\u0645\u0643\u0646", "\u064a\u0645\u0643\u0646\u0646\u064a", "\u0627\u0633\u062a\u0637\u064a\u0639",
  "\u0627\u0635\u0637\u062d\u0627\u0628", "\u0627\u062e\u0630", "\u0637\u0641\u0644", "\u0637\u0641\u0644\u064a",
  "\u0627\u0637\u0641\u0627\u0644", "\u0627\u0628\u0646\u064a", "\u0628\u0646\u062a\u064a", "\u0627\u0628\u0646\u062a\u064a",
  "\u0639\u0645\u0631", "\u0639\u0645\u0631\u0647", "\u0639\u0645\u0631\u0647\u0627", "\u0633\u0646\u0629", "\u0633\u0646\u0648\u0627\u062a",
  "\u0639\u0627\u0645", "\u0627\u0639\u0648\u0627\u0645", "\u0645\u0634\u0627\u0647\u062f\u0629", "\u0627\u0634\u0627\u0647\u062f",
  "\u0627\u0644\u0641\u064a\u0644\u0645", "\u0641\u064a\u0644\u0645", "\u0645\u0646\u0627\u0633\u0628", "\u0645\u0633\u0645\u0648\u062d",
  "\u0627\u0644\u0649", "\u0645\u0639", "\u0647\u0630\u0627", "\u0647\u0630\u0647", "\u0645\u0627", "\u0645\u0646", "\u0641\u064a", "\u0639\u0646",
  "\u0627\u0644\u062a\u0635\u0646\u064a\u0641", "\u0627\u0644\u0639\u0645\u0631\u064a", "\u0627\u0644\u062a\u0642\u064a\u064a\u0645", "\u062a\u0642\u064a\u064a\u0645",
  "\u0644\u063a\u0629", "\u0645\u062f\u0629", "\u0642\u0635\u0629", "\u0646\u0648\u0639", "\u062a\u0631\u062c\u0645\u0629", "\u0627\u0639\u0644\u0627\u0646",
  "\u0627\u0635\u062f\u0627\u0631", "\u062a\u0641\u0627\u0635\u064a\u0644",
  ...Object.keys(ENGLISH_NUMBER_WORDS),
  ...Object.keys(ARABIC_NUMBER_WORDS),
].flatMap((value) => normalizedMovieReferenceText(value).split(" ")).filter(Boolean));

function movieInformationQuestionTokens(value) {
  return normalizedMovieReferenceText(value).split(" ").filter((token) => (
    token.length >= 3
    && !/^\d+$/u.test(token)
    && !MOVIE_INFORMATION_QUESTION_FILLERS.has(token)
  ));
}

function distinctiveMovieTitleTokens(value) {
  return normalizedMovieReferenceText(value).split(" ").filter((token) => (
    token.length >= 4
    && !MOVIE_REFERENCE_CONNECTORS.has(token)
    && !MOVIE_REFERENCE_BLOCKLIST.has(token)
  ));
}

function partialMovieReferences(movies, text) {
  const query = normalizedMovieReferenceText(text);
  if (!query) return [];
  const entries = movies.map((movie) => {
    const title = normalizedMovieReferenceText(movie.title);
    const matched = distinctiveMovieTitleTokens(title).filter((token) => ` ${query} `.includes(` ${token} `));
    return {
      movie,
      title,
      matched,
      score: matched.reduce((total, token) => total + token.length, 0),
    };
  }).filter(({ matched }) => matched.length > 0)
    .sort((left, right) => right.matched.length - left.matched.length || right.score - left.score || right.title.length - left.title.length);
  if (!entries.length) return [];
  const best = entries[0];
  return entries.filter((entry) => entry.matched.length === best.matched.length && entry.score === best.score);
}

function fuzzyMovieFromQuestion(movies, text, options = {}) {
  const query = normalizedText(text);
  if (!query) return null;
  const exact = movies.filter((movie) => {
    const title = normalizedText(movie.title);
    return title && (` ${query} `.includes(` ${title} `) || query === title);
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact.sort((left, right) => right.title.length - left.title.length)[0];

  const queryTokens = options.informationQuestion
    ? movieInformationQuestionTokens(query)
    : query.split(" ").filter(Boolean);
  if (!queryTokens.length) return null;
  const ranked = movies.map((movie) => {
    const titleTokens = normalizedText(movie.title).split(" ").filter(Boolean);
    if (!titleTokens.length) return { movie, matched: 0, distance: Infinity };
    let distance = 0;
    let matched = 0;
    for (const titleToken of titleTokens) {
      const best = queryTokens.reduce((score, token) => Math.min(score, editDistance(titleToken, token)), Infinity);
      const permitted = titleToken.length >= 8 ? 2 : titleToken.length >= 4 ? 1 : 0;
      if (best <= permitted) {
        matched += 1;
        distance += best;
      }
    }
    return { movie, matched, distance, coverage: matched / titleTokens.length };
  }).filter((item) => item.coverage >= 0.75)
    .sort((left, right) => right.coverage - left.coverage || left.distance - right.distance || right.movie.title.length - left.movie.title.length);
  if (!ranked.length) return null;
  const first = ranked[0];
  const second = ranked[1];
  if (second && first.coverage === second.coverage && first.distance === second.distance) return null;
  return first.movie;
}

export function resolveMovieForInformationQuestion(options = {}) {
  const input = typeof options === "string" ? { query: options } : options || {};
  const text = input.query ?? input.text ?? "";
  const stage = input.stage || null;
  const currentMovie = asMovie(input.currentMovie || stage?.movie);
  const pausedMovie = asMovie(input.pausedMovie || input.pausedStage?.movie || input.pausedJourney?.movie);
  const entries = [];
  const seen = new Set();
  const addMovies = (values, source) => {
    for (const value of values) {
      const movie = asMovie(value);
      if (!movie) continue;
      const key = normalizedText(movie.id || movie.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      entries.push({ movie, source });
    }
  };
  addMovies([
    currentMovie,
    stage?.order ? { id: stage.order.movieId, title: stage.order.movieTitle, rating: stage.order.movieRating } : null,
    stage?.booking ? { id: stage.booking.movieId, title: stage.booking.movieTitle, rating: stage.booking.movieRating } : null,
  ], "current");
  addMovies([
    ...(Array.isArray(stage?.movies) ? stage.movies : []),
    ...(Array.isArray(input.visibleMovies) ? input.visibleMovies : []),
    ...(Array.isArray(input.movies) ? input.movies : []),
  ], "visible");
  addMovies([pausedMovie, ...pausedStageMovies(input.pausedStage), ...pausedStageMovies(input.pausedJourney)], "paused");
  const movies = entries.map((entry) => entry.movie);
  const resultForMovie = (movie) => {
    const entry = entries.find((candidate) => {
      if (movie?.id && candidate.movie.id) return normalizedText(movie.id) === normalizedText(candidate.movie.id);
      return normalizedText(movie?.title) === normalizedText(candidate.movie.title);
    });
    return Object.freeze({ movie: entry?.movie || null, source: entry?.source || null, ambiguous: false, candidates: entry?.movie ? [entry.movie] : [] });
  };
  if (!movies.length) return Object.freeze({ movie: null, source: null, ambiguous: false, candidates: [] });

  const explicitTitle = clean(input.movieTitle || input.movieId);
  if (explicitTitle) {
    const explicit = resolveFilmCandidate(movies, explicitTitle) || fuzzyMovieFromQuestion(movies, explicitTitle);
    if (explicit) return resultForMovie(explicit);
  }

  const fromQuestion = fuzzyMovieFromQuestion(movies, text, { informationQuestion: true });
  if (fromQuestion) return resultForMovie(fromQuestion);
  // Partial catalog grounding is a separate pre-routing layer. The protected
  // fuzzy resolver above remains unchanged.
  const partialCandidates = partialMovieReferences(movies, text).map((entry) => entry.movie);
  if (partialCandidates.length === 1) return resultForMovie(partialCandidates[0]);
  if (partialCandidates.length > 1) {
    return Object.freeze({ movie: null, source: null, ambiguous: true, candidates: partialCandidates });
  }
  if (currentMovie && CURRENT_REFERENCE_PATTERN.test(String(text))) return resultForMovie(currentMovie);
  if (pausedMovie && CURRENT_REFERENCE_PATTERN.test(String(text))) return resultForMovie(pausedMovie);
  if (movies.length === 1) return resultForMovie(movies[0]);
  return Object.freeze({ movie: null, source: null, ambiguous: true, candidates: [] });
}

function sessionTimes(sessions) {
  const times = [];
  const values = Array.isArray(sessions) ? sessions : sessions ? [sessions] : [];
  for (const session of values) {
    const raw = clean(session?.time ?? session?.showtime ?? session?.Showtime);
    const time = raw.match(/(?:T|^)(\d{1,2}:\d{2})(?::\d{2})?/)?.[1] || raw.match(/^\d{1,2}:\d{2}$/)?.[0];
    if (time && !times.includes(time)) times.push(time);
  }
  return times.slice(0, 4);
}

function sessionMovieKeys(session) {
  return [
    session?.movieId,
    session?.scheduledFilmId,
    session?.ScheduledFilmId,
    session?.filmId,
    session?.movie?.id,
    session?.movie?.ScheduledFilmId,
  ].map(normalizedText).filter(Boolean);
}

function relevantSessionsForMovie(movie, sessions) {
  const values = Array.isArray(sessions) ? sessions : sessions ? [sessions] : [];
  const movieKeys = [movie?.id, movie?.ScheduledFilmId, movie?.movieId].map(normalizedText).filter(Boolean);
  if (!movieKeys.length) return values;
  return values.filter((session) => {
    const sessionKeys = sessionMovieKeys(session);
    return !sessionKeys.length || sessionKeys.some((key) => movieKeys.includes(key));
  });
}

function pausedSessions(paused) {
  if (!paused || typeof paused !== "object") return [];
  const stages = [paused, paused.stage, paused.snapshot, paused.pausedStage];
  if (paused.entries && typeof paused.entries === "object") {
    for (const entry of Object.values(paused.entries)) stages.push(entry?.snapshot, entry?.stage);
  }
  return stages.flatMap((stage) => Array.isArray(stage?.sessions) ? stage.sessions : stage?.session ? [stage.session] : []);
}

function admissionSentence(admission, title, locale, age, policy) {
  if (locale === "ar") {
    if (admission.status === "not_allowed") return `لا يسمح بدخول ضيف بعمر ${age} سنة إلى ${title} حتى برفقة ولي الأمر.`;
    if (admission.status === "requires_accompaniment") return `يمكن لضيف بعمر ${age} سنة حضور ${title} فقط برفقة شخص عمره ${policy.accompanimentAge} سنة أو أكثر.`;
    if (admission.status === "allowed") return age == null ? "" : `يسمح لضيف بعمر ${age} سنة بالحضور وفق قاعدة هذا التصنيف.`;
    return "";
  }
  if (admission.status === "not_allowed") return `A guest aged ${age} cannot be admitted to ${title}, even with a parent.`;
  if (admission.status === "requires_accompaniment") return `A guest aged ${age} may attend ${title} only with someone aged ${policy.accompanimentAge} or older.`;
  if (admission.status === "allowed") return age == null ? "" : `A guest aged ${age} may attend under this rating rule.`;
  return "";
}

function focusedPolicyGuidance(policy, admission, locale, viewerAge) {
  const details = policy.code ? POLICY[policy.code] : null;
  if (!details) return "";
  if (viewerAge == null || admission.status === "age_required") return details.guidance[locale];
  if (policy.code === "PG13" || policy.code === "PG15") {
    return localeValue(
      locale,
      `A parent or guardian should still decide whether the content is suitable for a guest aged ${viewerAge}.`,
      `يبقى على الوالدين أو ولي الأمر تحديد ما إذا كان المحتوى مناسباً لضيف بعمر ${viewerAge} سنة.`,
    );
  }
  if (policy.kind === "restricted") {
    return localeValue(
      locale,
      "Identification and proof of age may be required.",
      "قد تطلب الهوية وإثبات العمر.",
    );
  }
  if (policy.kind === "provisional_restricted") return details.guidance[locale];
  return details.guidance[locale];
}

export function buildMovieRatingAnswer(options = {}) {
  const input = typeof options === "string" ? { rating: options } : options || {};
  const locale = input.locale === "ar" ? "ar" : "en";
  const movie = asMovie(input.movie) || (input.movieTitle ? asMovie({ title: input.movieTitle, rating: input.rating }) : null);
  const title = movie?.title || clean(input.movieTitle) || localeValue(locale, "this movie", "هذا الفيلم");
  const rating = normalizeMovieRating(input.rating ?? movie?.rating);
  const query = input.query ?? input.text ?? "";
  const viewerAge = input.viewerAge ?? input.age ?? extractViewerAge(query);
  const meaning = input.meaning || resolveRatingMeaning(query);

  if (meaning === "review") {
    const noScore = localeValue(
      locale,
      `I do not have a verified review score for ${title}, so I will not invent one.`,
      `لا يتوفر لدي تقييم نقدي موثق لفيلم ${title}، لذلك لن أذكر تقييماً غير موثق.`,
    );
    return clean(rating
      ? `${noScore} ${localeValue(locale, `Its VOX age rating is ${rating}.`, `تصنيفه العمري لدى ڤوكس هو ${rating}.`)}`
      : noScore);
  }

  if (meaning === "ambiguous" && viewerAge == null) {
    return clean(localeValue(
      locale,
      `Do you mean the VOX age rating for ${title}, or a review score? I will not invent a review score.`,
      `هل تقصد التصنيف العمري لدى ڤوكس لفيلم ${title}، أم تقييماً نقدياً؟ لن أذكر تقييماً نقدياً غير موثق.`,
    ));
  }

  const policy = ratingPolicyForCode(rating);
  const admission = evaluateMovieAdmission({ rating, viewerAge, experience: input.experience });
  if (!policy.code) {
    return clean(localeValue(
      locale,
      `The current VOX listing does not provide a verified age rating for ${title}. I cannot confirm child admission without a verified rating.`,
      `لا تعرض قائمة ڤوكس الحالية تصنيفاً عمرياً موثقاً لفيلم ${title}. لا يمكنني تأكيد دخول طفل من دون تصنيف موثق.`,
    ));
  }

  const opening = localeValue(locale, `${title} is rated ${policy.code}.`, `تصنيف فيلم ${title} هو ${policy.code}.`);
  const admissionDetail = admissionSentence(admission, title, locale, viewerAge, policy);
  const policyDetail = focusedPolicyGuidance(policy, admission, locale, viewerAge);
  const times = sessionTimes(relevantSessionsForMovie(movie, input.sessions ?? input.session ?? input.showtimes));
  const cinemaName = clean(input.cinemaName);
  const date = clean(input.date);
  const whereAndWhen = [cinemaName, date].filter(Boolean).join(locale === "ar" ? "، " : ", ");
  const timeDetail = times.length
    ? localeValue(
      locale,
      `${whereAndWhen ? `For ${whereAndWhen}, the current listed showtimes are` : "Current listed showtimes are"} ${times.join(", ")}.`,
      `${whereAndWhen ? `في ${whereAndWhen}، مواعيد العرض الحالية المدرجة هي` : "مواعيد العرض الحالية المدرجة هي"} ${times.join("، ")}.`,
    )
    : "";
  return clean([opening, admissionDetail, policyDetail, timeDetail].filter(Boolean).join(" "));
}

export function buildAuthoritativeMovieRatingContext(options = {}) {
  const input = options || {};
  const query = input.query ?? input.text ?? "";
  const resolution = input.movie
    ? { movie: asMovie(input.movie), source: "provided", ambiguous: false }
    : resolveMovieForInformationQuestion({ ...input, query });
  const movie = resolution.movie;
  const viewerAge = input.viewerAge ?? input.age ?? extractViewerAge(query);
  const meaning = input.meaning || resolveRatingMeaning(query);
  const suppliedSessions = input.sessions ?? input.session ?? input.showtimes;
  const contextualSessions = suppliedSessions
    ?? input.stage?.sessions
    ?? input.stage?.session
    ?? pausedSessions(input.pausedStage)
    ?? [];
  const relevantSessions = relevantSessionsForMovie(movie, contextualSessions);
  const answer = input.answer || buildMovieRatingAnswer({ ...input, movie, viewerAge, meaning, sessions: relevantSessions });
  const policy = ratingPolicyForCode(movie?.rating ?? input.rating);
  const admission = evaluateMovieAdmission({ rating: policy.code, viewerAge, experience: input.experience });
  const facts = {
    movieId: movie?.id || null,
    movieTitle: movie?.title || null,
    rating: policy.code,
    viewerAge: Number.isFinite(Number(viewerAge)) ? Number(viewerAge) : null,
    admissionStatus: admission.status,
    allowed: admission.allowed,
    requiresAccompaniment: admission.requiresAccompaniment,
    accompanimentAge: policy.accompanimentAge,
    provisional: policy.provisional,
    meaning,
    movieSource: resolution.source,
    movieAmbiguous: resolution.ambiguous,
    showtimes: sessionTimes(relevantSessions),
    cinemaName: clean(input.cinemaName) || null,
    date: clean(input.date) || null,
  };
  return normalizeCustomerFacingText([
    `AUTHORITATIVE MOVIE RATING FACTS: ${JSON.stringify(facts)}`,
    `Authoritative customer answer: ${answer}`,
    "Speak the authoritative customer answer exactly once. Do not invent a review score, do not tell the guest to check the rating elsewhere, do not treat a KIDS auditorium as an age certificate, and do not restart or advance the booking unless the guest asks.",
  ].join("\n"));
}
