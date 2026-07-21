import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createDiscoveryPreferences,
  filterDiscoveryResults,
  getMissingDiscoveryCriteria,
  parseAndMergeDiscoveryPreferences,
} from "../src/lib/discoveryPreferences.js";
import { buildAuthoritativeDiscoveryContext } from "../src/lib/discoveryResultContext.js";
import * as vista from "../src/vistaClient.js";
import { installPublicAssetFetch } from "./lib/installPublicAssetFetch.mjs";

installPublicAssetFetch();

function readNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must be a named top-level function so its date-prompt behavior can be validated`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parameterQuote = null;
  let parameterEscaped = false;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    const character = source[index];
    if (parameterQuote) {
      if (parameterEscaped) parameterEscaped = false;
      else if (character === "\\") parameterEscaped = true;
      else if (character === parameterQuote) parameterQuote = null;
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      parameterQuote = character;
      continue;
    }
    if (character === "(") parameterDepth += 1;
    if (character !== ")") continue;
    parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  assert.notEqual(parametersEnd, -1, `${name} must have balanced parameters`);
  const bodyStart = source.indexOf("{", parametersEnd);
  assert.notEqual(bodyStart, -1, `${name} must have a function body`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} must have a balanced function body`);
}

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const helperSource = readNamedFunction(app, "resolveDatePromptReply");
const resolveDatePromptReply = Function(`${helperSource}; return resolveDatePromptReply;`)();

const datePrompt = { view: "discovery", missing: ["date"] };
const published = ["2026-07-16", "2026-07-17", "2026-07-18"];
const reportedJourneyDates = ["2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24"];

assert.equal(
  resolveDatePromptReply("23", reportedJourneyDates, datePrompt),
  "2026-07-23",
  "bare day 23 must resolve deterministically while the French to MOE journey is asking for its date",
);
assert.equal(
  resolveDatePromptReply("anything is fine at MOE on 23", reportedJourneyDates, { view: "empty", missing: [] }),
  "2026-07-23",
  "an embedded day with an explicit date marker must resolve before the date prompt is rendered",
);
assert.equal(
  resolveDatePromptReply("Anything is fine at Mall of the Emirates for the 23rd", reportedJourneyDates, { view: "empty", missing: [] }),
  "2026-07-23",
  "natural for-the-day wording must resolve inside a combined request",
);
assert.equal(resolveDatePromptReply("For the 23rd", reportedJourneyDates, datePrompt), "2026-07-23", "for-the-day wording must resolve while the date prompt is visible");
assert.equal(
  resolveDatePromptReply("I need 23 tickets", reportedJourneyDates, { view: "empty", missing: [] }),
  null,
  "an embedded ticket target must not be interpreted as a programming date",
);

assert.equal(
  resolveDatePromptReply("17", published, datePrompt),
  "2026-07-17",
  "a unique bare day reply must resolve to the selected cinema's published ISO date while the widget is asking for a date",
);
assert.equal(
  resolveDatePromptReply(" 17. ", published, datePrompt),
  "2026-07-17",
  "normal reply punctuation must not prevent a unique bare day selection",
);
assert.equal(
  resolveDatePromptReply("١٧", published, datePrompt),
  "2026-07-17",
  "Arabic-Indic digits must resolve through the same date-prompt behavior used by English text and transcripts",
);
assert.equal(
  resolveDatePromptReply("17", published, { view: "discovery", missing: ["preference"] }),
  null,
  "a bare number must not be interpreted as a date while the widget is asking for a preference",
);
assert.equal(
  resolveDatePromptReply("17", published, { view: "movies", missing: [] }),
  null,
  "a bare number must not be interpreted as a date outside the date-prompt context",
);
assert.equal(
  resolveDatePromptReply("17 tickets", published, datePrompt),
  null,
  "a ticket quantity must not be interpreted as a bare programming date",
);
assert.equal(
  resolveDatePromptReply("17", ["2026-07-17", "2027-07-17"], datePrompt),
  null,
  "an ambiguous day number must not silently select one of multiple published dates",
);
assert.equal(
  resolveDatePromptReply("31", published, datePrompt),
  null,
  "a day absent from the selected cinema's published dates must not be accepted",
);

