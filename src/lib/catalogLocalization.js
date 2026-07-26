const ARABIC_CATALOG_VALUES = Object.freeze({
  action: "الحركة",
  adventure: "المغامرات",
  animation: "الرسوم المتحركة",
  arabic: "العربية",
  comedy: "الكوميديا",
  crime: "الجريمة",
  documentary: "الوثائقي",
  drama: "الدراما",
  english: "الإنجليزية",
  family: "العائلي",
  fantasy: "الفانتازيا",
  french: "الفرنسية",
  hindi: "الهندية",
  horror: "الرعب",
  malayalam: "المالايالامية",
  romance: "الرومانسية",
  "sci-fi": "الخيال العلمي",
  tamil: "التاميلية",
  telugu: "التيلوغوية",
  thriller: "الإثارة",
  urdu: "الأردية",
});

const ARABIC_CINEMA_NAMES = Object.freeze({
  burjuman: "برجمان",
  "city centre deira": "سيتي سنتر ديرة",
  "city centre mirdif": "سيتي سنتر مردف",
  "mall of the emirates": "مول الإمارات",
});

const normalizedKey = (value) => String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en");

export function localizeCatalogValue(value, locale = "en") {
  const text = String(value || "").trim();
  if (!text || locale !== "ar") return text;
  return ARABIC_CATALOG_VALUES[normalizedKey(text)] || text;
}

export function localizeCinemaName(value, locale = "en") {
  const text = String(value || "").trim();
  if (!text || locale !== "ar") return text;
  const prefix = text.match(/^VOX\s*[\u2013\u2014-]?\s*/iu)?.[0] || "";
  const bareName = text.slice(prefix.length).trim();
  const localized = ARABIC_CINEMA_NAMES[normalizedKey(bareName)] || bareName;
  return prefix ? `${prefix}${localized}` : localized;
}
