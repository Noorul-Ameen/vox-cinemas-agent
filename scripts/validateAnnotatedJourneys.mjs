import assert from "node:assert/strict";
import fs from "node:fs";
import { guardAgentStateClaim } from "../src/lib/agentStateTruth.js";
import { resolveCinemaCandidate } from "../src/lib/cinemaRouting.js";
import { isCheckoutSeatEditTurn } from "../src/lib/checkoutConversationRouting.js";
import { localizedStageMessage } from "../src/lib/discoveryPromptLocalization.js";
import { STRINGS } from "../src/i18n/strings.js";
import * as vista from "../src/vistaClient.js";
import { installPublicAssetFetch } from "./lib/installPublicAssetFetch.mjs";

installPublicAssetFetch();

const guardedShowtimePause = guardAgentStateClaim("The booking process is temporarily paused.", {
  stage: {
    view: "showtimes",
    movie: { title: "The Odyssey" },
    sessions: [{ sessionId: "s1", time: "22:00" }, { sessionId: "s2", time: "23:00" }],
  },
  locale: "en",
});
assert.doesNotMatch(guardedShowtimePause, /paused/iu, "customer-facing agent output must never describe a valid showtime step as paused");
assert.match(guardedShowtimePause, /2 showtime options are shown for The Odyssey/iu, "a false pause claim must be replaced with the actual visible showtime state");

for (const falsePauseClaim of [
  "I've temporarily paused what was on screen.",
  "I've paused the current options.",
]) {
  const corrected = guardAgentStateClaim(falsePauseClaim, {
    stage: {
      view: "showtimes",
      movie: { title: "The Odyssey" },
      sessions: [{ sessionId: "s1", time: "22:00" }, { sessionId: "s2", time: "23:00" }],
    },
    locale: "en",
  });
  assert.doesNotMatch(corrected, /paused/iu, "first-person pause claims must be replaced with the visible state");
  assert.match(corrected, /2 showtime options are shown for The Odyssey/iu);
}

const guardedHiddenCheckoutPause = guardAgentStateClaim("Checkout has been temporarily paused.", {
  stage: { view: "empty" },
  pendingOrder: { checkoutId: "checkout-1", seats: ["E1", "E2"] },
  locale: "en",
});
assert.doesNotMatch(guardedHiddenCheckoutPause, /paused/iu, "a retained checkout must be described without internal pause terminology");
assert.match(guardedHiddenCheckoutPause, /preserved but is not currently shown/iu, "a hidden checkout correction must tell the guest how to restore it");

function readNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must remain a named function for behavioral validation`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] !== ")") continue;
    parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  assert.notEqual(parametersEnd, -1, `${name} must have balanced parameters`);
  const bodyStart = source.indexOf("{", parametersEnd);
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
  assert.fail(`${name} must have a balanced body`);
}

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const prompt = fs.readFileSync(new URL("../src/lib/voxiPrompt.js", import.meta.url), "utf8");
const richMedia = fs.readFileSync(new URL("../src/components/RichMedia.jsx", import.meta.url), "utf8");

const cinemas = vista.getCinemas();
const dcc = resolveCinemaCandidate(cinemas, "dcc");
assert.equal(dcc?.id, "0001", "DCC must resolve locally to City Centre Deira instead of leaving the cinema picker open");
assert.equal(resolveCinemaCandidate(cinemas, "dcc tonight")?.id, "0001", "DCC must remain resolvable inside a natural discovery turn");
assert.match(app, /replace\(\/\\bdcc\\b\/giu, cinema\.name\)/, "DCC must be expanded before the agent receives the turn");

const movieGuardSource = readNamedFunction(app, "guardMovieDisplayClaim");
const guardMovieDisplayClaim = Function("localizedStageMessage", `${movieGuardSource}; return guardMovieDisplayClaim;`)(localizedStageMessage);
const falseCinemaMovieClaim = "Great choice! Let's see what's playing at City Centre Deira tonight. Please have a look at the options on your screen.";
assert.equal(
  guardMovieDisplayClaim(falseCinemaMovieClaim, { view: "cinemas", notice: "Which VOX Cinemas UAE location would you like?" }, "en"),
  "Which VOX Cinemas UAE location would you like?",
  "a movie-options claim must be replaced while the cinema picker is the authoritative panel",
);

assert.equal(
  guardAgentStateClaim("What movie would you like to watch?", {
    stage: { view: "discovery", missing: ["date"], question: "What date would you like to go?" },
    locale: "en",
  }),
  "What date would you like to go?",
  "the agent must ask the first locally missing criterion",
);

assert.equal(
  guardAgentStateClaim("Yes, IMAX is available at VOX Cinemas Yas Mall. What date would you like to go?", {
    stage: { view: "discovery", missing: ["date"], question: "What date would you like to go?" },
    locale: "en",
  }),
  "What date would you like to go?",
  "the agent must not confirm experience availability before the missing date is supplied and verified",
);
assert.equal(
  guardAgentStateClaim("آيماكس متاح في ياس مول. ما التاريخ الذي تفضله؟", {
    stage: { view: "discovery", missing: ["date"], question: "ما التاريخ الذي تفضّله؟" },
    locale: "ar",
  }),
  "ما التاريخ الذي تفضّله؟",
  "Arabic output must not confirm experience availability before the missing date is supplied and verified",
);

for (const { locale, question, unsafeReply } of [
  {
    locale: "en",
    question: "Do you mean Afghan-produced movies, Dari-language movies, or Pashto-language movies?",
    unsafeReply: "I cannot suggest Afghan movies. Would you like Dari or Pashto movies instead?",
  },
  {
    locale: "ar",
    question: "هل تقصد أفلاماً أفغانية الإنتاج، أم أفلاماً باللغة الدارية، أم باللغة البشتوية؟",
    unsafeReply: "لا توجد أفلام أفغانية. هل تريد أفلاماً باللغة الدارية؟",
  },
]) {
  assert.equal(
    guardAgentStateClaim(unsafeReply, {
      stage: { view: "discovery", missing: ["unsupported_language_afghan"], question },
      locale,
    }),
    question,
    `${locale}: Afghan origin and language ambiguity must always use the complete authoritative clarification`,
  );
}

assert.equal(
  guardAgentStateClaim("What movie would you like to watch?", {
    stage: { view: "showtimes", movie: { title: "Ezma" }, sessions: [{ sessionId: "s1", time: "15:35" }] },
    locale: "en",
  }),
  "Ezma is selected. Choose one of the displayed showtimes.",
  "a delayed movie question must not contradict an already rendered showtime step",
);

const deiraMovieCards = Array.from({ length: 11 }, (_, index) => ({ id: `deira-${index + 1}`, title: `Deira Movie ${index + 1}` }));
const conciseEnglishMovieChoice = "11 movie options are shown. Visible titles include Deira Movie 1, Deira Movie 2, Deira Movie 3, Deira Movie 4, Deira Movie 5. Which movie would you like?";
const manyTitleReply = `Available movies include ${deiraMovieCards.slice(0, 8).map((movie) => movie.title).join(", ")}.`;
assert.equal(
  guardAgentStateClaim(manyTitleReply, { stage: { view: "movies", movies: deiraMovieCards }, locale: "en" }),
  conciseEnglishMovieChoice,
  "a response naming more than five visible movies must become one concise grounded choice question",
);

const manyTimeReply = "Available showtimes are 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, and 12:30.";
assert.equal(
  guardAgentStateClaim(manyTimeReply, { stage: { view: "movies", movies: deiraMovieCards }, locale: "en" }),
  conciseEnglishMovieChoice,
  "a response narrating many showtimes before one movie is selected must become the concise visible-movie choice",
);

const conciseArabicMovieChoice = "تظهر الآن 11 من خيارات الأفلام. من العناوين الظاهرة: Deira Movie 1، Deira Movie 2، Deira Movie 3، Deira Movie 4، Deira Movie 5. أي فيلم تود اختياره؟";
assert.equal(
  guardAgentStateClaim(`الأفلام المتاحة هي ${deiraMovieCards.slice(0, 7).map((movie) => movie.title).join("، ")}.`, {
    stage: { view: "movies", movies: deiraMovieCards },
    locale: "ar",
  }),
  conciseArabicMovieChoice,
  "an Arabic response naming too many visible movies must use the same five-title grounded cap",
);
assert.equal(
  guardAgentStateClaim("مواعيد العرض هي 09:00، 09:30، 10:00، 10:30، 11:00، 11:30، 12:00، و12:30.", {
    stage: { view: "movies", movies: deiraMovieCards },
    locale: "ar",
  }),
  conciseArabicMovieChoice,
  "an Arabic many-time narration on the movie grid must become one concise movie-choice question",
);

const safeShortMovieReply = "Deira Movie 1 is a family adventure suitable for a relaxed outing.";
assert.equal(
  guardAgentStateClaim(safeShortMovieReply, { stage: { view: "movies", movies: deiraMovieCards }, locale: "en" }),
  safeShortMovieReply,
  "a short single-movie detail must pass through unchanged",
);
const safeSingleMovieTimes = "Deira Movie 1 is showing at 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, and 12:00.";
assert.equal(
  guardAgentStateClaim(safeSingleMovieTimes, { stage: { view: "movies", movies: deiraMovieCards }, locale: "en" }),
  safeSingleMovieTimes,
  "a legitimate single-movie time answer must not be truncated solely because it contains several times",
);
const safeArabicMovieReply = "Deira Movie 1 فيلم عائلي مناسب.";
assert.equal(
  guardAgentStateClaim(safeArabicMovieReply, { stage: { view: "movies", movies: deiraMovieCards }, locale: "ar" }),
  safeArabicMovieReply,
  "a short Arabic single-movie detail must pass through unchanged",
);

const movieStepTransactionCorrection = guardAgentStateClaim(
  "Your booking is confirmed and payment was successful.",
  { stage: { view: "movies", movies: deiraMovieCards }, locale: "en" },
);
assert.equal(
  movieStepTransactionCorrection,
  "11 movie options are shown. Choose one of the displayed movies to continue.",
  "an unsafe transaction claim after replacement discovery must describe the visible movie cards",
);
assert.doesNotMatch(movieStepTransactionCorrection, /booking|payment|reservation|confirmed/i, "a movie-step correction must contain no stale transaction copy");

assert.equal(
  guardAgentStateClaim("Your reservation is ready.", {
    stage: {
      view: "showtimes",
      movie: { title: "Deira Movie 1" },
      sessions: [{ sessionId: "d1", time: "09:30" }, { sessionId: "d2", time: "11:45" }],
    },
    locale: "en",
  }),
  "2 showtime options are shown for Deira Movie 1. Choose one displayed showtime to continue.",
  "an unsafe transaction claim on showtimes must describe only the selected movie and visible showtime step",
);

const visibleDiscoveryQuestion = "What date would you like to go?";
assert.equal(
  guardAgentStateClaim("Your booking has been completed.", {
    stage: { view: "discovery", missing: ["date"], question: visibleDiscoveryQuestion },
    locale: "en",
  }),
  visibleDiscoveryQuestion,
  "an unsafe transaction claim on discovery must return the exact visible question before any booking copy",
);

assert.match(
  guardAgentStateClaim("Your booking is confirmed.", { stage: { view: "movies", movies: deiraMovieCards.slice(0, 2) }, locale: "ar" }),
  /2[\s\S]*خيارات الأفلام[\s\S]*اختر فيلماً/u,
  "the visible-movie correction must remain grounded in Arabic mode",
);

const groundedMovieReply = "11 movie options are shown. Choose one of the displayed movies to continue.";
assert.equal(
  guardAgentStateClaim(groundedMovieReply, { stage: { view: "movies", movies: deiraMovieCards }, locale: "en" }),
  groundedMovieReply,
  "safe grounded movie guidance must pass through unchanged",
);

assert.match(
  guardAgentStateClaim("Which showtime would you like?", {
    stage: { view: "seatmap", movie: { title: "Ezma" }, session: { sessionId: "s1", time: "15:35" } },
    locale: "en",
  }),
  /seat map is open/i,
  "a delayed showtime question must not replace an already rendered seat map",
);

const checkoutStage = { view: "checkout", order: { checkoutId: "checkout-1", seats: ["E1"], movieTitle: "The Odyssey" } };
const pendingOrder = { checkoutId: "checkout-1", seats: ["E1"], movieTitle: "The Odyssey" };
assert.match(
  guardAgentStateClaim("Your booking for The Odyssey with seat E1 is confirmed. The total is 50 AED.", { stage: checkoutStage, pendingOrder, locale: "en" }),
  /booking is not confirmed yet/i,
  "checkout must never be described as a confirmed booking",
);
assert.match(
  guardAgentStateClaim("Your current booking is confirmed and shown.", { stage: { view: "history" }, locale: "en" }),
  /on-device booking summaries are shown/i,
  "a history response must stay grounded in the visible saved summaries instead of falling back to checkout guidance",
);
const activeHistoryBooking = {
  ref: "WLHISTORY1",
  movieTitle: "Minions & Monsters",
  performanceDate: "2026-07-24",
  showtime: "20:10",
  cinemaName: "Mall of the Emirates",
  bookingStatus: "summary_saved",
  cancelled: false,
};
assert.equal(
  guardAgentStateClaim("I could not find any active bookings for you.", {
    stage: { view: "history", bookings: [activeHistoryBooking], historyFilter: "active" },
    bookingHistory: { bookings: [activeHistoryBooking], activeOnly: true, hasActive: true },
    locale: "en",
  }),
  "1 current on-device booking summary is shown. Select one to view its details, or use its Mark cancelled button. These are device records, not provider confirmations.",
  "a populated authoritative history must replace a generated false-empty reply",
);
assert.equal(
  guardAgentStateClaim("Your booking is confirmed and ready.", {
    stage: { view: "history", bookings: [], historyFilter: "all" },
    bookingHistory: { bookings: [], activeOnly: false, hasActive: false },
    locale: "en",
  }),
  "No booking summaries are saved on this device.",
  "an empty authoritative history must never invent a visible or provider-confirmed booking",
);
assert.equal(
  guardAgentStateClaim("لا توجد حجوزات حالية لديك.", {
    stage: { view: "history", bookings: [activeHistoryBooking], historyFilter: "active" },
    bookingHistory: { bookings: [activeHistoryBooking], activeOnly: true, hasActive: true },
    locale: "ar",
  }),
  "يظهر الآن 1 من ملخصات حجوزاتك الحالية المحفوظة على هذا الجهاز. اختر ملخصاً لعرض التفاصيل، أو استخدم زر تسجيله كملغى. هذه سجلات محفوظة على الجهاز وليست تأكيدات من مزود الحجز.",
  "Arabic history responses must use the same authoritative populated-history truth guard",
);
assert.match(
  guardAgentStateClaim("I can't change the seats after the booking is confirmed. You'll need a new booking.", { stage: checkoutStage, pendingOrder, locale: "en" }),
  /can change seats before completing checkout/i,
  "seat editing must not be refused while checkout is pending",
);
assert.match(
  guardAgentStateClaim("I've displayed the seat map for The Odyssey.", { stage: checkoutStage, pendingOrder, locale: "en" }),
  /shown in checkout/i,
  "a stale seat-map claim must be aligned with the visible checkout",
);
assert.equal(
  guardAgentStateClaim("The seat map for Toy Story 5 at Mall of the Emirates on July 24th at 8:45 PM is ready. Please select three seats.", {
    stage: { view: "movies", movies: [{ id: "toy-story-5", title: "Toy Story 5" }] },
    locale: "en",
  }),
  "1 movie option is shown. Choose one of the displayed movies to continue.",
  "a premature seat-map claim must guide the guest from the movie card that is actually visible",
);
assert.equal(
  guardAgentStateClaim("I see you've selected Toy Story 5. Please choose your three seats on the seat map.", {
    stage: { view: "movies", movies: [{ id: "toy-story-5", title: "Toy Story 5" }] },
    locale: "en",
  }),
  "1 movie option is shown. Choose one of the displayed movies to continue.",
  "premature seat-selection instructions must not imply that an undisplayed seat map is interactive",
);
assert.equal(
  guardAgentStateClaim("Please select three seats to continue.", {
    stage: {
      view: "showtimes",
      movie: { id: "toy-story-5", title: "Toy Story 5" },
      sessions: [{ sessionId: "toy-story-5-2045", time: "20:45" }],
    },
    locale: "en",
  }),
  "1 showtime option is shown for Toy Story 5. Choose one displayed showtime to continue.",
  "seat guidance must not skip over an exact showtime that has not been selected",
);
const hiddenCheckoutGuidance = guardAgentStateClaim("Checkout is displayed. Complete your booking on the screen.", {
  stage: { view: "offers" },
  pendingOrder,
  locale: "en",
});
assert.match(hiddenCheckoutGuidance, /preserved but is not currently shown/i, "an FAQ or offer panel must not be described as visible checkout");
assert.match(hiddenCheckoutGuidance, /return to checkout/i, "a hidden checkout must provide the deterministic restore path");
assert.doesNotMatch(hiddenCheckoutGuidance, /shown in checkout/i, "hidden-checkout guidance must not claim that checkout is on screen");

const savedBooking = {
  view: "booking",
  booking: {
    movieTitle: "The Odyssey",
    ref: "WLTEST1",
    verified: false,
    demo: true,
    paymentStatus: "simulated_not_charged",
    bookingStatus: "summary_saved",
  },
};
for (const claim of [
  "Your booking for The Odyssey is confirmed. The total is 84 AED.",
  "You've selected seats E1 and E3. Please complete your booking on the screen.",
  "Your tickets are ready.",
  "Your reservation is ready.",
  "Use the QR code on screen for admission.",
]) {
  const guarded = guardAgentStateClaim(claim, { stage: savedBooking, locale: "en" });
  assert.match(guarded, /booking summary.*saved on this device/i, "saved summaries must use saved-summary language");
  assert.match(guarded, /no payment was charged/i, "saved summaries must preserve the no-charge boundary");
}
assert.match(
  guardAgentStateClaim("Checkout is displayed. Complete payment.", {
    stage: { view: "seatmap", selectedSeats: ["E1"] },
    locale: "en",
  }),
  /seat map is open/i,
  "checkout must not be claimed while the seat map is authoritative",
);
for (const claim of [
  "To cancel a booking, I need the booking reference. Do you have it?",
  "What is the booking reference you would like to cancel?",
]) {
  assert.equal(
    guardAgentStateClaim(claim, {
      stage: { view: "history", purpose: "cancellation_target_selection", candidateRefs: ["WL1", "WL2"] },
      locale: "en",
    }),
    "Choose one of the current summaries shown, by movie title or device reference.",
    "multiple displayed cancellation targets must be selectable by title as well as reference",
  );
}
assert.match(
  guardAgentStateClaim("Your selected seats are A1 and A2. The total is AED 50.", {
    stage: checkoutStage,
    pendingOrder,
    locale: "en",
  }),
  /selected seats E1 are shown in checkout/i,
  "claimed checkout seats and totals must match the authoritative order",
);
assert.match(
  guardAgentStateClaim("Your reservation is ready.", {
    stage: { ...savedBooking, booking: { ...savedBooking.booking, cancelled: true, bookingStatus: "cancelled_demo" } },
    locale: "en",
  }),
  /marked cancelled on this device.*no refund was processed/i,
  "a cancelled device summary must retain its cancellation and no-refund boundary",
);
const verifiedClaim = "Your booking is confirmed.";
assert.equal(
  guardAgentStateClaim(verifiedClaim, { stage: { view: "booking", booking: { verified: true, bookingStatus: "confirmed" } }, locale: "en" }),
  verifiedClaim,
  "a provider-verified booking confirmation may pass through unchanged",
);

for (const turn of [
  "edit seats",
  "change my seats",
  "go back",
  "return to the seat map",
  "I want to change seats",
  "Can I edit my seats?",
  "Please change the seats",
  "add one more seat",
  "Change my seats to E1 and E3",
  "remove E3",
  "تعديل المقاعد",
  "ارجع إلى المقاعد",
  "أريد تغيير المقاعد",
]) {
  assert.equal(isCheckoutSeatEditTurn(turn), true, `${turn} must return an active checkout to seat editing`);
}
assert.equal(isCheckoutSeatEditTurn("return to checkout"), false, "return-to-checkout language must remain distinct from edit-seat language");

const ticketSource = readNamedFunction(app, "extractTicketQuantity");
const extractTicketQuantity = Function("MAX_TICKETS", `${ticketSource}; return extractTicketQuantity;`)(10);
assert.equal(extractTicketQuantity("make seat to 2"), 2, "the annotated seat-target wording must resolve to a target of two seats");
assert.equal(extractTicketQuantity("change the number of seats to three"), 3, "a natural seat-count adjustment must remain a conversational target");
assert.equal(extractTicketQuantity("three tickets"), 3, "the original ticket-target wording must remain supported");

const voiceStart = Math.max(app.indexOf("onMessage: async (message) =>"), app.indexOf("onMessage: (message) =>"));
const voiceFlow = app.slice(voiceStart, app.indexOf("onError: (error)", voiceStart));
const textFlow = app.slice(app.indexOf("const sendText"), app.indexOf("const sendUiTurn"));
for (const [name, flow] of [["voice", voiceFlow], ["text", textFlow]]) {
  assert.match(flow, /const checkoutSeatEditTurn =/, `${name} must classify checkout seat-edit turns locally`);
  assert.match(flow, /stageRef\.current\.view !== "checkout"\) restoreActiveCheckout\(\)/, `${name} must restore a hidden checkout before editing seats`);
  assert.ok(flow.indexOf("checkoutSeatEditTurn") < flow.indexOf("resolveVisibleSeatTurn"), `${name} must return to the seat map before resolving a visible seat confirmation`);
}
const checkoutBack = app.slice(app.indexOf("const backToSeatMapFromCheckout"), app.indexOf("const executeCancellationMutation"));
assert.match(checkoutBack, /activeCheckoutStage\(\)\) restoreActiveCheckout\(\)/, "edit seats must also work when another panel temporarily covers checkout");
assert.match(checkoutBack, /requestedSeatTargetRef\.current = requestedTarget[\s\S]*setRequestedSeatTarget\(requestedTarget\)/, "a requested seat target must appear on the restored seat map");

const paymentCompletion = app.slice(app.indexOf("const handleCheckoutReviewComplete"), app.indexOf("CLIENT TOOLS"));
assert.match(paymentCompletion, /\["stale_checkout", "stale_device_session"\][\s\S]*checkoutPaymentActiveRef\.current = false/, "stale checkout outcomes must release the payment navigation lock");
assert.match(paymentCompletion, /checkout session changed[\s\S]*No payment was taken/i, "stale checkout outcomes must display a no-charge recovery message");
assert.doesNotMatch(paymentCompletion, /sendUiTurn\(`Booking summary/, "completion must not trigger a duplicate agent response after the deterministic summary notice");
const cancellationRouting = app.slice(app.indexOf("const routeCancellationTurn"), app.indexOf("const cancellationResultContext"));
assert.match(cancellationRouting, /const explicitLifecycleTarget = resolution\.matchedBy\?\.length > 0/, "a cancelled or ineligible summary must require an explicit conversational selector");
assert.match(cancellationRouting, /explicitLifecycleTarget && \["ineligible", "already_cancelled"\]/, "generic cancellation must not target a cancelled or ineligible summary");
assert.equal((app.match(/visibleBooking: stageRef\.current\.view === "booking" && isCurrentBooking\(bookingRef\.current\)/g) || []).length, 1, "the exact-reference cancellation tool must ignore a cancelled or past visible summary");
const cancellationCompletion = app.slice(app.indexOf("const executeCancellationMutation"), app.indexOf("const completeCancellation"));
assert.match(cancellationCompletion, /if \(isDemoSimulation\) \{[\s\S]*deterministic system notice already states this outcome/, "device-only cancellation must not elicit a duplicate agent completion after its deterministic notice");

assert.match(prompt, /never describe the pending checkout as confirmed/i, "the voice prompt must prohibit premature checkout confirmation");
assert.match(prompt, /Never call it a confirmed booking, successful payment, reservation, admission ticket, or ready QR/i, "the voice prompt must distinguish a saved summary from a verified booking");
assert.match(prompt, /DCC/i, "the voice prompt must recognize the DCC alias grounding");

assert.match(app, /const VISIBLE_TRANSCRIPT_MESSAGES = 8/, "long transcripts must use a bounded recent-message view");
assert.match(app, /const RICH_STAGE_TRANSCRIPT_MESSAGES = 4/, "rich panels must reserve space by showing a shorter recent transcript");
assert.match(app, /messages\.slice\(-transcriptMessageLimit\)/, "older messages must be collapsed without deleting the full transcript");
assert.match(app, /aria-expanded=\{showFullTranscript\}/, "the full transcript must remain accessible through an explicit control");
assert.match(app, /const authoritativeBookingHistoryForStage = \(historyStage\) => \{[\s\S]*sortBookingsForDisplay\(readBookings\(\{ strict: true \}\)\)[\s\S]*hasActive: visibleBookings\.some\(\(item\) => isCurrentBooking\(item\)\)/, "agent history output must be grounded against the latest strictly read booking history");
assert.match(app, /storageUnavailable:\s*true/, "history truth grounding must distinguish unavailable storage from an empty history");
assert.match(app, /bookingHistory: authoritativeBookingHistoryForStage\(claimStage\)/, "the shared agent output guard must receive authoritative history for typed, quick-action, and voice responses");
assert.match(app, /showStage\(\{[\s\S]{0,180}view: "history",[\s\S]{0,180}bookings: visibleBookings,[\s\S]{0,180}historyFilter: activeOnly \? "active" : "all"/, "the shared history opener must synchronously retain the exact visible history scope");
assert.match(app, /chips\.map\(\(chip, index\)[\s\S]{0,220}index === 2[\s\S]{0,140}openHistory\(\{ forceOpen: true \}\)/, "the booking-history quick action must open authoritative device records directly instead of depending on a model tool call");
assert.match(richMedia, /const visibleMovies = showAll \? movies : movies\.slice\(0, 4\)/, "movie results must begin with a compact progressive list");
assert.match(richMedia, /const visible = key \|\| showAll \? matching : matching\.slice\(0, 6\)/, "the cinema picker must begin with a compact progressive list while retaining search");
for (const locale of ["en", "ar"]) {
  assert.ok(STRINGS[locale]["app.showEarlierMessages"], `${locale} must label the earlier-message control`);
  assert.ok(STRINGS[locale]["app.showRecentMessages"], `${locale} must label the recent-message control`);
}

assert.doesNotMatch(STRINGS.en["app.paymentSimulated"], /environment|prototype|demo|simulation/i, "the saved-summary notice must remain leadership-ready");
assert.match(STRINGS.en["app.paymentSimulated"], /No payment was charged/, "the saved-summary notice must remain transactionally truthful");
assert.doesNotMatch(STRINGS.en["checkout.demoDisclaimer"], /environment|prototype|demo|simulation/i, "checkout safety copy must avoid product-wide implementation labels");

console.log("Validated annotated DCC discovery, transcript truth, checkout seat editing, saved-summary wording, and full-history access for text and voice.");
