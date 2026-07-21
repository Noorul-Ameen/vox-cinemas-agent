const SUPPORTED_AGENT_LANGUAGES = new Set(["en", "ar"]);

export function agentLanguageForLocale(locale) {
  const value = String(locale || "").trim().toLowerCase();
  return SUPPORTED_AGENT_LANGUAGES.has(value) ? value : "en";
}

export function conversationSessionOverrides(locale, { textOnly = false } = {}) {
  return {
    agent: { language: agentLanguageForLocale(locale) },
    ...(textOnly ? { conversation: { textOnly: true } } : {}),
  };
}