const captureDate = app.slice(
  app.indexOf("const captureUserProgrammingDate"),
  app.indexOf("const showUnavailableProgrammingDate"),
);
assert.match(
  captureDate,
  /requestedProgrammingDate\(text\)\s*\|\|\s*resolveDatePromptReply\(text,\s*availableDates,\s*stageRef\.current\)/,
  "typed and voice transcript processing must apply the context-bound bare-day resolver against the selected cinema's dates",
);

const mall = vista.getCinemas().find((cinema) => /mall of the emirates/i.test(cinema.name));
assert.ok(mall, "the production snapshot must include Mall of the Emirates");
const mallDates = vista.getProgrammingDates({ cinemaId: mall.id });
const selectedMallDate = mallDates.find((date) => (
  mallDates.filter((candidate) => Number(candidate.slice(-2)) === Number(date.slice(-2))).length === 1
));
assert.ok(selectedMallDate, "Mall of the Emirates must expose at least one unambiguous published calendar day in the current snapshot");
const selectedMallDay = String(Number(selectedMallDate.slice(-2)));
assert.equal(
  resolveDatePromptReply(selectedMallDay, mallDates, datePrompt),
  selectedMallDate,
  "an actual published bare-day reply must resolve against Mall of the Emirates dates",
);

const guardSource = readNamedFunction(app, "guardMovieDisplayClaim");
const guardMovieDisplayClaim = Function(`${guardSource}; return guardMovieDisplayClaim;`)();
const falseDisplayClaim = "I've displayed the IMAX movies available at VOX Cinemas, Mall of the Emirates, for July 17th. Please let me know which movie you'd like to see!";
const guardedMissingDate = guardMovieDisplayClaim(falseDisplayClaim, {
  view: "discovery",
  missing: ["date"],
  question: "What date would you like to go?",
}, "en");
assert.notEqual(guardedMissingDate, falseDisplayClaim, "a displayed-movies claim must be replaced while the date is still missing");
assert.match(guardedMissingDate, /no movie|not displayed|date/i, "the missing-date replacement must describe the actual prompt state");
assert.equal(
  guardMovieDisplayClaim("I don't see any movies for July 17th.", {
    view: "discovery",
    missing: ["preference"],
    question: "What would you prefer?",
  }, "en"),
  "What would you prefer?",
  "a false zero-result claim must be replaced while the widget is still asking for a preference",
);
const guardedLoading = guardMovieDisplayClaim(falseDisplayClaim, { view: "loading", label: "Loading movies" }, "en");
assert.notEqual(guardedLoading, falseDisplayClaim, "a displayed-movies claim must be replaced while local results are loading");
assert.match(guardedLoading, /loading|not displayed|wait/i, "the loading replacement must describe unresolved local rendering");
const guardedZero = guardMovieDisplayClaim(falseDisplayClaim, { view: "movies", movies: [] }, "en");
assert.notEqual(guardedZero, falseDisplayClaim, "a displayed-movies claim must be replaced when zero local movie cards exist");
assert.match(guardedZero, /no movie|zero|do not have|not.*match/i, "the zero-result replacement must clearly state that no local movie cards match");
assert.equal(
  guardMovieDisplayClaim(falseDisplayClaim, { view: "movies", movies: [{ id: "imax-1", title: "Verified IMAX Film" }] }, "en"),
  falseDisplayClaim,
  "a displayed-movies claim may pass through only when at least one local movie card is rendered",
);
const openChoiceStage = {
  view: "movies",
  movies: [{ id: "one", title: "One" }, { id: "two", title: "Two" }],
  preferences: { openChoice: true },
};
assert.equal(
  guardMovieDisplayClaim("Two movies are displayed. What genre or time would you prefer?", openChoiceStage, "en"),
  "2 matching movie options are displayed. Choose a movie to continue.",
  "the agent must not ask for a preference again after an open choice has already produced movie cards",
);
assert.equal(
  guardMovieDisplayClaim("\u064a\u0648\u062c\u062f \u0641\u064a\u0644\u0645\u0627\u0646. \u0647\u0644 \u062a\u0641\u0636\u0644 \u0646\u0648\u0639\u0627\u064b \u0623\u0648 \u0648\u0642\u062a\u0627\u064b \u0645\u0639\u064a\u0646\u0627\u064b\u061f", openChoiceStage, "ar"),
  "\u062a\u0645 \u0639\u0631\u0636 2 \u0645\u0646 \u062e\u064a\u0627\u0631\u0627\u062a \u0627\u0644\u0623\u0641\u0644\u0627\u0645 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629. \u0627\u062e\u062a\u0631 \u0641\u064a\u0644\u0645\u0627\u064b \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629.",
  "the Arabic agent must not ask for a preference again after an open choice has already produced movie cards",
);

