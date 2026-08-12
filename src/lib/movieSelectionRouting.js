import { resolveBilingualDiscoveryMovieCandidate } from "./discoveryPreferences.js";
import { isAmbiguousMovieSelectionUtterance } from "./discoveryResultContext.js";
import { isPotentialMovieInformationTurn } from "./movieInformationPrefilter.js";

export async function routePendingVisibleMovie({ result, text, route } = {}) {
  if (!text || !Array.isArray(result?.movies) || !result.movies.length) return null;
  const movie = await resolveBilingualDiscoveryMovieCandidate(result.movies, text);
  if (!movie) return null;
  const selection = await route(movie);
  const showtimes = Array.isArray(selection?.result?.showtimes) ? selection.result.showtimes : [];
  return {
    ...result,
    shown: showtimes.length ? "showtimes" : "movie",
    movies: [],
    selectedMovie: { id: movie.id, title: movie.title },
    showtimes,
    reason: selection?.result?.reason || result.reason,
  };
}

const clean = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/[.!?,;:،؟]+$/gu, "")
  .replace(/\s+/g, " ")
  .trim();

const normalized = (value) => clean(value).toLocaleLowerCase("en");
const comparableTitle = (value) => normalized(value)
  .replace(/&/gu, " and ")
  .replace(/\s+/gu, " ")
  .trim();

const EXPLICIT_SELECTION = /\b(?:i(?:'|’)d\s+like|i\s+(?:choose|chose|select|selected|pick|picked|want)|choose|chose|select|selected|pick|picked|book|watch)\b|(?:اخترت|أختار|اختار|سأختار|اختياري|أريد|اريد|أود|اود|احجز|أحجز|سأشاهد|اشاهد)/iu;
const ARABIC_IMPERATIVE_SELECTION = /(?:اختر|إختر|حدد|حدّد)/u;
const INFORMATION_ONLY = /\b(?:about|details?|information|review|rating|trailer|story|plot|suitable|appropriate)\b|(?:معلومات|تفاصيل|قصة|تقييم|اعلان|إعلان|مناسب)/iu;

/**
 * Resolve an explicit selection from the movie cards that are visible now.
 * This deliberately reuses the established fuzzy movie resolver and rejects
 * generic references and informational questions.
 */
export async function resolveVisibleMovieSelectionTurn({ text, stage } = {}) {
  if (stage?.view !== "movies" || !Array.isArray(stage.movies) || !stage.movies.length) return null;
  const query = clean(text);
  if (!query || isAmbiguousMovieSelectionUtterance(query)) return null;
  const explicitSelection = EXPLICIT_SELECTION.test(query) || ARABIC_IMPERATIVE_SELECTION.test(query);
  if (!explicitSelection && isPotentialMovieInformationTurn(query)) return null;

  const explicitTitleQuery = query.replace(/^(?:(?:i(?:'|’)d|i\s+would)\s+like|i\s+(?:choose|chose|select|selected|pick|picked|want)|choose|chose|select|selected|pick|picked|book|watch|اخترت|أختار|اختار|سأختار|أريد|اريد|أود|اود|احجز|أحجز|سأشاهد|اشاهد)\s+(?:(?:the\s+)?(?:movie|film)\s+|فيلم\s+)?/iu, "").trim();
  const selectionTitleQuery = explicitTitleQuery
    .replace(/^(?:اختر|إختر|حدد|حدّد)\s+(?:فيلم\s+)?/u, "")
    .replace(/^(?:(?:the\s+)?(?:movie|film)|فيلم)\s+/iu, "")
    .trim();
  const directMovie = await resolveBilingualDiscoveryMovieCandidate(stage.movies, query);
  const titleQueryMovie = selectionTitleQuery !== query
    ? await resolveBilingualDiscoveryMovieCandidate(stage.movies, selectionTitleQuery)
    : null;
  const movie = directMovie || titleQueryMovie;
  if (!movie) return null;

  const title = comparableTitle(movie.title);
  const turn = comparableTitle(query);
  const bareTitle = turn === title;
  const bilingualBareTitle = Boolean(
    directMovie
    && /\p{Script=Arabic}/u.test(query) !== /\p{Script=Arabic}/u.test(String(movie.title || "")),
  );
  const qualifiedBareTitle = turn === `movie ${title}`
    || turn === `film ${title}`
    || turn === `the movie ${title}`
    || turn === `the film ${title}`
    || turn === `فيلم ${title}`;
  const explicitNamedSelection = explicitSelection
    && selectionTitleQuery !== query
    && comparableTitle(selectionTitleQuery) === title;
  const partialTitle = comparableTitle(selectionTitleQuery);
  const uniquePartialSelection = Boolean(
    movie
    && partialTitle.length >= 3
    && (title.startsWith(partialTitle) || title.split(/\s+/).some((token) => token.startsWith(partialTitle))),
  );

  return bareTitle || bilingualBareTitle || qualifiedBareTitle || explicitNamedSelection || uniquePartialSelection || (explicitSelection && !INFORMATION_ONLY.test(query)) ? movie : null;
}
