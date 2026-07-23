const MOVIE_INFORMATION_PATTERN = /\b(?:ratings?|rated|certificates?|classification|review|score|stars?|imdb|rotten\s+tomatoes|year[ -]?old|child|kid|suitable|appropriate|synopsis|plot|story|storyline|what happens|movie summary|film summary|summary of|what(?:'s| is) .{1,80} about|language|subtitles?|runtime|duration|how long|genre|cast|actors?|actress|starring|trailer|preview|teaser|release date|released|premiere date|come out|tell me about|more about|information about|details about|movie details|film details)\b|(?:تصنيف|التصنيف|التصنيفات|تقييم|التقييمات|مراجعة|نجوم|طفل|اطفال|أطفال|ابني|ابنتي|مناسب|قصة|قصه|ملخص|عن ماذا|عن شو|احداث الفيلم|أحداث الفيلم|لغة (?:ال)?فيلم|لغه (?:ال)?فيلم|ترجمة|ترجمه|(?:مدة|مده)(?: الفيلم| فيلم)?|كم دقيقة|كم دقيقه|نوع الفيلم|طاقم التمثيل|الممثل|الممثلة|الممثله|اعلان الفيلم|إعلان الفيلم|تاريخ العرض|تاريخ الاصدار|تاريخ الإصدار|معلومات عن|تفاصيل الفيلم|تفاصيل عن)/iu;
const STRONG_TRANSACTION_PATTERN = /^(?:please\s+)?(?:(?:book|reserve|buy|purchase)|(?:(?:can|could|would|will)\s+you|(?:can|could|may)\s+i|i(?:'d| would)?\s+like\s+to|i\s+(?:want|need)\s+to|(?:where|how)\s+(?:can|could|do)\s+i)\s+(?:book|reserve|buy|purchase))\b|^(?:من فضلك\s+)?(?:احجز|أحجز|اشتري|أشتري|(?:أريد|اريد|أحتاج|احتاج)\s+(?:أن\s+)?(?:أحجز|احجز|أشتري|اشتري))\b/iu;
const TRANSACTION_LEAD_PATTERN = /^(?:please\s+)?(?:(?:(?:can|could|would|will)\s+you\s+)?(?:find|list|suggest|recommend|show(?:\s+me)?|help\s+me\s+(?:find|choose)|let\s+me\s+(?:watch|see))|(?:i(?:'d| would)?\s+like|i\s+(?:want|need)|i(?:'m| am)\s+looking|looking)\b|(?:can|could|may)\s+i\s+(?:watch|see)|(?:اعرض|أعرض|ابحث|أبحث|اقترح|أقترح|رشح|أريد|اريد|أحتاج|احتاج))/iu;
const DIRECT_INFORMATION_OBJECT_PATTERN = /^(?:please\s+)?(?:(?:show|give|tell|explain|find)\s+(?:me\s+)?(?:a|an|the)?\s*|(?:i(?:'d| would)?\s+like|i\s+(?:want|need))\s+(?:to\s+know\s+)?(?:a|an|the)?\s*|(?:i(?:'m| am)\s+looking|looking)\s+for\s+(?:a|an|the)?\s*)(?:ratings?|certificates?|classification|review(?:\s+score)?|score|stars?|synopsis|plot|story|storyline|summary|language|subtitles?|runtime|duration|genre|cast|trailer|release date|information|details)(?:\s+(?:of|for|about)\b|$)|^(?:please\s+)?(?:(?:i(?:'d| would)?\s+like|i\s+(?:want|need))\s+to\s+know\s+|(?:tell|explain)\s+(?:me\s+)?)(?:how\s+long|what\s+(?:language|genre|rating|certificate|classification))\b|^(?:أريد|اريد|أحتاج|احتاج|اعرض|أعرض)\s+(?:معرفة\s+)?(?:تصنيف|تقييم|مراجعة|قصة|قصه|ملخص|لغة|لغه|ترجمة|ترجمه|مدة|مده|نوع|طاقم|إعلان|اعلان|معلومات|تفاصيل)(?:\s+(?:عن|ل)\b|$)/iu;
const POLITE_INFORMATION_REQUEST_PATTERN = /^(?:please\s+)?(?:(?:(?:can|could|would|will)\s+you\s+)?(?:show|give|tell|explain|find|play)\s+(?:me\s+)?|(?:(?:can|could|may)\s+i|i(?:'d| would)?\s+like|i\s+(?:want|need))\s+(?:to\s+)?(?:know|watch|see|read)\s+)(?:a|an|the)?\s*(?:ratings?|certificates?|classification|review(?:\s+score)?|score|stars?|synopsis|plot|story|storyline|summary|language|subtitles?|runtime|duration|genre|cast|trailer|preview|teaser|release date|information|details|how\s+long|what\s+(?:language|genre|rating|certificate|classification))\b/iu;

const DIRECT_TRANSACTION_CONTINUATION_PATTERN = /^(?:please\s+)?(?:cancel|refund|void|choose|select|pick)\b|^(?:please\s+)?i\s+(?:choose|select|pick)\b|^(?:please\s+)?i\s+(?:want|need|would\s+like)\s+to\s+(?:cancel|refund|void|choose|select|pick)\b/iu;

export function isExplicitMovieTransactionTurn(value) {
  const text = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:،؟]+$/u, "");
  if (!text) return false;
  if (STRONG_TRANSACTION_PATTERN.test(text)) return true;
  if (DIRECT_TRANSACTION_CONTINUATION_PATTERN.test(text)) return true;
  if (DIRECT_INFORMATION_OBJECT_PATTERN.test(text) || POLITE_INFORMATION_REQUEST_PATTERN.test(text)) return false;
  return TRANSACTION_LEAD_PATTERN.test(text);
}

export function isPotentialMovieInformationTurn(value) {
  const text = String(value || "");
  return !isExplicitMovieTransactionTurn(text) && MOVIE_INFORMATION_PATTERN.test(text);
}