const onMessageStart = Math.max(app.indexOf("onMessage: async (message) =>"), app.indexOf("onMessage: (message) =>"));
const transportMessageFlow = app.slice(onMessageStart, app.indexOf("onError: (error)", onMessageStart));
const guardCallIndex = transportMessageFlow.indexOf("guardMovieDisplayClaim(");
assert.notEqual(guardCallIndex, -1, "incoming agent messages must pass through the local rendered-card claim guard");
assert.match(transportMessageFlow, /const claimStage = stageVisibleRef\.current \? stageRef\.current : \{ view: "empty"/, "hidden rich panels must be treated as empty by the rendered-card claim guard");
assert.ok(
  guardCallIndex < transportMessageFlow.lastIndexOf("say(role, displayedMessage)"),
  "the rendered-card claim guard must run before an agent message is added to the visible conversation",
);

const seed = createDiscoveryPreferences({
  cinemaId: mall.id,
  cinemaName: mall.name,
  date: selectedMallDate,
  dateSignal: "explicit",
});
const imaxTurn = parseAndMergeDiscoveryPreferences(seed, "IMAX", {
  cinemas: vista.getCinemas(),
  movies: vista.getDiscoveryMovieCatalog(),
  now: new Date(`${selectedMallDate}T08:00:00Z`),
  timeZone: "Asia/Dubai",
});
assert.equal(imaxTurn.preferences.cinemaId, mall.id, "an IMAX reply must retain the selected cinema");
assert.equal(imaxTurn.preferences.date, selectedMallDate, "an IMAX reply must retain the committed date");
assert.equal(imaxTurn.preferences.experience, "IMAX", "an IMAX reply must be retained as the experience filter");
assert.deepEqual(
  getMissingDiscoveryCriteria(imaxTurn.preferences, ["cinema", "date"]),
  [],
  "cinema, date, and IMAX must be enough to leave the date-prompt state",
);

const movies = await vista.getScheduledFilms(mall.id, selectedMallDate);
const metadata = filterDiscoveryResults({ movies, cinemas: vista.getCinemas(), preferences: imaxTurn.preferences });
const sessionGroups = await Promise.all(metadata.movies.map(async (movie) => (
  (await vista.getSessions(mall.id, movie.id, selectedMallDate)).map((session) => ({
    ...session,
    cinemaId: mall.id,
    scheduledFilmId: movie.id,
    movieId: movie.id,
  }))
)));
const filtered = filterDiscoveryResults({
  movies,
  sessions: sessionGroups.flat(),
  cinemas: vista.getCinemas(),
  preferences: imaxTurn.preferences,
});
const localResult = {
  shown: filtered.movies.length ? "filtered movie list" : "empty filtered movie list",
  cinema: { id: mall.id, name: mall.name },
  selectedDate: selectedMallDate,
  preferences: imaxTurn.preferences,
  movies: filtered.movies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    showtimes: filtered.sessions
      .filter((session) => String(session.movieId || session.scheduledFilmId) === String(movie.id))
      .map((session) => ({ time: session.time, experience: session.exp })),
  })),
};
const groundedContext = buildAuthoritativeDiscoveryContext(localResult);
if (localResult.movies.length) {
  assert.match(groundedContext, new RegExp(`exactly ${localResult.movies.length} movie card\\(s\\) are displayed`), "movie claims must state the exact locally rendered card count");
  for (const movie of localResult.movies) assert.ok(groundedContext.includes(movie.title), `movie claims must name the locally rendered title ${movie.title}`);
} else {
  assert.ok(groundedContext.includes("ZERO matching movie cards"), "zero local IMAX results must produce an explicit zero-result statement");
  assert.ok(groundedContext.includes("Do not say that options, choices, or a movie list are on screen"), "zero local results must prohibit a false displayed-movies claim");
}

