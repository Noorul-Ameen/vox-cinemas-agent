import { normalizeCinemaText, resolveCinemaCandidate } from "./cinemaRouting.js";

const CITY_CINEMA_IDS = Object.freeze({
  dubai: ["0002", "0049", "0007", "0013", "0057", "0005", "0105", "0001", "0015", "0017", "0045"],
  "abu dhabi": ["0046", "0104", "0036", "0014", "0012"],
  sharjah: ["0055", "0035"],
  ajman: ["0004"],
  fujairah: ["0006"],
  "ras al khaimah": ["0009"],
  "al ain": ["0039"],
});

const CITY_RULES = Object.freeze([
  { key: "ras al khaimah", label: "Ras Al Khaimah", aliases: ["ras al khaimah", "ras al-khaimah", "rak", "راس الخيمة"] },
  { key: "abu dhabi", label: "Abu Dhabi", aliases: ["abu dhabi", "أبو ظبي", "ابو ظبي", "أبوظبي", "ابوظبي"] },
  { key: "al ain", label: "Al Ain", aliases: ["al ain", "al-ain", "العين"] },
  { key: "sharjah", label: "Sharjah", aliases: ["sharjah", "الشارقة"] },
  { key: "fujairah", label: "Fujairah", aliases: ["fujairah", "الفجيرة"] },
  { key: "ajman", label: "Ajman", aliases: ["ajman", "عجمان"] },
  { key: "dubai", label: "Dubai", aliases: ["dubai", "دبي"] },
]);

const UNSUPPORTED_VENUE_RULES = Object.freeze([
  { key: "abu_dhabi_marina_mall", label: "Marina Mall Abu Dhabi", aliases: ["abu dhabi marina mall", "marina mall abu dhabi", "مارينا مول أبوظبي", "مارينا مول ابوظبي"], cinemaIds: ["0014", "0036", "0046"] },
  { key: "dubai_mall", label: "Dubai Mall", aliases: ["dubai mall", "the dubai mall", "دبي مول", "مول دبي"], cinemaIds: ["0007", "0013", "0057"] },
  { key: "ibn_battuta", label: "Ibn Battuta Mall", aliases: ["ibn battuta", "ibn battuta mall", "ابن بطوطة", "مول ابن بطوطة"], cinemaIds: ["0049", "0002"] },
  { key: "roxy_boxpark", label: "Roxy Cinemas Boxpark", aliases: ["roxy cinemas boxpark", "roxy cinema boxpark", "roxy boxpark", "boxpark cinema", "روكسي بوكس بارك"], cinemaIds: ["0007", "0013", "0057"] },
]);

const AREA_RULES = Object.freeze([
  { key: "dubai_marina", label: "Dubai Marina", aliases: ["dubai marina", "jbr", "bluewaters", "دبي مارينا", "مرسى دبي", "جي بي ار"], cinemaIds: ["0049", "0002", "0007"] },
  { key: "downtown_dubai", label: "Downtown Dubai", aliases: ["downtown dubai", "business bay", "city walk", "وسط مدينة دبي", "الخليج التجاري", "سيتي ووك"], cinemaIds: ["0007", "0013", "0057"] },
  { key: "dubai_hills", label: "Dubai Hills", aliases: ["dubai hills", "al barsha", "barsha", "دبي هيلز", "البرشاء"], cinemaIds: ["0002", "0049", "0007"] },
  { key: "new_dubai", label: "New Dubai", aliases: ["jvc", "jumeirah village circle", "motor city", "sports city", "قرية جميرا", "موتور سيتي", "مدينة دبي الرياضية"], cinemaIds: ["0002", "0049"] },
  { key: "east_dubai", label: "East Dubai", aliases: ["silicon oasis", "dubai silicon oasis", "international city", "واحة دبي للسيليكون", "المدينة العالمية"], cinemaIds: ["0057", "0005", "0105"] },
  { key: "al_quoz", label: "Al Quoz", aliases: ["al quoz", "al-quoz", "القوز"], cinemaIds: ["0002", "0007", "0057"] },
  { key: "karama", label: "Karama", aliases: ["karama", "al karama", "bur dubai", "الكرامة", "بر دبي"], cinemaIds: ["0013", "0057", "0001"] },
  { key: "jumeirah", label: "Jumeirah", aliases: ["jumeirah", "umm suqeim", "um suqeim", "جميرا", "أم سقيم", "ام سقيم"], cinemaIds: ["0007", "0002", "0049"] },
  { key: "al_nahda", label: "Al Nahda", aliases: ["al nahda", "al-nahda", "النهدة"], cinemaIds: ["0001", "0035", "0055"] },
  { key: "mussafah", label: "Mussafah", aliases: ["mussafah", "musaffah", "مصفح"], cinemaIds: ["0012", "0036", "0046"] },
  { key: "khalidiya", label: "Al Khalidiya", aliases: ["khalidiya", "al khalidiya", "الخالدية"], cinemaIds: ["0014", "0036", "0046"] },
  { key: "abu_dhabi_corniche", label: "Abu Dhabi Corniche", aliases: ["abu dhabi corniche", "corniche abu dhabi", "كورنيش أبوظبي", "كورنيش ابوظبي"], cinemaIds: ["0014", "0036", "0046"] },
  { key: "saadiyat", label: "Saadiyat Island", aliases: ["saadiyat", "saadiyat island", "جزيرة السعديات", "السعديات"], cinemaIds: ["0046", "0104", "0036"] },
  { key: "khalifa_city", label: "Khalifa City", aliases: ["khalifa city", "masdar city", "مدينة خليفة", "مدينة مصدر"], cinemaIds: ["0012", "0036"] },
  { key: "umm_al_quwain", label: "Umm Al Quwain", aliases: ["umm al quwain", "umm al-quwain", "uaq", "أم القيوين", "ام القيوين"], cinemaIds: ["0004", "0055", "0009"] },
  { key: "hatta", label: "Hatta", aliases: ["hatta", "حتا"], cinemaIds: ["0006", "0055", "0004"] },
  { key: "east_coast", label: "UAE East Coast", aliases: ["khor fakkan", "khorfakkan", "kalba", "خورفكان", "خور فكان", "كلباء"], cinemaIds: ["0006"] },
]);

