const DISCOVERY_QUESTIONS = Object.freeze({
  en: Object.freeze({
    cinema: "Which VOX Cinemas UAE location would you like?",
    date: "What date would you like to go?",
    unsupported_language_afghan: "Do you mean Afghan-produced movies, Dari-language movies, or Pashto-language movies?",
    educational: "Educational is not a published VOX movie genre. Would you like Documentary, or should I continue with your other preferences without an educational filter?",
    preference: "What would you prefer? You can name a movie, time, genre, language, cinema experience, or family choice.",
  }),
  ar: Object.freeze({
    cinema: "أي موقع من VOX Cinemas UAE تفضّل؟",
    date: "ما التاريخ الذي تفضّله؟",
    unsupported_language_afghan: "هل تقصد أفلاماً أفغانية الإنتاج، أم أفلاماً باللغة الدارية، أم باللغة البشتوية؟",
    educational: "التعليمي ليس نوعاً منشوراً في جدول VOX. هل تقصد الأفلام الوثائقية، أم تريد المتابعة بتفضيلاتك الأخرى من دون فلتر تعليمي؟",
    preference: "ما الذي تفضّله؟ يمكنك ذكر فيلم أو وقت أو نوع أو لغة أو تجربة سينمائية أو أفلام عائلية.",
  }),
});

export function discoveryQuestionForLocale(missing, locale = "en") {
  const language = locale === "ar" ? "ar" : "en";
  const field = Array.isArray(missing) ? missing[0] : missing;
  return DISCOVERY_QUESTIONS[language][field] || DISCOVERY_QUESTIONS[language].preference;
}

export function localizeDiscoveryStage(stage, locale = "en") {
  if (!stage || stage.view !== "discovery" || !stage.missing?.length) return stage;
  const question = discoveryQuestionForLocale(stage.missing, locale);
  return stage.question === question ? stage : { ...stage, question };
}

export function localizedStageMessage(stage, field, locale = "en") {
  if (!stage || !["notice", "error"].includes(field)) return "";
  const language = locale === "ar" ? "ar" : "en";
  const localized = stage[`${field}ByLocale`];
  if (localized && typeof localized === "object") {
    return localized[language] || localized.en || localized.ar || "";
  }
  return stage[field] || "";
}