const mainRender = app.slice(app.indexOf("const displayedBooking"));
const dateStripIndex = mainRender.indexOf("<DateStrip");
assert.notEqual(dateStripIndex, -1, "the result view must retain the date strip");
const dateStripConditionStart = mainRender.lastIndexOf("{cinema", dateStripIndex);
const dateStripRender = mainRender.slice(dateStripConditionStart, dateStripIndex + 20);
assert.ok(dateStripRender.includes('"movies"') && dateStripRender.includes('"showtimes"'), "the date strip must remain available beside actual movie and showtime results");
if (dateStripRender.includes('"discovery"')) {
  assert.match(dateStripRender, /stage\.view\s*===\s*"discovery"/, "discovery date-strip rendering must be an explicit branch");
  assert.match(dateStripRender, /stage\.missing\?*\.includes\("date"\)/, "a discovery prompt may show the date strip only while date itself is still the missing criterion");
}

const discoveryLoader = app.slice(app.indexOf("const loadDiscoveryForCinema"), app.indexOf("const findAvailableCinemasForCriteria"));
assert.ok(
  discoveryLoader.indexOf('showStage({ view: "movies", movies: enrichedMovies')
    < discoveryLoader.indexOf('shown: enrichedMovies.length ? "filtered movie list" : "empty filtered movie list"'),
  "a discovery result must update the local movie panel before returning any displayed-movie claim",
);
const typedFlow = app.slice(app.indexOf("const sendText"), app.indexOf("const sendUiTurn"));
assert.ok(
  typedFlow.indexOf("discoveryRouteResult = await routeDiscoveryTurn")
    < typedFlow.indexOf("conversation.sendUserMessage(agentFacingValue)"),
  "text must await local discovery rendering before the agent receives the turn",
);
assert.match(
  typedFlow,
  /buildAuthoritativeDiscoveryContext\(discoveryRouteResult\)/,
  "the agent must receive authoritative local rendering state before describing IMAX results",
);

