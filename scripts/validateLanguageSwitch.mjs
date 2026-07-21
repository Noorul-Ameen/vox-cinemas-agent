import assert from "node:assert/strict";
import { conversationLanguageContinuityContext, explicitLanguageRequest, resolveLanguageSignal, stripLanguageControlCommand } from "../src/lib/languageSwitch.js";
import { extractDiscoveryPreferencePatch } from "../src/lib/discoveryPreferences.js";

assert.equal(explicitLanguageRequest("شكراً"), null, "one Arabic word must not switch English to Arabic");
assert.equal(explicitLanguageRequest("Two tickets لو سمحت"), null, "mixed speech must not switch automatically");
assert.equal(explicitLanguageRequest("أريد إلغاء الحجز"), null, "a business request in the other language must await confirmation");
assert.equal(explicitLanguageRequest("Can you speak Arabic?"), null, "a language capability question is not switch confirmation");
assert.equal(explicitLanguageRequest("Arabic"), null, "a bare movie-language answer must not switch the conversation language");
assert.equal(explicitLanguageRequest("عربي"), null, "a bare Arabic movie-language answer must not switch the conversation language");
assert.equal(explicitLanguageRequest("Switch to Arabic"), "ar");
assert.equal(explicitLanguageRequest("Switch to Arabic and show me French movies"), "ar", "a combined command must still switch the interface language");
assert.equal(stripLanguageControlCommand("Switch to Arabic and show me French movies"), "show me French movies", "the movie request must remain available for discovery routing");
assert.equal(explicitLanguageRequest("Switch to English and show me Arabic movies"), "en", "the reverse combined command must still switch the interface language");
assert.equal(stripLanguageControlCommand("Switch to English and show me Arabic movies"), "show me Arabic movies");
assert.equal(explicitLanguageRequest("Please switch to Arabic"), "ar");
assert.equal(explicitLanguageRequest("Switch to Arabic please"), "ar");
assert.equal(explicitLanguageRequest("Could you continue in Arabic?"), "ar");
assert.equal(explicitLanguageRequest("Use Arabic"), "ar");
assert.equal(explicitLanguageRequest("Change language to Arabic"), "ar");
assert.equal(explicitLanguageRequest("Talk to me in Arabic"), "ar");
assert.equal(explicitLanguageRequest("Speak with me in Arabic"), "ar");
assert.equal(explicitLanguageRequest("Respond in Arabic please"), "ar");
assert.equal(explicitLanguageRequest("Switch language to Arabic"), "ar");
assert.equal(explicitLanguageRequest("Change to Arabic"), "ar");
assert.equal(explicitLanguageRequest("Continue in English"), "en");
assert.equal(explicitLanguageRequest("Would you switch to English please?"), "en");
assert.equal(explicitLanguageRequest("Set the language to English"), "en");
assert.equal(explicitLanguageRequest("Use English please"), "en");
assert.equal(explicitLanguageRequest("كمل عربي"), "ar");
assert.equal(explicitLanguageRequest("تكلم بالعربية"), "ar");
assert.equal(explicitLanguageRequest("تحدث بالعربية"), "ar");
assert.equal(explicitLanguageRequest("كمل بالعربي"), "ar");
assert.equal(explicitLanguageRequest("أريد التحدث بالعربية"), "ar");
assert.equal(explicitLanguageRequest("استخدم اللغة العربية"), "ar");
assert.equal(explicitLanguageRequest("غير اللغة للعربية"), "ar");
assert.equal(explicitLanguageRequest("حول للعربية"), "ar");
assert.equal(explicitLanguageRequest("بدل اللغة للعربية"), "ar");
assert.equal(extractDiscoveryPreferencePatch("Arabic").patch.language, "Arabic", "a bare language answer remains a movie-language filter");
assert.equal(extractDiscoveryPreferencePatch("أريد أفلام عربية").patch.language, "Arabic", "an Arabic-film request remains a discovery filter");
assert.match(conversationLanguageContinuityContext("أريد أفلام عربية", "en"), /Reply in English/, "Arabic-script discovery must not silently change an English conversation");
assert.match(conversationLanguageContinuityContext("I choose Ezma", "ar"), /Reply in Arabic/, "a Latin-script booking turn must not silently change an Arabic conversation");
assert.equal(conversationLanguageContinuityContext("Switch to Arabic", "en"), "", "an explicit language command must not receive a continuity override");

const offeredArabic = resolveLanguageSignal({
  role: "agent",
  text: "I noticed you’re speaking Arabic. Would you like me to continue in Arabic?",
  currentLocale: "en",
});
assert.equal(offeredArabic.pendingLocale, "ar");
assert.equal(offeredArabic.nextLocale, null);
for (const prompt of [
  "Would you prefer me to continue in Arabic?",
  "Shall I switch to Arabic?",
  "Do you want me to respond in Arabic?",
  "Would you like me to reply in Arabic?",
]) {
  assert.equal(resolveLanguageSignal({ role: "agent", text: prompt, currentLocale: "en" }).pendingLocale, "ar", `${prompt} must arm Arabic confirmation`);
}

const confirmedArabic = resolveLanguageSignal({
  role: "user",
  text: "Yes, Arabic",
  currentLocale: "en",
  pendingLocale: offeredArabic.pendingLocale,
});
assert.equal(confirmedArabic.nextLocale, "ar");
assert.equal(confirmedArabic.pendingLocale, null);
assert.equal(resolveLanguageSignal({ role: "user", text: "نعم بالعربية", currentLocale: "en", pendingLocale: "ar" }).nextLocale, "ar");
assert.equal(resolveLanguageSignal({ role: "user", text: "أكمل بالعربية", currentLocale: "en", pendingLocale: "ar" }).nextLocale, "ar");

const offeredEnglish = resolveLanguageSignal({
  role: "agent",
  text: "لاحظت أنك تتحدث بالإنجليزية. هل تريد أن أتابع باللغة الإنجليزية؟",
  currentLocale: "ar",
});
assert.equal(offeredEnglish.pendingLocale, "en");
assert.equal(resolveLanguageSignal({
  role: "agent",
  text: "هل تريد أن أتابع بالإنجليزية؟",
  currentLocale: "ar",
}).pendingLocale, "en", "the prompt's exact Arabic confirmation question must be recognized");
for (const prompt of [
  "هل أستمر بالإنجليزية؟",
  "هل أتابع بالإنجليزية؟",
  "هل أتكلم بالإنجليزية؟",
  "هل أحول إلى الإنجليزية؟",
  "هل أغير إلى الإنجليزية؟",
]) {
  assert.equal(resolveLanguageSignal({ role: "agent", text: prompt, currentLocale: "ar" }).pendingLocale, "en", `${prompt} must arm English confirmation`);
}
assert.equal(resolveLanguageSignal({ role: "user", text: "English please", currentLocale: "ar", pendingLocale: "en" }).nextLocale, "en");
assert.equal(resolveLanguageSignal({ role: "user", text: "No", currentLocale: "en", pendingLocale: "ar" }).pendingLocale, null);
assert.equal(resolveLanguageSignal({ role: "user", text: "Show me the 7 PM session", currentLocale: "en", pendingLocale: "ar" }).pendingLocale, null, "an unrelated reply must clear pending language confirmation");
assert.equal(resolveLanguageSignal({ role: "user", text: "yes", currentLocale: "en", pendingLocale: null }).nextLocale, null, "a later business confirmation must not trigger a stale switch");

console.log("Validated explicit English/Arabic selection and confirmation-only language switching.");
