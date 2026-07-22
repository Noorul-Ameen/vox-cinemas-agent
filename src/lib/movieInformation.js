import { normalizeCustomerFacingText } from "./customerFacingText.js";
import {
  buildAuthoritativeMovieRatingContext,
  buildMovieRatingAnswer,
  extractViewerAge,
  isMovieRatingQuestion,
  normalizeMovieRating,
  resolveMovieForInformationQuestion,
  resolveRatingMeaning,
} from "./movieRating.js";

const clean = (value) => normalizeCustomerFacingText(String(value ?? "").replace(/\s+/g, " ").trim());
const localeText = (locale, en, ar) => locale === "ar" ? ar : en;
const normalize = (value) => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase("en")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/&/g, " and ")
  .replace(/[^\p{L}\p{N}+#]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const SYNOPSIS_PATTERN = /\b(?:what(?:'s| is) .{1,80} about|what happens|story|storyline|plot|synopsis|summary)\b|(?:عن ماذا|عن شو|ما قصة|ما قصه|قصة الفيلم|قصه الفيلم|ملخص|احداث الفيلم|أحداث الفيلم)/iu;
const LANGUAGE_PATTERN = /\b(?:what|which|original|spoken|movie|film)?\s*(?:language|languages|dubbed|dubbing)\b|(?:ما لغة|ما لغه|لغة الفيلم|لغه الفيلم|مدبلج|اللغة الاصلية|اللغه الاصليه)/iu;
const SUBTITLE_PATTERN = /\b(?:subtitle|subtitles|subtitled|captions?)\b|(?:ترجمة|ترجمه|مترجم|الترجمة|الترجمه)/iu;
const RUNTIME_PATTERN = /\b(?:runtime|duration|how long|length of (?:the )?(?:movie|film)|minutes? long)\b|(?:(?:ما\s+)?(?:مدة|مده)(?:\s+فيلم)?|كم مدته|كم دقيقة|كم دقيقه)/iu;
const GENRE_PATTERN = /\b(?:what|which)?\s*(?:genre|genres|type of (?:movie|film))\b|(?:ما نوع|نوع الفيلم|تصنيف النوع|اي نوع|أي نوع)/iu;
const CAST_PATTERN = /\b(?:cast|actor|actors|actress|actresses|starring|who is in|who(?:'s| is) in)\b|(?:طاقم التمثيل|الممثل|الممثلون|الممثلة|الممثله|بطولة|بطوله|من يمثل)/iu;
const TRAILER_PATTERN = /\b(?:trailer|preview|teaser)\b|(?:اعلان الفيلم|إعلان الفيلم|المقطع الدعائي|عرض دعائي)/iu;
const RELEASE_PATTERN = /\b(?:release date|released|premiere date|when did .* come out|when is .* out)\b|(?:تاريخ العرض|تاريخ الاصدار|تاريخ الإصدار|متى صدر|متى يعرض)/iu;
const DETAILS_PATTERN = /\b(?:tell me about|movie details|film details|more (?:about|information)|information about|details about)\b|(?:اخبرني عن|أخبرني عن|معلومات عن|تفاصيل الفيلم|تفاصيل عن)/iu;
const PLURAL_REFERENCE_PATTERN = /\b(?:their|these|those|all (?:the )?(?:movies|films)|movies'?|films'?)\s+(?:ratings?|certificates?)\b|(?:تصنيف هذه الافلام|تصنيفات الافلام|تصنيفهم|تقييم هذه الافلام)/iu;
const DISCOVERY_COMMAND_PATTERN = /^(?:show|find|list|suggest|recommend|book|i want|i need|looking for)\b|^(?:اعرض|ابحث|اقترح|رشح|اريد|أريد|احتاج|أحتاج|احجز)\b/iu;

export function classifyMovieInformationQuestion(input) {
  const text = clean(typeof input === "object" && input !== null ? input.text ?? input.query : input);
  if (!text) return null;
  const normalizedText = normalize(text);
  const pluralDiscoveryCollection = /\b(?:movies|films|showtimes|options|choices)\b/iu.test(normalizedText)
    && !/\b(?:these|those|their)\b/iu.test(normalizedText);
  const explicitOpenFilter = /\b(?:any|no)\s+(?:movie\s+)?(?:language|genre)(?:\s+preference)?\b|\b(?:language|genre)\s+(?:does not matter|doesn t matter|is fine|is okay|is ok)\b|(?:أي|اي)\s+(?:لغة|لغه|نوع)|(?:لا|ما)\s+(?:فرق|عندي تفضيل)\s+(?:باللغة|باللغه|بالنوع)?/iu.test(normalizedText);
  if (explicitOpenFilter || (pluralDiscoveryCollection && DISCOVERY_COMMAND_PATTERN.test(normalizedText))) return null;
  if (pluralDiscoveryCollection && /\b(?:language|genre)\b/iu.test(normalizedText)) return null;
  const rating = isMovieRatingQuestion(text) || /\b(?:ratings|certificates)\b|(?:التصنيفات|التقييمات)/iu.test(text);
  if (rating && DISCOVERY_COMMAND_PATTERN.test(normalizedText) && /\b(?:g|pg|pg13|pg15|15\+|18\+|21\+|18tc)\b/i.test(text)) return null;
  if (rating) return "rating";
  if (SYNOPSIS_PATTERN.test(text)) return "synopsis";
  if (SUBTITLE_PATTERN.test(text)) return "subtitles";
  if (LANGUAGE_PATTERN.test(text)) return "language";
  if (RUNTIME_PATTERN.test(text)) return "runtime";
  if (GENRE_PATTERN.test(text)) return "genre";
  if (CAST_PATTERN.test(text)) return "cast";
  if (TRAILER_PATTERN.test(text)) return "trailer";
  if (RELEASE_PATTERN.test(text)) return "release";
  if (DETAILS_PATTERN.test(text)) return "details";
  return null;
}

export function isLikelyMovieInformationQuestion(input) {
  return classifyMovieInformationQuestion(input) !== null;
}

function uniqueMovies(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter((movie) => {
    const key = String(movie?.id || movie?.movieId || movie?.title || movie?.movieTitle || "").toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function genresFor(movie) {
  const values = Array.isArray(movie?.genres)
    ? movie.genres
    : String(movie?.genre || "").split(/[,/|]/);
  return [...new Set(values.map(clean).filter(Boolean))];
}

function languageFor(movie) {
  return clean(movie?.languageName || movie?.language || movie?.LanguageName || movie?.Language);
}

function namedTitleVariants(movies, query) {
  const normalizedQuery = ` ${normalize(query)} `;
  const groups = new Map();
  for (const movie of uniqueMovies(movies)) {
    const title = clean(movie?.title || movie?.movieTitle);
    const titleKey = normalize(title);
    if (!titleKey || !normalizedQuery.includes(` ${titleKey} `)) continue;
    if (!groups.has(titleKey)) groups.set(titleKey, []);
    groups.get(titleKey).push(movie);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0].length - left[0].length)
    .map(([, variants]) => variants)
    .find((variants) => variants.length > 1) || [];
}

function localizedList(values, locale) {
  const items = [...new Set(values.map(clean).filter(Boolean))];
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return items.join(locale === "ar" ? " و" : " and ");
  return `${items.slice(0, -1).join(locale === "ar" ? "، " : ", ")}${locale === "ar" ? "، و" : ", and "}${items.at(-1)}`;
}

function runtimeFor(movie) {
  const runtime = Number(movie?.runtime ?? movie?.RunTime ?? movie?.duration);
  return Number.isFinite(runtime) && runtime > 0 ? Math.round(runtime) : null;
}

function synopsisFor(movie) {
  const full = clean(movie?.synopsis || movie?.Synopsis || movie?.description || movie?.Description);
  if (!full) return "";
  const firstSentence = full.match(/^.{1,360}?[.!?](?:\s|$)/u)?.[0] || full.slice(0, 360);
  return clean(firstSentence.length < full.length && !/[.!?]$/u.test(firstSentence) ? `${firstSentence}...` : firstSentence);
}

function subtitlesFor(movie) {
  const source = movie?.subtitles ?? movie?.subtitleLanguages ?? movie?.SubtitleLanguages;
  const values = Array.isArray(source) ? source : String(source || "").split(/[,/|]/);
  return [...new Set(values.map(clean).filter(Boolean))];
}

function pluralRatingAnswer(movies, locale) {
  const rows = movies.slice(0, 8).map((movie) => {
    const title = clean(movie?.title || movie?.movieTitle);
    const rating = normalizeMovieRating(movie?.rating || movie?.movieRating);
    return locale === "ar"
      ? `${title}: ${rating || "لا يوجد تصنيف موثق في القائمة الحالية"}`
      : `${title}: ${rating || "no verified rating in the current listing"}`;
  });
  return clean(localeText(
    locale,
    `The current VOX age ratings are: ${rows.join("; ")}. These are age certificates, not review scores.`,
    `التصنيفات العمرية الحالية لدى ڤوكس هي: ${rows.join("؛ ")}. هذه تصنيفات عمرية وليست تقييماً نقدياً.`,
  ));
}

export function buildMovieTitleClarification(options = {}) {
  const input = typeof options === "string" ? { locale: options } : options || {};
  const locale = input.locale === "ar" ? "ar" : "en";
  const titles = uniqueMovies(input.candidates || [])
    .map((movie) => clean(movie?.title || movie?.movieTitle))
    .filter(Boolean)
    .slice(0, 4);
  if (titles.length > 1) {
    return clean(localeText(
      locale,
      `Which movie do you mean: ${titles.join(", ")}? Please say one title.`,
      `أي فيلم تقصد: ${titles.join("، ")}؟ اذكر اسماً واحداً.`,
    ));
  }
  return localeText(
    locale,
    "Which movie do you mean? Please say the movie title.",
    "أي فيلم تقصد؟ اذكر اسم الفيلم.",
  );
}

function answerForTopic({ topic, movie, query, locale, sessions, viewerAge }) {
  const title = clean(movie?.title || movie?.movieTitle);
  if (topic === "rating") {
    const meaning = resolveRatingMeaning(query);
    return buildMovieRatingAnswer({
      query,
      movie,
      viewerAge: viewerAge ?? extractViewerAge(query),
      locale,
      sessions,
      meaning,
    });
  }
  if (topic === "synopsis") {
    const synopsis = synopsisFor(movie);
    return synopsis
      ? localeText(locale, `${title}: ${synopsis}`, `${title}: ${synopsis}`)
      : localeText(locale, `The current VOX listing does not provide a synopsis for ${title}.`, `لا تعرض قائمة ڤوكس الحالية ملخصاً لفيلم ${title}.`);
  }
  if (topic === "language") {
    const language = languageFor(movie);
    return language
      ? localeText(locale, `${title} is listed in ${language}.`, `اللغة المدرجة لفيلم ${title} هي ${language}.`)
      : localeText(locale, `The current VOX listing does not specify the original language for ${title}.`, `لا تحدد قائمة ڤوكس الحالية اللغة الأصلية لفيلم ${title}.`);
  }
  if (topic === "subtitles") {
    const subtitles = subtitlesFor(movie);
    return subtitles.length
      ? localeText(locale, `${title} lists subtitles in ${subtitles.join(", ")}.`, `الترجمة المدرجة لفيلم ${title} هي ${subtitles.join("، ")}.`)
      : localeText(locale, `The current VOX listing does not specify subtitles for ${title}. Please verify subtitle availability for the exact session at checkout.`, `لا تحدد قائمة ڤوكس الحالية ترجمة لفيلم ${title}. تحقق من توفر الترجمة للعرض المحدد عند الدفع.`);
  }
  if (topic === "runtime") {
    const runtime = runtimeFor(movie);
    return runtime
      ? localeText(locale, `${title} has a listed runtime of ${runtime} minutes.`, `مدة فيلم ${title} المدرجة هي ${runtime} دقيقة.`)
      : localeText(locale, `The current VOX listing does not provide a runtime for ${title}.`, `لا تعرض قائمة ڤوكس الحالية مدة لفيلم ${title}.`);
  }
  if (topic === "genre") {
    const genres = genresFor(movie);
    return genres.length
      ? localeText(locale, `${title} is listed as ${genres.join(", ")}.`, `الأنواع المدرجة لفيلم ${title} هي ${genres.join("، ")}.`)
      : localeText(locale, `The current VOX listing does not specify a genre for ${title}.`, `لا تحدد قائمة ڤوكس الحالية نوع فيلم ${title}.`);
  }
  if (topic === "details") {
    const facts = [
      normalizeMovieRating(movie?.rating) ? localeText(locale, `rated ${normalizeMovieRating(movie.rating)}`, `التصنيف ${normalizeMovieRating(movie.rating)}`) : "",
      genresFor(movie).join(", "),
      languageFor(movie),
      runtimeFor(movie) ? localeText(locale, `${runtimeFor(movie)} minutes`, `${runtimeFor(movie)} دقيقة`) : "",
    ].filter(Boolean).join(", ");
    const synopsis = synopsisFor(movie);
    return clean(localeText(
      locale,
      `${title}${facts ? ` is ${facts}.` : "."}${synopsis ? ` ${synopsis}` : ""}`,
      `${title}${facts ? `: ${facts}.` : "."}${synopsis ? ` ${synopsis}` : ""}`,
    ));
  }
  if (topic === "cast") return localeText(locale, `The current VOX listing does not provide verified cast details for ${title}, so I will not guess.`, `لا تعرض قائمة ڤوكس الحالية تفاصيل موثقة عن طاقم فيلم ${title}، لذلك لن أخمن.`);
  if (topic === "trailer") return localeText(locale, `A verified trailer link for ${title} is not available in the current widget.`, `لا يتوفر رابط إعلان موثق لفيلم ${title} في الواجهة الحالية.`);
  if (topic === "release") return localeText(locale, `The current VOX listing does not provide a verified release date for ${title}.`, `لا تعرض قائمة ڤوكس الحالية تاريخ إصدار موثقاً لفيلم ${title}.`);
  return buildMovieTitleClarification({ locale });
}

export function resolveMovieInformationTurn(options = {}) {
  const query = clean(options.query ?? options.text);
  const locale = options.locale === "ar" ? "ar" : "en";
  const forcedTopic = ["rating", "synopsis", "subtitles", "language", "runtime", "genre", "cast", "trailer", "release", "details"].includes(options.forcedTopic)
    ? options.forcedTopic
    : null;
  const topic = forcedTopic || classifyMovieInformationQuestion(query);
  if (!topic) return { handled: false, topic: null, movie: null, answer: "", context: "" };
  const viewerAge = options.viewerAge ?? extractViewerAge(query);

  const variantCandidates = namedTitleVariants([
    ...(Array.isArray(options.visibleMovies) ? options.visibleMovies : []),
    ...(Array.isArray(options.movies) ? options.movies : []),
  ], query);
  let explicitVariant = null;
  if (variantCandidates.length) {
    const normalizedQuery = ` ${normalize(query)} `;
    const requestedVariants = variantCandidates.filter((movie) => {
      const language = normalize(languageFor(movie));
      return language && normalizedQuery.includes(` ${language} `);
    });
    if (requestedVariants.length === 1) explicitVariant = requestedVariants[0];
    const currentVariant = options.currentMovie || options.stage?.movie || null;
    const currentId = clean(currentVariant?.id || currentVariant?.movieId);
    const currentLanguage = languageFor(currentVariant);
    if (!explicitVariant) {
      explicitVariant = variantCandidates.find((movie) => currentId && clean(movie?.id || movie?.movieId) === currentId) || null;
    }
    const currentTitle = normalize(currentVariant?.title || currentVariant?.movieTitle);
    const variantTitle = normalize(variantCandidates[0]?.title || variantCandidates[0]?.movieTitle);
    if (!explicitVariant && currentTitle && currentTitle === variantTitle && currentLanguage) {
      explicitVariant = variantCandidates.find((movie) => normalize(languageFor(movie)) === normalize(currentLanguage)) || null;
    }
    if (!explicitVariant && topic === "language") {
      const title = clean(variantCandidates[0]?.title || variantCandidates[0]?.movieTitle);
      const languages = [...new Set(variantCandidates.map(languageFor).filter(Boolean))];
      const languageList = localizedList(languages, locale);
      const answer = clean(localeText(
        locale,
        `${title} is currently listed in ${languageList}.`,
        `فيلم ${title} مدرج حاليا باللغات ${languageList}.`,
      ));
      return {
        handled: true,
        topic,
        movie: null,
        variants: variantCandidates,
        viewerAge,
        answer,
        context: [
          `AUTHORITATIVE MOVIE LANGUAGE VARIANTS: ${JSON.stringify(variantCandidates.map((movie) => ({ id: movie.id || movie.movieId || null, title, language: languageFor(movie) || null })))}`,
          `Authoritative customer answer: ${answer}`,
          "Speak the authoritative customer answer exactly once. Do not choose one language variant, select a movie, change filters, call a display tool, or invent another variant.",
        ].join("\n"),
      };
    }
    if (!explicitVariant) {
      const title = clean(variantCandidates[0]?.title || variantCandidates[0]?.movieTitle);
      const languages = [...new Set(variantCandidates.map(languageFor).filter(Boolean))];
      const languageList = localizedList(languages, locale);
      const answer = clean(localeText(
        locale,
        `${title} has current VOX listings in ${languageList}. Please include the language version in your question so I do not guess.`,
        `لفيلم ${title} عروض حالية لدى ڤوكس باللغات ${languageList}. يرجى ذكر نسخة اللغة في سؤالك حتى لا أخمن.`,
      ));
      return {
        handled: true,
        topic,
        movie: null,
        variants: variantCandidates,
        viewerAge,
        answer,
        context: `${JSON.stringify(variantCandidates.map((movie) => ({ id: movie.id || movie.movieId || null, title, language: languageFor(movie) || null })))}\nAuthoritative customer answer: ${answer}\nAsk for the exact language version and do not select a movie, change filters, call a display tool, or guess.`,
      };
    }
  }

  const visibleMovies = uniqueMovies(options.visibleMovies);
  if (topic === "rating" && PLURAL_REFERENCE_PATTERN.test(query) && visibleMovies.length) {
    const answer = pluralRatingAnswer(visibleMovies, locale);
    return {
      handled: true,
      topic,
      movie: null,
      viewerAge,
      answer,
      context: [
        `AUTHORITATIVE VISIBLE MOVIE RATINGS: ${JSON.stringify(visibleMovies.map((movie) => ({ title: clean(movie.title), rating: normalizeMovieRating(movie.rating) })))}`,
        `Authoritative customer answer: ${answer}`,
        "Speak the authoritative customer answer exactly once. Do not select a movie, change filters, call a display tool, or invent a review score.",
      ].join("\n"),
    };
  }

  const resolution = explicitVariant ? { movie: explicitVariant, source: "named_language_variant", ambiguous: false, candidates: [explicitVariant] } : resolveMovieForInformationQuestion({
    query,
    currentMovie: options.currentMovie,
    visibleMovies,
    movies: options.movies,
    stage: options.stage,
    pausedStage: options.pausedStage,
  });
  const genericCurrentReference = options.currentMovie
    && normalize(query).split(" ").length <= 6
    && !/\b(?:of|for|about)\s+[\p{L}\p{N}]/iu.test(query);
  const movie = resolution?.movie || (genericCurrentReference ? options.currentMovie : null);
  if (!movie) {
    const answer = buildMovieTitleClarification({ locale, candidates: resolution?.candidates });
    return {
      handled: true,
      topic,
      movie: null,
      viewerAge,
      answer,
      context: `${resolution?.ambiguous ? "The movie reference is ambiguous." : "No movie is available in the current context."} Authoritative customer answer: ${answer} Ask only for one movie title. Do not select a movie or restart discovery.`,
    };
  }

  const sessions = Array.isArray(options.sessions) ? options.sessions : movie.relevantSessions || [];
  const answer = clean(answerForTopic({ topic, movie, query, locale, sessions, viewerAge }));
  const facts = {
    id: movie.id || movie.movieId || null,
    title: clean(movie.title || movie.movieTitle),
    rating: normalizeMovieRating(movie.rating || movie.movieRating),
    language: languageFor(movie) || null,
    runtimeMinutes: runtimeFor(movie),
    genres: genresFor(movie),
    subtitles: subtitlesFor(movie),
    synopsis: synopsisFor(movie) || null,
  };
  const context = topic === "rating"
    ? buildAuthoritativeMovieRatingContext({ query, movie, locale, sessions, answer })
    : [
      `AUTHORITATIVE MOVIE INFORMATION: ${JSON.stringify(facts)}`,
      `Authoritative customer answer: ${answer}`,
      "Speak the authoritative customer answer exactly once. Do not select a movie, change filters, call a display tool, restart discovery, or invent missing facts.",
    ].join("\n");
  return { handled: true, topic, movie, viewerAge, answer, context };
}
