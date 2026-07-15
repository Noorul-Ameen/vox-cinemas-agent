const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

export function buildAuthoritativeDiscoveryContext(result, { maxMovies = 8, maxShowtimes = 4 } = {}) {
  if (!result || typeof result !== "object") return "";
  const cinema = clean(result.cinema?.name);
  const date = clean(result.selectedDate);
  const movies = Array.isArray(result.movies) ? result.movies.slice(0, maxMovies) : [];
  const scope = [cinema, date].filter(Boolean).join(" on ");

  if (!movies.length) {
    return `Authoritative widget result${scope ? ` for ${scope}` : ""}: no matching movies or showtimes are displayed. Do not invent or name an alternative movie, showtime, cinema, or date.`;
  }

  const rows = movies.map((movie) => {
    const title = clean(movie?.title) || "Untitled movie";
    const showtimes = Array.isArray(movie?.showtimes)
      ? movie.showtimes.slice(0, maxShowtimes).map((session) => {
        const time = clean(session?.time);
        const experience = clean(session?.experience);
        return [time, experience].filter(Boolean).join(" ");
      }).filter(Boolean)
      : [];
    return `${title}: ${showtimes.length ? showtimes.join(", ") : "no displayed showtime"}`;
  });

  const omitted = Math.max(0, (Array.isArray(result.movies) ? result.movies.length : 0) - movies.length);
  return `Authoritative widget results${scope ? ` for ${scope}` : ""}: ${rows.join(" | ")}${omitted ? ` | ${omitted} additional displayed movie(s) omitted from this short context` : ""}. Mention only these supplied movie titles and showtimes; never substitute remembered or invented programming.`;
}
