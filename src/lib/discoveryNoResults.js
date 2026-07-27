import { formatDiscoveryTimePreference, hasDiscoveryTimePreference } from "./discoveryPreferences.js";
import { localizeCatalogValue, localizeCinemaName } from "./catalogLocalization.js";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const cleanCinemaName = (value) => clean(value).replace(/^VOX\s*[\u2013\u2014-]?\s*/iu, "");

function displayDate(value, locale) {
  const date = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      timeZone: "Asia/Dubai",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00+04:00`));
  } catch {
    return date;
  }
}

function preferenceLabels(preferences = {}, locale = "en") {
  const timePreference = preferences.timeRangeStart && preferences.timeRangeEnd
    ? formatDiscoveryTimePreference(preferences, { locale })
    : preferences.preferredTime
      ? (locale === "ar" ? `حوالي ${preferences.preferredTime}` : `around ${preferences.preferredTime}`)
      : preferences.timeBand;
  return [
    preferences.movieTitle,
    preferences.language ? (locale === "ar" ? `اللغة ${localizeCatalogValue(preferences.language, locale)}` : `${preferences.language} language`) : null,
    preferences.genre ? (locale === "ar" ? `نوع ${localizeCatalogValue(preferences.genre, locale)}` : `${preferences.genre} genre`) : null,
    preferences.experience ? (locale === "ar" ? `تجربة ${localizeCatalogValue(preferences.experience, locale)}` : `${preferences.experience} experience`) : null,
    preferences.audience === "kids_family" ? (locale === "ar" ? "أطفال وعائلات" : "kids and family") : null,
    preferences.audience === "teen" ? (locale === "ar" ? "مناسب للمراهقين" : "suitable for teenagers") : null,
    preferences.viewerAge != null ? (locale === "ar" ? `مناسب لعمر ${preferences.viewerAge}` : `suitable for age ${preferences.viewerAge}`) : null,
    timePreference,
  ].map(clean).filter(Boolean);
}

export function buildDiscoveryNoResultsMessage({
  preferences = {},
  cinemaName = "",
  date = "",
  noResultsReason = "no_results_for_criteria",
  locale = "en",
} = {}) {
  const cinema = localizeCinemaName(cleanCinemaName(cinemaName || preferences.cinemaName), locale);
  const requestedDate = displayDate(date || preferences.date, locale);
  const labels = preferenceLabels(preferences, locale);
  const contentLabels = preferenceLabels({ ...preferences, preferredTime: null, timeRangeStart: null, timeRangeEnd: null, timeBand: null }, locale);
  const scope = locale === "ar"
    ? [cinema ? `في ${cinema}` : "", requestedDate ? `بتاريخ ${requestedDate}` : ""].filter(Boolean).join(" ")
    : [cinema ? `at ${cinema}` : "", requestedDate ? `on ${requestedDate}` : ""].filter(Boolean).join(" ");
  const singleContent = contentLabels.length === 1;
  const timeOnly = noResultsReason === "no_suitable_time" || (labels.length === 1 && hasDiscoveryTimePreference(preferences));
  const rangeSuffix = preferences.timeRangeStart && preferences.timeRangeEnd
    ? (locale === "ar" ? ` بين ${preferences.timeRangeStart} و${preferences.timeRangeEnd}` : ` between ${preferences.timeRangeStart} and ${preferences.timeRangeEnd}`)
    : "";
  let statement;
  let action;
  if (singleContent && preferences.viewerAge != null) {
    statement = locale === "ar"
      ? `لا توجد أفلام بتصنيف عمري مناسب لعمر ${preferences.viewerAge}`
      : `No movies with a suitable published rating for age ${preferences.viewerAge} are available`;
    action = locale === "ar"
      ? "يمكنك تغيير التاريخ أو السينما."
      : "You can change the date or cinema.";
    return `${statement}${scope ? ` ${scope}` : ""}. ${action}`;
  }
  if (singleContent && preferences.audience === "teen") {
    statement = locale === "ar"
      ? "لا توجد أفلام بتصنيف عمري مناسب للمراهقين"
      : "No movies with a suitable published rating for teenagers are available";
    action = locale === "ar"
      ? "يمكنك تغيير التاريخ أو السينما."
      : "You can change the date or cinema.";
    return `${statement}${scope ? ` ${scope}` : ""}. ${action}`;
  }
  if (locale === "ar") {
    if (singleContent && preferences.movieTitle) [statement, action] = [`لا توجد عروض متاحة لفيلم ${preferences.movieTitle}`, "يمكنك تغيير التاريخ أو السينما."];
    else if (singleContent && preferences.language) [statement, action] = [`لا توجد أفلام باللغة ${localizeCatalogValue(preferences.language, locale)}`, "يمكنك تغيير التاريخ أو السينما أو لغة الفيلم."];
    else if (singleContent && preferences.genre) [statement, action] = [`لا توجد أفلام من نوع ${localizeCatalogValue(preferences.genre, locale)}`, "يمكنك تغيير التاريخ أو السينما أو النوع."];
    else if (singleContent && preferences.experience) [statement, action] = [`لا توجد عروض بتجربة ${preferences.experience}`, "يمكنك تغيير التاريخ أو السينما أو التجربة."];
    else if (singleContent && preferences.audience === "kids_family") [statement, action] = ["لا توجد أفلام مناسبة للأطفال والعائلات", "يمكنك تغيير التاريخ أو السينما."];
    else if (timeOnly) [statement, action] = [`لا توجد مواعيد عرض مناسبة${rangeSuffix || (preferences.preferredTime ? ` حوالي ${preferences.preferredTime}` : "")}`, "يمكنك تغيير الوقت أو التاريخ أو السينما."];
    else [statement, action] = [`لا توجد أفلام تطابق جميع التفضيلات المحددة${labels.length ? ` (${labels.join("، ")})` : ""}`, "غيّر تفضيلاً واحداً أو التاريخ أو السينما للمتابعة."];
  } else if (singleContent && preferences.movieTitle) [statement, action] = [`${preferences.movieTitle} has no available showtimes`, "You can change the date or cinema."];
  else if (singleContent && preferences.language) [statement, action] = [`No ${preferences.language}-language movies are available`, "You can change the date, cinema, or movie language."];
  else if (singleContent && preferences.genre) [statement, action] = [`No ${preferences.genre} movies are available`, "You can change the date, cinema, or genre."];
  else if (singleContent && preferences.experience) [statement, action] = [`No ${preferences.experience} showtimes are available`, "You can change the date, cinema, or experience."];
  else if (singleContent && preferences.audience === "kids_family") [statement, action] = ["No kids and family movies are available", "You can change the date or cinema."];
  else if (timeOnly) [statement, action] = [`No suitable movie showtimes are available${rangeSuffix || (preferences.preferredTime ? ` around ${preferences.preferredTime}` : "")}`, "You can change the time, date, or cinema."];
  else [statement, action] = [`No movies match all selected preferences${labels.length ? ` (${labels.join(", ")})` : ""}`, "Change one preference, the date, or the cinema to continue."];
  return `${statement}${scope ? ` ${scope}` : ""}. ${action}`;
}