const discoveryRoute = app.slice(app.indexOf("const routeDiscoveryTurn"), app.indexOf("useEffect(() =>", app.indexOf("const routeDiscoveryTurn")));
assert.match(discoveryRoute, /const directCinemaReply = Boolean\(cinemaOverride && isDirectCinemaSelectionUtterance/, "a direct cinema-only reply must be identified before unresolved movie-title handling");
assert.match(discoveryRoute, /rawTurn && !locationIntent && !directCinemaReply && !dateOnlyReply/, "location, cinema, and date-only replies must never be retained as unresolved movie titles");
assert.match(discoveryRoute, /directCinemaReply \|\| rawPreferencePatch\.patch\.movieId/, "a direct cinema-only reply must clear any stale pending movie title");
assert.match(
  discoveryRoute,
  /const shouldVerifyCinemaList = Boolean\(preferences\.date && \([\s\S]{0,260}preferences\.openChoice/,
  "a dated city request with an open movie choice must verify each cinema before showing the picker",
);

const missingCriteriaStart = app.indexOf("const discoveryMissingCriteria");
const missingCriteriaEnd = app.indexOf("const discoveryQuestion", missingCriteriaStart);
assert.ok(missingCriteriaStart >= 0 && missingCriteriaEnd > missingCriteriaStart, "the discovery missing-criteria integration must remain inspectable");
const missingCriteriaSource = app.slice(missingCriteriaStart, missingCriteriaEnd);
assert.match(missingCriteriaSource, /preferences\.openChoice/, "an explicit open choice such as anything is fine must satisfy the preference requirement");
assert.match(
  missingCriteriaSource,
  /preferences\.recommendationIntent\s*===\s*["']unsupported_language_afghan["'][\s\S]*missing\.push\(["']unsupported_language_afghan["']\)/,
  "the retained Afghan intent must remain an explicit missing clarification instead of becoming a catalog filter",
);
const discoveryQuestionEnd = app.indexOf("const showDiscoveryPrompt", missingCriteriaEnd);
assert.ok(discoveryQuestionEnd > missingCriteriaEnd, "the discovery clarification question must remain inspectable");
const discoveryQuestionSource = app.slice(missingCriteriaEnd, discoveryQuestionEnd);
assert.match(
  discoveryQuestionSource,
  /field\s*===\s*["']unsupported_language_afghan["'][\s\S]*(?:Afghan|أفغان)/iu,
  "the discovery prompt must ask a specific Afghan language clarification",
);
const routeAfghanClarification = discoveryRoute.indexOf('missing.includes("unsupported_language_afghan")');
const routeAvailabilityLoad = discoveryRoute.indexOf("await loadDiscoveryForCinema");
assert.ok(
  routeAfghanClarification >= 0 && routeAvailabilityLoad > routeAfghanClarification,
  "the conversational route must display the Afghan clarification before loading availability",
);
const loaderAfghanClarification = discoveryLoader.indexOf('freshMissing.includes("unsupported_language_afghan")');
const loaderAvailabilityFilter = discoveryLoader.indexOf("filterDiscoveryResults({ movies");
assert.ok(
  loaderAfghanClarification >= 0 && loaderAvailabilityFilter > loaderAfghanClarification,
  "the availability loader must stop for the Afghan clarification before filtering any movie catalog",
);
assert.match(discoveryRoute, /openChoice|isOpenDiscoveryChoiceReply/, "the discovery route must recognize an open-choice reply without treating it as an unknown title");

const voiceGateStart = app.indexOf("if (bookingContext && !directMovieSelection", app.indexOf("const conversationOptions"));
const voiceGateEnd = app.indexOf("if (directMovieSelection)", voiceGateStart);
assert.ok(voiceGateStart >= 0 && voiceGateEnd > voiceGateStart, "the spoken discovery response gate must remain inspectable");
const voiceGateSource = app.slice(voiceGateStart, voiceGateEnd);
assert.match(voiceGateSource, /pendingVoiceDiscoveryTurnRef\.current\s*=\s*\{/, "a spoken discovery request must be retained until the authoritative tool runs");
assert.match(voiceGateSource, /Call show_movie_selection exactly once now and wait for its response before speaking/, "voice must wait for the existing client tool before making an availability claim");
assert.doesNotMatch(voiceGateSource, /void\s+routeDiscoveryTurn/, "voice must not race a fire-and-forget discovery request against the agent response");

const movieToolStart = app.indexOf("show_movie_selection: async");
const movieToolEnd = app.indexOf("show_showtimes: async", movieToolStart);
const movieToolSource = app.slice(movieToolStart, movieToolEnd);
assert.match(movieToolSource, /const pendingVoiceTurn = pendingVoiceDiscoveryTurnRef\.current/, "show_movie_selection must consume the pending spoken request");
assert.match(movieToolSource, /await routeDiscoveryTurn\(pendingVoiceTurn\.text/, "the wait-enabled tool must complete local filtering before returning to the voice agent");
assert.match(movieToolSource, /voiceAvailabilityGate:\s*"completed"/, "the tool result must explicitly report completion of the voice availability gate");

console.log(`Validated bare day 17 and 23 parsing, open-choice progression, live bare-day progression, and grounded IMAX rendering for ${mall.name} on ${selectedMallDate}.`);
