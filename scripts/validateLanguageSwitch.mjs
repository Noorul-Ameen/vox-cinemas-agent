import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { conversationLanguageContinuityContext, explicitLanguageRequest, resolveLanguageSignal, stripLanguageControlCommand } from "../src/lib/languageSwitch.js";
import { extractDiscoveryPreferencePatch } from "../src/lib/discoveryPreferences.js";
import { discoveryQuestionForLocale, localizedStageMessage, localizeDiscoveryStage } from "../src/lib/discoveryPromptLocalization.js";
import { guardAgentStateClaim } from "../src/lib/agentStateTruth.js";
import { capturePausedRichStage, createPausedRichJourney, selectRestorableRichStage } from "../src/lib/pausedRichJourney.js";

assert.equal(explicitLanguageRequest("شكراً"), null, "one Arabic word must not switch English to Arabic");
assert.equal(explicitLanguageRequest("Two tickets لو سمحت"), null, "mixed speech must not switch automatically");
assert.equal(explicitLanguageRequest("أريد إلغاء الحجز"), null, "a business request in the other language must await confirmation");
assert.equal(explicitLanguageRequest("Can you speak Arabic?"), null, "a language capability question is not switch confirmation");
assert.equal(explicitLanguageRequest("Arabic"), null, "a bare movie-language answer must not switch the conversation language");
assert.equal(explicitLanguageRequest("عربي"), null, "a bare Arabic movie-language answer must not switch the conversation language");
assert.equal(explicitLanguageRequest("Switch to Arabic"), "ar");
assert.equal(explicitLanguageRequest("Switch the conversation and interface to Arabic."), "ar");
assert.equal(explicitLanguageRequest("Switch the interface and conversation to English."), "en");
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

const englishDateStage = {
  view: "discovery",
  missing: ["date"],
  question: discoveryQuestionForLocale(["date"], "en"),
  preferences: { cinemaId: "YAS", cinemaName: "Yas Mall", experience: "IMAX" },
};
const arabicDateStage = localizeDiscoveryStage(englishDateStage, "ar");
assert.equal(arabicDateStage.question, "ما التاريخ الذي تفضّله؟", "an active English date prompt must switch its heading to Arabic");
assert.deepEqual(arabicDateStage.preferences, englishDateStage.preferences, "switching the prompt language must preserve cinema and experience state");
assert.equal(localizeDiscoveryStage(arabicDateStage, "en").question, "What date would you like to go?", "the same retained prompt must switch back to English");
assert.equal(
  guardAgentStateClaim("Yes, IMAX is available at Yas Mall.", { stage: englishDateStage, locale: "ar" }),
  "ما التاريخ الذي تفضّله؟",
  "the truth guard must use the active Arabic locale even if it receives an older English stage snapshot",
);
assert.equal(
  guardAgentStateClaim("نعم، آيماكس متاح في ياس مول.", { stage: arabicDateStage, locale: "en" }),
  "What date would you like to go?",
  "the truth guard must use the active English locale even if it receives an older Arabic stage snapshot",
);

const retainedMovieNoResults = {
  view: "movies",
  movies: [],
  preferences: { cinemaId: "MOE", date: "2026-07-23", language: "French" },
  error: "No French-language movies are available at Mall of the Emirates on 23 July 2026. You can change the date, cinema, or movie language.",
  errorByLocale: {
    en: "No French-language movies are available at Mall of the Emirates on 23 July 2026. You can change the date, cinema, or movie language.",
    ar: "لا توجد أفلام باللغة French في Mall of the Emirates بتاريخ 23 يوليو 2026. يمكنك تغيير التاريخ أو السينما أو لغة الفيلم.",
  },
};
assert.equal(localizedStageMessage(retainedMovieNoResults, "error", "ar"), retainedMovieNoResults.errorByLocale.ar, "an active English movie no-results error must render in Arabic immediately");
assert.equal(localizedStageMessage(retainedMovieNoResults, "error", "en"), retainedMovieNoResults.errorByLocale.en, "the same retained movie error must switch back to English");
assert.deepEqual(retainedMovieNoResults.preferences, { cinemaId: "MOE", date: "2026-07-23", language: "French" }, "localizing a movie error must preserve every retained filter");

const retainedShowtimeNotice = {
  view: "showtimes",
  movie: { id: "movie-1", title: "Example Movie" },
  sessions: [{ sessionId: "session-1", time: "19:30" }],
  notice: "لا يوجد عرض عند 19:00. هذه أقرب الأوقات المناسبة.",
  noticeByLocale: {
    en: "No exact 19:00 showtime is available. These are the closest suitable times.",
    ar: "لا يوجد عرض عند 19:00. هذه أقرب الأوقات المناسبة.",
  },
};
assert.equal(localizedStageMessage(retainedShowtimeNotice, "notice", "en"), retainedShowtimeNotice.noticeByLocale.en, "an active Arabic showtime notice must render in English immediately");
assert.equal(localizedStageMessage(retainedShowtimeNotice, "notice", "ar"), retainedShowtimeNotice.noticeByLocale.ar, "the same retained showtime notice must switch back to Arabic");
assert.equal(retainedShowtimeNotice.sessions[0].sessionId, "session-1", "localizing a showtime notice must preserve the selected movie and sessions");
let savedShowtimeJourney = createPausedRichJourney({ sessionId: "language-session", journeyId: "language-journey", now: "2026-07-22T12:00:00.000Z" });
savedShowtimeJourney = capturePausedRichStage(savedShowtimeJourney, retainedShowtimeNotice, { now: "2026-07-22T12:00:00.000Z" });
const restoredShowtimeStage = selectRestorableRichStage(savedShowtimeJourney, { view: "showtimes" }).snapshot;
assert.equal(localizedStageMessage(restoredShowtimeStage, "notice", "en"), retainedShowtimeNotice.noticeByLocale.en, "a saved Arabic showtime notice must restore in English without losing its bilingual source");
assert.equal(localizedStageMessage(restoredShowtimeStage, "notice", "ar"), retainedShowtimeNotice.noticeByLocale.ar, "the saved showtime notice must still switch back to Arabic after restoration");

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const movieDisplayGuard = appSource.slice(appSource.indexOf("function guardMovieDisplayClaim"), appSource.indexOf("function programmingDatesForCinema"));
assert.match(movieDisplayGuard, /localizedStageMessage\(stage, "notice", locale\)/, "the agent response guard must use the active locale for retained cinema and movie notices");
assert.match(movieDisplayGuard, /localizedStageMessage\(stage, "error", locale\)/, "the agent response guard must use the active locale for retained movie errors");
assert.doesNotMatch(movieDisplayGuard, /String\(stage\.(?:notice|error)/, "the agent response guard must not reuse a stale-language notice or error directly");

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
