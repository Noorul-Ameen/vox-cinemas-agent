import { resolveDiscoveryMovieCandidate } from "./discoveryPreferences.js";
import { isAmbiguousMovieSelectionUtterance } from "./discoveryResultContext.js";

const clean = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/[.!?,;:،؟]+$/gu, "")
  .replace(/\s+/g, " ")
  .trim();

const normalized = (value) => clean(value).toLocaleLowerCase("en");

const EXPLICIT_SELECTION = /\b(?:i(?:'|’)d\s+like|i\s+(?:choose|chose|select|selected|pick|picked|want)|choose|chose|select|selected|pick|picked|book|watch)\b|(?:اخترت|أختار|اختار|سأختار|اختياري|أريد|اريد|أود|اود|احجز|أحجز|سأشاهد|اشاهد)/iu;
const INFORMATION_ONLY = /\b(?:about|details?|information|review|rating|trailer|story|plot|suitable|appropriate)\b|(?:معلومات|تفاصيل|قصة|تقييم|اعلان|إعلان|مناسب)/iu;

/**
 * Resolve an explicit selection from the movie cards that are visible now.
 * This deliberately reuses the established fuzzy movie resolver and rejects
 * generic references and informational questions.
 */
export function resolveVisibleMovieSelectionTurn({ text, stage } = {}) {
  if (stage?.view !== "movies" || !Array.isArray(stage.movies) || !stage.movies.length) return null;
  const query = clean(text);
  if (!query || isAmbiguousMovieSelectionUtterance(query)) return null;

  const movie = resolveDiscoveryMovieCandidate(stage.movies, query);
  if (!movie) return null;

  const title = normalized(movie.title);
  const turn = normalized(query);
  const bareTitle = turn === title;
  const qualifiedBareTitle = turn === `movie ${title}`
    || turn === `film ${title}`
    || turn === `the movie ${title}`
    || turn === `the film ${title}`
    || turn === `فيلم ${title}`;

  return bareTitle || qualifiedBareTitle || (EXPLICIT_SELECTION.test(query) && !INFORMATION_ONLY.test(query)) ? movie : null;
}
