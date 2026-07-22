import { normalizeCustomerFacingText } from "./customerFacingText.js";

let referenceMetadataPromise = null;

function normalizeReferenceMovie(movie) {
  const title = normalizeCustomerFacingText(movie?.title ?? movie?.Title ?? movie?.name ?? "");
  if (!title) return null;
  const language = normalizeCustomerFacingText(movie?.languageName ?? movie?.language ?? movie?.LanguageName ?? movie?.Language ?? "");
  const genres = Array.isArray(movie?.genres ?? movie?.Genres)
    ? (movie.genres ?? movie.Genres).map(normalizeCustomerFacingText).filter(Boolean)
    : String(movie?.genre ?? movie?.Genre ?? "").split(/[,/|]/).map(normalizeCustomerFacingText).filter(Boolean);
  return {
    ...movie,
    id: String(movie?.id ?? movie?.code ?? movie?.ScheduledFilmId ?? movie?.movieId ?? "").trim() || null,
    title,
    rating: normalizeCustomerFacingText(movie?.rating ?? movie?.Rating ?? movie?.movieRating ?? ""),
    language,
    languageName: language,
    runtime: Number(movie?.runtime ?? movie?.RunTime ?? movie?.duration) || 0,
    genres,
    synopsis: normalizeCustomerFacingText(movie?.synopsis ?? movie?.Synopsis ?? movie?.description ?? ""),
    subtitles: Array.isArray(movie?.subtitles ?? movie?.Subtitles) ? (movie.subtitles ?? movie.Subtitles) : [],
  };
}

function normalizedTitle(value) {
  return normalizeCustomerFacingText(value).normalize("NFKC").toLocaleLowerCase("en");
}

function normalizedLanguage(value) {
  return normalizeCustomerFacingText(value).normalize("NFKC").toLocaleLowerCase("en");
}

function hasUsefulCurrentValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return true;
}

export function mergeMovieInformationCatalog(currentMovies = [], referenceMovies = []) {
  const merged = [];
  const indexById = new Map();
  const addReference = (movie) => {
    const idKey = normalizedTitle(movie.id);
    if (idKey && indexById.has(idKey)) {
      const index = indexById.get(idKey);
      merged[index] = { ...merged[index], ...movie };
      return;
    }
    const index = merged.length;
    merged.push(movie);
    if (idKey) indexById.set(idKey, index);
  };
  for (const value of Array.isArray(referenceMovies) ? referenceMovies : []) {
    const movie = normalizeReferenceMovie(value);
    if (movie && normalizedTitle(movie.title)) addReference(movie);
  }
  // Current schedule facts win when populated. Empty schedule strings, arrays,
  // and zero placeholders must not erase useful official descriptive metadata.
  for (const value of Array.isArray(currentMovies) ? currentMovies : []) {
    const movie = normalizeReferenceMovie(value);
    const titleKey = normalizedTitle(movie?.title);
    if (!movie || !titleKey) continue;
    const idKey = normalizedTitle(movie.id);
    let index = idKey && indexById.has(idKey) ? indexById.get(idKey) : -1;
    if (index < 0) {
      const titleMatches = merged
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
        .filter(({ candidate }) => normalizedTitle(candidate.title) === titleKey);
      const languageKey = normalizedLanguage(movie.languageName || movie.language);
      const languageMatches = languageKey
        ? titleMatches.filter(({ candidate }) => normalizedLanguage(candidate.languageName || candidate.language) === languageKey)
        : [];
      if (languageMatches.length === 1) index = languageMatches[0].candidateIndex;
      else if (titleMatches.length === 1) index = titleMatches[0].candidateIndex;
    }
    const previous = index >= 0 ? merged[index] : {};
    const currentFacts = Object.fromEntries(
      Object.entries(movie).filter(([, fieldValue]) => hasUsefulCurrentValue(fieldValue)),
    );
    const nextMovie = { ...previous, ...currentFacts };
    if (index >= 0) merged[index] = nextMovie;
    else {
      index = merged.length;
      merged.push(nextMovie);
    }
    if (idKey) indexById.set(idKey, index);
  }
  return Object.freeze(merged);
}

export async function loadMovieInformationCatalog(currentMovies = []) {
  referenceMetadataPromise ||= import("../../data/vox_movie_information_catalog.json", { with: { type: "json" } })
    .then((module) => Array.isArray(module.default?.movies) ? module.default.movies : [])
    .catch(() => []);
  const referenceMovies = await referenceMetadataPromise;
  return mergeMovieInformationCatalog(currentMovies, referenceMovies);
}