const OUTSIDE_UAE_RULES = Object.freeze([
  { key: "qatar", label: "Qatar", aliases: ["qatar", "doha", "قطر", "الدوحة"] },
  { key: "saudi_arabia", label: "Saudi Arabia", aliases: ["saudi arabia", "riyadh", "jeddah", "السعودية", "الرياض", "جدة"] },
  { key: "oman", label: "Oman", aliases: ["oman", "muscat", "عمان", "مسقط"] },
  { key: "bahrain", label: "Bahrain", aliases: ["bahrain", "manama", "البحرين", "المنامة"] },
  { key: "kuwait", label: "Kuwait", aliases: ["kuwait", "الكويت"] },
  { key: "united_kingdom", label: "United Kingdom", aliases: ["london", "united kingdom", "uk", "لندن", "المملكة المتحدة"] },
  { key: "india", label: "India", aliases: ["india", "mumbai", "delhi", "الهند", "مومباي", "دلهي"] },
  { key: "united_states", label: "United States", aliases: ["united states", "usa", "new york", "los angeles", "امريكا", "أمريكا", "نيويورك"] },
]);

const NON_LOCATION_CLAUSE = /^(?:arabic|english|hindi|tamil|malayalam|kannada|spanish|korean|عربي|العربية|انجليزي|الانجليزية|هندي|تاميل|action|comedy|drama|horror|thriller|romance|documentary|animation|family|kids|اكشن|كوميدي|دراما|رعب|رومانسي|وثائقي|عائلي|اطفال|imax|4dx|screenx|dolby(?: cinema| atmos)?|دولبي(?: سينما| أتموس)?|private cinema|kids cinema|theatre pods in imax|theater pods in imax|d box|ice immersive|theatre|premier|standard|vip|3d|2d|original|dubbed|subtitled|the morning|morning|the afternoon|afternoon|the evening|evening|night|late night|dinner time)$/iu;
const LOCATION_EVIDENCE = /\b(?:mall|cinemas?|theatres?|theaters?|resort|hotel|park|boxpark|street|road|district|city|town|airport|island|plaza|centre|center|beach)\b|(?:مول|سينما|فندق|منتجع|حديقة|شارع|طريق|منطقة|مدينة|مطار|جزيرة|بلازا|سنتر|شاطئ)/iu;

function genericLocationClause(input) {
  const raw = String(input || "").trim();
  const candidates = [...raw.matchAll(/(?:\b(?:at|near|around|in)\s+|(?:في|قرب|بالقرب من|حول)\s+)([^,?.]{2,80}?)(?=\s+(?:today|tomorrow|tonight|on|at|near|around|for|with|after|before|اليوم|غدا|غداً|الليلة|في|قرب|حوالي|بعد|قبل|مع)\b|[,?.]|$)/giu)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return candidates.find((candidate) => {
    const normalizedCandidate = normalizeCinemaText(candidate);
    return normalizedCandidate
      && !NON_LOCATION_CLAUSE.test(normalizedCandidate)
      && !/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/iu.test(normalizedCandidate)
      && LOCATION_EVIDENCE.test(candidate);
  }) || null;
}

const NEARBY_BY_CINEMA_ID = Object.freeze({
  "0001": ["0015", "0105", "0013", "0057"],
  "0002": ["0049", "0007", "0057", "0013"],
  "0004": ["0055", "0035", "0005"],
  "0005": ["0105", "0057", "0001"],
  "0006": ["0055", "0004"],
  "0007": ["0013", "0057", "0002"],
  "0009": ["0004", "0055"],
  "0012": ["0036", "0046", "0104"],
  "0013": ["0017", "0057", "0007"],
  "0014": ["0036", "0046", "0104"],
  "0015": ["0057", "0001", "0105"],
  "0017": ["0013", "0001", "0057"],
  "0035": ["0055", "0004", "0005"],
  "0036": ["0046", "0104", "0014"],
  "0039": ["0012", "0036"],
  "0045": ["0002", "0049", "0007"],
  "0046": ["0104", "0036", "0014"],
  "0049": ["0002", "0007", "0057"],
  "0055": ["0035", "0004", "0005"],
  "0057": ["0015", "0013", "0105"],
  "0104": ["0046", "0036", "0014"],
  "0105": ["0005", "0057", "0001"],
});

const aliasesMatch = (text, aliases) => aliases
  .map((alias) => normalizeCinemaText(alias))
  .sort((left, right) => right.length - left.length)
  .some((alias) => alias && ` ${text} `.includes(` ${alias} `));

const cinemasForIds = (cinemas, ids = []) => ids
  .map((id) => (cinemas || []).find((cinema) => String(cinema?.id || "") === id))
  .filter(Boolean);

function matchedRule(text, rules) {
  return rules.find((rule) => aliasesMatch(text, rule.aliases));
}

export function resolveLocationIntent(cinemas, input) {
  const text = normalizeCinemaText(input);
  if (!text) return null;

  const unsupportedVenue = matchedRule(text, UNSUPPORTED_VENUE_RULES);
  if (unsupportedVenue) {
    return {
      kind: "unsupported_venue",
      key: unsupportedVenue.key,
      label: unsupportedVenue.label,
      cinema: null,
      cinemas: cinemasForIds(cinemas, unsupportedVenue.cinemaIds),
    };
  }

  const exactCinema = resolveCinemaCandidate(cinemas, input);
  if (exactCinema) return { kind: "exact_cinema", key: String(exactCinema.id), label: exactCinema.name, cinema: exactCinema, cinemas: [exactCinema] };

  const outside = matchedRule(text, OUTSIDE_UAE_RULES);
  if (outside) return { kind: "outside_scope", key: outside.key, label: outside.label, cinema: null, cinemas: [] };

  const area = matchedRule(text, AREA_RULES);
  if (area) return { kind: "area", key: area.key, label: area.label, cinema: null, cinemas: cinemasForIds(cinemas, area.cinemaIds) };

  const raw = String(input || "").trim();
  const venueMatch = raw.match(/(?:\b(?:at|near|around|in)\s+|(?:في|قرب|بالقرب من)\s+)([\p{L}\p{N}' ]{2,60}?(?:mall|centre|center|مول|سنتر))(?=\s*(?:$|today|tomorrow|tonight|on|at|for|in|near|around|اليوم|غدا|الليلة|في))/iu);
  if (venueMatch) {
    const requested = venueMatch[1].trim();
    const requestedText = normalizeCinemaText(requested);
    const requestedCity = matchedRule(text, CITY_RULES) || matchedRule(requestedText, CITY_RULES);
    return {
      kind: "unknown_venue",
      key: requestedText,
      label: requested,
      cinema: null,
      cinemas: requestedCity ? cinemasForIds(cinemas, CITY_CINEMA_IDS[requestedCity.key]).slice(0, 4) : [],
    };
  }

  const city = matchedRule(text, CITY_RULES);
  if (city) return { kind: "city", key: city.key, label: city.label, cinema: null, cinemas: cinemasForIds(cinemas, CITY_CINEMA_IDS[city.key]) };

  const unknownLocation = genericLocationClause(input);
  if (unknownLocation) {
    return {
      kind: "unknown_location",
      key: normalizeCinemaText(unknownLocation),
      label: unknownLocation,
      cinema: null,
      cinemas: [],
    };
  }

  return null;
}

export function nearbyCinemasForCinema(cinemas, cinemaId, limit = 4) {
  return cinemasForIds(cinemas, NEARBY_BY_CINEMA_ID[String(cinemaId || "")]).slice(0, Math.max(0, limit));
}
