import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { BadgePercent, History, MapPin, Mic, MicOff, RotateCcw, Send, Sparkles } from "lucide-react";
import { C } from "./theme.js";
import { BookingCard, CinemaPicker, MovieGrid, SeatMap, Showtimes } from "./components/RichMedia.jsx";
import BookingHistory from "./components/BookingHistory.jsx";
import Checkout from "./components/Checkout.jsx";
import HandoverPanel from "./components/HandoverPanel.jsx";
import OffersPanel from "./components/OffersPanel.jsx";
import { appendBooking, clearBookings, findBooking, readBookings } from "./bookingStore.js";
import { DEMO_CARD_STORAGE_KEY } from "./checkoutSafety.js";
import { useI18n } from "./i18n/I18nProvider.jsx";
import { HANDOVER_TRIGGER, buildHandoverPayload, isClarificationFailureReason } from "./lib/handoverSummary.js";
import { resolveFilmCandidate } from "./lib/fuzzyResolvers.js";
import { isCinemaSelectionTurn, isDirectCinemaSelectionUtterance, resolveCinemaCandidate } from "./lib/cinemaRouting.js";
import { normalizeElevenLabsMessageEvent } from "./lib/conversationMessage.js";
import { resolveLanguageSignal } from "./lib/languageSwitch.js";
import { buildTransportHandoff, createConversationJourney, inferIntent, journeyDynamicVariables, journeyReducer, syncJourney } from "./lib/conversationJourney.js";
import { resolveProgrammingDateSelection } from "./lib/programmingDateSelection.js";
import { startTransportWithRetirement } from "./lib/transportStart.js";
import { VOXI_AGENT_PROMPT, VOXI_FIRST_MESSAGES, buildVoxiContext } from "./lib/voxiSession.js";
import { OFFER_META } from "./offers/offersData.js";
import { resolveOffer, resolveOfferForBankAndCard } from "./offers/offerResolver.js";
import { VOX_FAQ_ENTRIES, buildFaqContextForQuery, classifyFaqActionIntent, serializeFaqContext } from "./knowledge/index.js";
import * as vista from "./vistaClient.js";

const CINEMAS = vista.getCinemas();
const PROGRAMMING_DATES = vista.getProgrammingDates();
const SEAT_PRICING_PREVIEW = vista.getSeatPricingPreview();
const stripVox = (name) => String(name || "").replace(/^VOX\s*[—-]\s*/, "");
const norm = (value) => String(value ?? "").toLowerCase().trim();
const localizedValue = (value, locale) => typeof value === "string" ? value : value?.[locale] || value?.en || "";
const isAgentWelcome = (value) => {
  const text = String(value || "");
  return /\bvox concierge\b|i can show you what(?:'|’)s playing, book your seats/i.test(text)
    || /(?:(?:i(?:'|’)m|i am) voxi|أنا\s+voxi).*(?:how can i help|كيف.*أساعد)/i.test(text);
};
const localizedOfferReason = (result, locale) => {
  if (locale !== "ar") return result?.reason || "No matching offer found.";
  if (result?.status === "eligible") return "البطاقة مدرجة ضمن الفئات المؤهلة، مع تأكيد الأهلية النهائية عند الدفع.";
  if (result?.status === "card_required") {
    const labels = {
      bank: "اسم البنك",
      card: "اسم البطاقة الدقيق",
      membership: "حالة عضوية VOX",
      channel: "قناة الحجز",
      format: "صيغة العرض",
      experience: "تجربة السينما",
      ticketCount: "عدد التذاكر",
      orderTotal: "إجمالي الطلب",
      monthlyTicketsUsed: "عدد التذاكر المستخدمة ضمن العرض هذا الشهر",
      monthlySpend: "الإنفاق الشهري المطلوب",
      cinema: "السينما",
      seatType: "فئة المقعد",
    };
    const missing = [...new Set((result?.missingFields || []).map((field) => labels[field] || field))];
    return missing.length
      ? `نحتاج إلى: ${missing.join("، ")} لتقييم العرض، وتبقى الأهلية النهائية مؤكدة عند الدفع.`
      : "نحتاج إلى تفاصيل إضافية عن البطاقة أو صيغة العرض أو فئة المقعد لتأكيد الأهلية.";
  }
  return "لا تتحقق جميع شروط العرض في السياق المحدد؛ راجع الشروط أو أكد الأهلية عند الدفع.";
};

const CONVERSATION_IDLE_MS = 15 * 60 * 1000;
const MAX_TICKETS = 10;

const ElevenLabsTransport = forwardRef(function ElevenLabsTransport({
  callbacks,
  clientTools,
  generation,
  isActive,
  onStatus,
}, ref) {
  const guardedClientTools = Object.fromEntries(Object.entries(clientTools).map(([name, tool]) => [
    name,
    (...args) => isActive(generation)
      ? tool(...args)
      : JSON.stringify({ success: false, reason: "stale_transport" }),
  ]));

  /* ========================================================================
   * REAL ELEVENLABS CONNECTION - do not change the location or client-tool
   * names. Text and voice connection types remain supplied by their callers.
   * ====================================================================== */
  const sdk = useConversation({
    clientTools: guardedClientTools,
    serverLocation: "eu-residency",
    onConnect: (details) => {
      if (isActive(generation)) callbacks.onConnect?.(details);
    },
    onDisconnect: (details) => {
      if (isActive(generation)) callbacks.onDisconnect?.(details);
    },
    ["onMessage"]: (message) => {
      if (isActive(generation)) callbacks.onMessage?.(message);
    },
    onError: (error, context) => {
      if (isActive(generation)) callbacks.onError?.(error, context);
    },
  });
  const sdkRef = useRef(sdk);
  sdkRef.current = sdk;

  useImperativeHandle(ref, () => ({
    startSession: (...args) => sdkRef.current.startSession(...args),
    endSession: (...args) => sdkRef.current.endSession(...args),
    getId: (...args) => sdkRef.current.getId?.(...args),
    sendContextualUpdate: (...args) => sdkRef.current.sendContextualUpdate?.(...args),
    sendUserMessage: (...args) => sdkRef.current.sendUserMessage?.(...args),
    sendUserActivity: (...args) => sdkRef.current.sendUserActivity?.(...args),
  }), []);

  useEffect(() => {
    if (isActive(generation)) onStatus(generation, sdk.status);
  }, [generation, isActive, onStatus, sdk.status]);

  return null;
});

const pad2 = (value) => String(value).padStart(2, "0");
const isoDate = (date) => `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
const addDays = (date, days) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
const uaeToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

function requestedProgrammingDate(text) {
  const raw = String(text || "").normalize("NFKC").toLowerCase();
  const direct = raw.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || null;
  if (direct) return direct;

  const today = new Date(`${uaeToday()}T00:00:00Z`);
  if (/\b(day after tomorrow)\b|بعد\s+(?:غد|بكرة)/i.test(raw)) {
    const target = isoDate(addDays(today, 2));
    return target;
  }
  if (/\btomorrow\b|غد(?:ا|اً)?|بكرة/i.test(raw)) {
    return isoDate(addDays(today, 1));
  }
  if (/\b(?:today|tonight)\b|اليوم|الليلة/i.test(raw)) return isoDate(today);

  const monthNames = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
    sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  for (const [name, month] of Object.entries(monthNames)) {
    const match = raw.match(new RegExp(`(?:\\b(\\d{1,2})\\s+${name}\\b|\\b${name}\\s+(\\d{1,2})\\b)`));
    if (!match) continue;
    const day = Number(match[1] || match[2]);
    const year = Number(PROGRAMMING_DATES[0]?.slice(0, 4)) || today.getUTCFullYear();
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const numeric = raw.match(/(?:^|\D)(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?(?:\D|$)/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = Number(numeric[3]) || Number(PROGRAMMING_DATES[0]?.slice(0, 4)) || today.getUTCFullYear();
    return `${year < 100 ? 2000 + year : year}-${pad2(month)}-${pad2(day)}`;
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekdayIndex = weekdays.findIndex((weekday) => raw.includes(weekday));
  if (weekdayIndex >= 0) {
    for (let offset = 0; offset < 8; offset += 1) {
      const candidate = addDays(today, offset);
      if (candidate.getUTCDay() === weekdayIndex) return isoDate(candidate);
    }
  }
  return null;
}

function programmingDatesForCinema(cinemaOrId) {
  const cinemaId = typeof cinemaOrId === "string" ? cinemaOrId : cinemaOrId?.id;
  return cinemaId ? vista.getProgrammingDates({ cinemaId }) : PROGRAMMING_DATES;
}

function extractTicketQuantity(text) {
  const raw = String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  if (/(?:شخصين|تذكرتين|مقعدين)/.test(raw)) return 2;
  const wordNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const arabicWordNumbers = {
    واحد: 1, واحدة: 1,
    اثنان: 2, اثنين: 2, اثنتان: 2, اثنتين: 2, اتنين: 2,
    ثلاثة: 3, ثلاث: 3,
    أربعة: 4, اربعة: 4, أربع: 4, اربع: 4,
    خمسة: 5, خمس: 5,
    ستة: 6, ست: 6,
    سبعة: 7, سبع: 7,
    ثمانية: 8, ثمان: 8,
    تسعة: 9, تسع: 9,
    عشرة: 10, عشر: 10,
  };
  const englishMatch = raw.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s*(?:people|persons?|tickets?|seats?)\b/);
  const arabicMatch = raw.match(/(?:^|[\s،,:;-])(واحد(?:ة)?|اثنان|اثنين|اثنتان|اثنتين|اتنين|ثلاثة|ثلاث|أربعة|اربعة|أربع|اربع|خمسة|خمس|ستة|ست|سبعة|سبع|ثمانية|ثمان|تسعة|تسع|عشرة|عشر|\d{1,2})\s*(?:أشخاص|اشخاص|شخص|تذاكر|تذكرة|تذكره|مقاعد|مقعد)(?=$|[\s،,.!؟?])/);
  const match = englishMatch || arabicMatch;
  if (!match) return null;
  const quantity = Number(match[1]) || wordNumbers[match[1]] || arabicWordNumbers[match[1]] || 0;
  return quantity >= 1 && quantity <= MAX_TICKETS ? quantity : null;
}

const isBookingHistoryRequest = (text) => /\b(my|past|previous|booking)\s+(bookings?|history)\b|\bbooking history\b|حجوزات[يي]?|سجل\s+الحجوزات/i.test(String(text || ""));
const cancellationDecision = (text) => {
  const value = norm(text).replace(/[.!?،؟]/g, "").trim();
  if (/^(yes|yes please|confirm|proceed|go ahead|cancel it|yes cancel it|نعم|ايوه|أيوه|الغ[يه]|الغي الحجز|أكد|تاكيد|تأكيد)$/.test(value)) return true;
  if (/^(no|no thanks|do not cancel|dont cancel|keep it|back|لا|لأ|لا تلغ[يه]|احتفظ بالحجز|تراجع)$/.test(value)) return false;
  return null;
};

function sanitizeUserText(text) {
  let sensitive = false;
  const safeText = String(text || "")
    .replace(/\b(?:\d[ -]*?){12,19}\b/g, () => { sensitive = true; return "[payment number removed]"; })
    .replace(/\b(cvv|cvc|otp|password|pin)\s*[:=-]?\s*\S+/gi, (_match, label) => {
      sensitive = true;
      return `${label} [removed]`;
    });
  return { safeText, sensitive };
}

function newConversationId() {
  try { return crypto.randomUUID(); } catch { return `voxi-${Date.now().toString(36)}`; }
}

export default function App() {
  const { locale, dir, t, setLocale } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState({ view: "empty" });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [bookings, setBookings] = useState(readBookings);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [sessionMode, setSessionMode] = useState(null);
  const [startingMode, setStartingMode] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(vista.demoDate);
  const appConversationIdRef = useRef(newConversationId());
  const [journey, dispatchJourney] = useReducer(journeyReducer, appConversationIdRef.current, createConversationJourney);
  const [ticketQuantity, setTicketQuantity] = useState(null);
  const [transportGeneration, setTransportGeneration] = useState(0);
  const [transportStatus, setTransportStatus] = useState("disconnected");

  // Blocking cancellation tool state. Seat selection remains deliberately
  // non-blocking so both voice and touch can continue to use select_seats.
  const cancelResolver = useRef(null);
  const cancelTimerRef = useRef(null);
  const cancellationFlowRef = useRef(null);
  const cancellationInFlightRef = useRef(false);
  const cancellationOperationRef = useRef(0);

  // Voice-resolution caches and non-recursive return-navigation snapshots.
  const filmsRef = useRef([]);
  const filmsCinemaRef = useRef("");
  const filmsDateRef = useRef("");
  const filmRequestsRef = useRef(new Map());
  const sessionsRef = useRef([]);
  const sessionsFilmRef = useRef("");
  const planRef = useRef([]);
  const planContextRef = useRef(null);
  const cinemaReturnRef = useRef(null);
  const historyReturnRef = useRef(null);
  const offersReturnRef = useRef(null);
  const faqReturnRef = useRef(null);

  // Current-value refs make client-tool calls deterministic even when the SDK
  // invokes a handler between React renders.
  const stageRef = useRef(stage);
  const stageRevisionRef = useRef(0);
  const cinemaRef = useRef(cinema);
  const bookingRef = useRef(booking);
  const pendingOrderRef = useRef(pendingOrder);
  const seatsRef = useRef(selectedSeats);
  const messagesRef = useRef(messages);
  const localeRef = useRef(locale);
  const scheduleDateRef = useRef(scheduleDate);
  const userRequestedDateRef = useRef(null);
  const ticketQuantityRef = useRef(ticketQuantity);
  const lastOfferRef = useRef(null);
  const clarificationFailuresRef = useRef(0);
  const clarificationFailureLogRef = useRef([]);
  const conversationIdRef = appConversationIdRef;
  const transportConversationIdRef = useRef(null);
  const journeyRef = useRef(journey);
  const lastActivityRef = useRef(Date.now());
  const sessionModeRef = useRef(null);
  const requestedSessionModeRef = useRef(null);
  const sessionStartRef = useRef(null);
  const sessionEpochRef = useRef(0);
  const requestedSessionEpochRef = useRef(null);
  const transportGenerationRef = useRef(0);
  const transportRef = useRef(null);
  const switchingSessionRef = useRef(false);
  const lastSentTextRef = useRef(null);
  const pendingTypedMessagesRef = useRef([]);
  const hasStartedConversationRef = useRef(false);
  const hasDisplayedWelcomeRef = useRef(false);
  const continuationSessionRef = useRef(false);
  const pendingLanguageSwitchRef = useRef(null);
  const disconnectReasonRef = useRef("ended");
  const suppressDisconnectNoticeRef = useRef(false);
  const requestEpochRef = useRef(0);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { cinemaRef.current = cinema; }, [cinema]);
  useEffect(() => { bookingRef.current = booking; }, [booking]);
  useEffect(() => { pendingOrderRef.current = pendingOrder; }, [pendingOrder]);
  useEffect(() => { seatsRef.current = selectedSeats; }, [selectedSeats]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => { scheduleDateRef.current = scheduleDate; }, [scheduleDate]);
  useEffect(() => { ticketQuantityRef.current = ticketQuantity; }, [ticketQuantity]);
  useEffect(() => { journeyRef.current = journey; }, [journey]);

  useEffect(() => {
    const next = syncJourney(journeyRef.current, {
      locale,
      cinema,
      scheduleDate,
      stage,
      selectedSeats,
      ticketQuantity,
      pendingOrder,
      booking,
      transportConversationId: transportConversationIdRef.current,
    });
    journeyRef.current = next;
    dispatchJourney({ type: "sync", payload: {
      locale,
      cinema,
      scheduleDate,
      stage,
      selectedSeats,
      ticketQuantity,
      pendingOrder,
      booking,
      transportConversationId: transportConversationIdRef.current,
    } });
  }, [booking, cinema, locale, pendingOrder, scheduleDate, selectedSeats, stage, ticketQuantity]);

  const say = useCallback((role, text) => {
    const at = new Date().toISOString();
    const message = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, role, text, at };
    lastActivityRef.current = Date.now();
    setMessages((current) => {
      const next = [...current, message];
      messagesRef.current = next;
      return next;
    });
    return message;
  }, []);

  const updateIntentFromText = useCallback((text) => {
    const intent = inferIntent({ view: stageRef.current?.view, text, previousIntent: journeyRef.current.intent });
    if (!intent || intent === journeyRef.current.intent) return intent;
    journeyRef.current = { ...journeyRef.current, intent, lastActivityAt: new Date().toISOString() };
    dispatchJourney({ type: "intent", intent });
    return intent;
  }, []);

  const resolveCinema = (idOrName) => resolveCinemaCandidate(CINEMAS, idOrName);

  const ensureFilms = useCallback(async (cinemaId = cinemaRef.current?.id, requestedDate = scheduleDateRef.current) => {
    if (!cinemaId) return [];
    if (filmsRef.current.length && filmsCinemaRef.current === cinemaId && filmsDateRef.current === requestedDate) return filmsRef.current;
    const requestKey = `${cinemaId}:${requestedDate}`;
    let request = filmRequestsRef.current.get(requestKey);
    if (!request) {
      request = vista.getScheduledFilms(cinemaId, requestedDate);
      filmRequestsRef.current.set(requestKey, request);
    }
    try {
      const movies = await request;
      if (cinemaRef.current?.id === cinemaId && scheduleDateRef.current === requestedDate) {
        filmsRef.current = movies;
        filmsCinemaRef.current = cinemaId;
        filmsDateRef.current = requestedDate;
        sessionsRef.current = [];
        sessionsFilmRef.current = "";
      }
      return movies;
    } finally {
      if (filmRequestsRef.current.get(requestKey) === request) filmRequestsRef.current.delete(requestKey);
    }
  }, []);

  const resolveFilm = (idOrTitle) => resolveFilmCandidate(filmsRef.current, idOrTitle);

  const resolveSession = (sessions, sessionId, showtime) => {
    if (!sessions.length || (!sessionId && !showtime)) return { session: null, reason: "not_found", matches: [] };
    const byId = sessionId
      ? sessions.find((item) => [item.sessionId, ...(item.sessionIds || [])].some((id) => String(id) === String(sessionId)))
      : null;
    if (byId) return { session: byId, reason: null, matches: [byId] };
    const timeMatches = showtime
      ? sessions.filter((item) => norm(item.time) === norm(showtime) || norm(showtime).includes(norm(item.time)))
      : [];
    if (timeMatches.length === 1) return { session: timeMatches[0], reason: null, matches: timeMatches };
    return { session: null, reason: timeMatches.length > 1 ? "ambiguous" : "not_found", matches: timeMatches };
  };

  const resetClarificationFailures = () => {
    clarificationFailuresRef.current = 0;
    clarificationFailureLogRef.current = [];
  };

  const dismissPendingCancellation = (reason = "dismissed") => {
    cancellationOperationRef.current += 1;
    cancellationInFlightRef.current = false;
    window.clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = null;
    const resolver = cancelResolver.current;
    cancelResolver.current = null;
    cancellationFlowRef.current = null;
    if (resolver) resolver(JSON.stringify({ confirmed: false, reason }));
  };

  const clearPendingOrder = () => {
    pendingOrderRef.current = null;
    setPendingOrder(null);
  };

  const showStage = useCallback((nextStage) => {
    const next = nextStage || { view: "empty" };
    stageRevisionRef.current += 1;
    stageRef.current = next;
    lastActivityRef.current = Date.now();
    setStage(next);
  }, []);

  const beginAsyncRequest = () => {
    requestEpochRef.current += 1;
    return requestEpochRef.current;
  };

  const requestIsCurrent = (epoch, revision, cinemaId, requestedDate) => (
    requestEpochRef.current === epoch
    && stageRevisionRef.current === revision
    && (!cinemaId || cinemaRef.current?.id === cinemaId)
    && (!requestedDate || scheduleDateRef.current === requestedDate)
  );

  const loadingErrorMessage = (subject = "results") => localeRef.current === "ar"
    ? `تعذر تحميل ${subject === "seats" ? "خريطة المقاعد" : "النتائج"}. حاول مرة أخرى.`
    : `Voxi couldn't load the ${subject}. Please try again.`;

  const queuePendingEcho = (text) => {
    const pending = { text, at: Date.now() };
    lastSentTextRef.current = pending;
    pendingTypedMessagesRef.current.push(pending);
    pendingTypedMessagesRef.current = pendingTypedMessagesRef.current
      .filter((item) => Date.now() - item.at < 30_000)
      .slice(-10);
  };

  const dismissStaleTransactionalView = ({ text, actionIntent, historyRequested, cancellationReply = false } = {}) => {
    const current = stageRef.current;
    if (!["booking", "history"].includes(current.view)) return false;
    const refersToDisplayedBooking = /\b(?:this|that|my|the)\s+(?:booking|reservation|tickets?)\b|\b(?:booking|reservation)\s+(?:reference|ref|details?)\b|(?:هذا|هذه|حجزي|الحجز|التذاكر)/i.test(String(text || ""));
    const keepsTransactionalView = historyRequested
      || actionIntent === "booking_history"
      || actionIntent === "cancellation"
      || cancellationReply
      || Boolean(cancellationFlowRef.current)
      || refersToDisplayedBooking;
    if (keepsTransactionalView) return false;

    // A completed booking remains in storage/history, but its large result card
    // should not sit under every unrelated turn. Dismiss it before a new FAQ or
    // discovery panel renders, restoring the current movies or a clean home.
    const canRestoreMovies = cinemaRef.current
      && filmsRef.current.length
      && filmsCinemaRef.current === cinemaRef.current.id
      && filmsDateRef.current === scheduleDateRef.current;
    // The stored booking remains available from History, but once the guest
    // moves to an unrelated task it must no longer act as hidden checkout or
    // offer context.
    clearPendingOrder();
    bookingRef.current = null;
    setBooking(null);
    historyReturnRef.current = null;
    showStage(canRestoreMovies ? { view: "movies", movies: filmsRef.current } : { view: "empty" });
    return true;
  };

  const prepareFaqContext = useCallback((query, { render = true } = {}) => {
    const activeLocale = localeRef.current;
    const current = stageRef.current;
    const faq = buildFaqContextForQuery(query, {
      locale: activeLocale,
      minScore: 35,
      liveData: {
        "cinema-locations-hours": {
          locations: CINEMAS.map((item) => ({ id: item.id, name: item.name })),
          selectedCinema: cinemaRef.current ? { id: cinemaRef.current.id, name: cinemaRef.current.name } : null,
        },
        "experience-availability": {
          cinema: cinemaRef.current?.name || null,
          movie: current.movie?.title || null,
          sessions: sessionsRef.current.map((session) => ({ time: session.time, experience: session.exp })),
        },
        "bank-and-card-offers": lastOfferRef.current ? {
          id: lastOfferRef.current.offer?.id,
          eligibility: lastOfferRef.current.status,
        } : null,
      },
    });
    if (!faq.matches.length) return faq;
    const primary = faq.matches[0];
    const inferred = inferIntent({ view: "empty", text: query, previousIntent: null });
    const actionIntent = classifyFaqActionIntent(query);
    const faqIntent = primary.topic === "offers"
      ? "offers"
      : ["cancellations_refunds", "booking_refund"].includes(primary.topic)
        ? "cancellation"
        : inferred === "booking"
          ? "booking"
          : "general_enquiry";
    journeyRef.current = { ...journeyRef.current, intent: faqIntent };
    dispatchJourney({ type: "intent", intent: faqIntent });
    const transactionalAction = Boolean(actionIntent) || isBookingHistoryRequest(query);
    if (render && !transactionalAction) {
      if (current?.view !== "faq") faqReturnRef.current = current || { view: "empty" };
      showStage({ view: "faq", faq: primary });
    }
    return faq;
  }, [showStage]);

  useEffect(() => {
    filmsRef.current = [];
    filmsCinemaRef.current = "";
    filmsDateRef.current = "";
    sessionsRef.current = [];
    sessionsFilmRef.current = "";
    if (cinema?.id) ensureFilms(cinema.id, scheduleDate).catch(() => {});
  }, [cinema?.id, ensureFilms, scheduleDate]);

  useEffect(() => () => dismissPendingCancellation("widget_unmounted"), []);

  const applyProgrammingDate = (nextDate, reason = "date_changed", availableDates = programmingDatesForCinema(cinemaRef.current)) => {
    if (!availableDates.includes(nextDate) || nextDate === scheduleDateRef.current) return false;
    userRequestedDateRef.current = null;
    dismissPendingCancellation(reason);
    clearPendingOrder();
    resetClarificationFailures();
    scheduleDateRef.current = nextDate;
    setScheduleDate(nextDate);
    filmsRef.current = [];
    filmsCinemaRef.current = "";
    filmsDateRef.current = "";
    sessionsRef.current = [];
    sessionsFilmRef.current = "";
    planRef.current = [];
    planContextRef.current = null;
    seatsRef.current = [];
    setSelectedSeats([]);
    return true;
  };

  const captureUserProgrammingDate = (text, availableDates = programmingDatesForCinema(cinemaRef.current)) => {
    const requestedDate = requestedProgrammingDate(text);
    if (!requestedDate) return { requestedDate: null, unavailableDate: null };
    if (availableDates.includes(requestedDate)) {
      userRequestedDateRef.current = null;
      return { requestedDate, unavailableDate: null };
    }
    userRequestedDateRef.current = requestedDate;
    return { requestedDate: null, unavailableDate: requestedDate };
  };

  const showUnavailableProgrammingDate = (date) => {
    const message = t("app.dateUnavailable", { date });
    if (cinemaRef.current && ["empty", "loading", "cinemas", "movies", "showtimes"].includes(stageRef.current.view)) {
      showStage({ view: "movies", movies: [], error: message, errorCode: "date_unavailable" });
    }
    say("system", message);
    return message;
  };

  const resolveClientToolProgrammingDate = (text, availableDates, { fallbackToFirst = true } = {}) => {
    const decision = resolveProgrammingDateSelection({
      availableDates,
      userRequestedDate: userRequestedDateRef.current,
      toolRequestedDate: requestedProgrammingDate(text),
      selectedDate: scheduleDateRef.current,
      fallbackToFirst,
    });
    if (!decision.blocked && decision.source === "user") userRequestedDateRef.current = null;
    return decision;
  };

  const applyUtteranceBookingDetails = (text, { actionIntent = null, hasFaq = false } = {}) => {
    const mentionedCinema = resolveCinema(text);
    const bookingContext = isCinemaSelectionTurn({
      view: stageRef.current.view,
      intent: journeyRef.current.intent,
      actionIntent,
      hasFaq,
      cinemaMatch: mentionedCinema,
    }) || (!hasFaq && (actionIntent === "booking" || journeyRef.current.intent === "booking"));
    if (!bookingContext) return { cinema: null, ticketQuantity: null };
    if (mentionedCinema && mentionedCinema.id !== cinemaRef.current?.id) {
      dismissPendingCancellation("cinema_changed_in_conversation");
      clearPendingOrder();
      cinemaRef.current = mentionedCinema;
      setCinema(mentionedCinema);
      filmsRef.current = [];
      filmsCinemaRef.current = "";
      filmsDateRef.current = "";
      sessionsRef.current = [];
      sessionsFilmRef.current = "";
      planRef.current = [];
      planContextRef.current = null;
      seatsRef.current = [];
      setSelectedSeats([]);
      const cinemaDates = programmingDatesForCinema(mentionedCinema);
      if (cinemaDates.length && !cinemaDates.includes(scheduleDateRef.current)) {
        scheduleDateRef.current = cinemaDates[0];
        setScheduleDate(cinemaDates[0]);
      }
    }
    const quantity = extractTicketQuantity(text);
    if (quantity) {
      ticketQuantityRef.current = quantity;
      setTicketQuantity(quantity);
    }
    return { cinema: mentionedCinema, ticketQuantity: quantity };
  };

  const finalizeSeats = async (seatIds) => {
    const current = stageRef.current;
    const planContext = planContextRef.current;
    if (current.view !== "seatmap" || !planContext || planContext.cinemaId !== cinemaRef.current?.id || String(planContext.sessionId) !== String(current.session?.sessionId)) {
      return { valid: [], total: 0, stale: true };
    }
    const plan = planRef.current || [];
    const all = plan.flatMap((row) => row.seats);
    const requested = [...new Set((seatIds || []).map((id) => String(id).toUpperCase()))];
    const expectedQuantity = Math.max(1, Math.min(MAX_TICKETS, Math.trunc(Number(ticketQuantityRef.current)) || 1));
    if (requested.length > MAX_TICKETS) {
      return { valid: [], total: 0, reason: "ticket_limit", expectedQuantity, requestedQuantity: requested.length };
    }
    const valid = requested.filter((id) => all.some((seat) => seat.id === id && seat.status === 0));
    if (valid.length !== expectedQuantity) {
      return { valid, total: 0, reason: "quantity_mismatch", expectedQuantity, requestedQuantity: requested.length };
    }
    const movie = current.movie;
    const session = current.session;
    const selectedCinema = cinemaRef.current;
    const selectedSeatDetails = valid.map((id) => all.find((item) => item.id === id)).filter(Boolean);
    let quote;
    try {
      quote = await vista.getPricingQuote(selectedCinema?.id, session?.sessionId, selectedSeatDetails);
    } catch (error) {
      return { valid, total: 0, reason: "pricing_unavailable", expectedQuantity, detail: error?.message || "Pricing is unavailable." };
    }
    const stillCurrent = stageRef.current.view === "seatmap"
      && planContextRef.current === planContext
      && cinemaRef.current?.id === selectedCinema?.id
      && String(stageRef.current.session?.sessionId) === String(session?.sessionId);
    if (!stillCurrent) return { valid: [], total: 0, stale: true };
    const total = Number(quote?.total);
    if (!Number.isFinite(total)) return { valid, total: 0, reason: "pricing_unavailable", expectedQuantity };
    const planMeta = vista.getResultMeta(plan);
    if (valid.length && selectedCinema) {
      const programmingDate = session?.date || scheduleDateRef.current;
      const sourceDate = session?.sourceDate || programmingDate;
      const performanceDate = sourceDate;
      const showtimeAt = performanceDate && session?.time
        ? `${performanceDate}T${session.time}:00+04:00`
        : null;
      const order = {
        movieId: movie?.id,
        movieTitle: movie?.title,
        cinemaId: selectedCinema.id,
        cinemaName: selectedCinema.name,
        sessionId: session?.sessionId,
        date: performanceDate,
        sourceDate,
        performanceDate,
        programmingDate,
        showtimeAt,
        experience: session?.exp,
        screen: session?.screen,
        showtime: session?.time,
        seats: valid,
        total,
        currency: quote?.currency || selectedCinema.currency || "AED",
        tint: movie?.tint,
        posterUrl: movie?.posterUrl,
        ticketQuantity: valid.length,
        demo: quote?.demo === true,
        verified: false,
        pricingVerified: quote?.verified === true,
        pricingMode: quote?.demo === true ? "demo" : "live",
        quoteId: quote?.quoteId || null,
        inventoryVerified: planMeta?.verified === true,
        reservationVerified: false,
        transactionWarning: quote?.warning || planMeta?.warning || null,
        checkoutId: `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      };
      ticketQuantityRef.current = valid.length;
      setTicketQuantity(valid.length);
      pendingOrderRef.current = order;
      setPendingOrder(order);
      showStage({ ...current, view: "checkout", order, movie, session });
      resetClarificationFailures();
    }
    return { valid, total, expectedQuantity, quote };
  };

  const handlePaid = ({ label, checkoutId }) => {
    const order = pendingOrderRef.current;
    if (!order || checkoutId !== order.checkoutId) return;
    const ref = `WL${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const completed = {
      ...order,
      ref,
      paidWith: label,
      cancelled: false,
      demo: true,
      verified: false,
      paymentStatus: "simulated_not_charged",
      bookingStatus: "confirmed_demo",
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    };
    try {
      appendBooking(completed);
    } catch (error) {
      const retryOrder = { ...order, checkoutId: `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` };
      pendingOrderRef.current = retryOrder;
      setPendingOrder(retryOrder);
      showStage({ ...stageRef.current, view: "checkout", order: retryOrder });
      say("system", localeRef.current === "ar"
        ? "تعذر حفظ ملخص الحجز على هذا الجهاز. لم يتم تحصيل أي مبلغ."
        : "The booking summary could not be saved on this device. No payment was taken.");
      return false;
    }
    setBookings(readBookings());
    bookingRef.current = completed;
    pendingOrderRef.current = null;
    setBooking(completed);
    setPendingOrder(null);
    showStage({ view: "booking", booking: completed });
    say("system", t("app.paymentSimulated", { method: label, ref }));
    resetClarificationFailures();
    sendUiTurn(`Checkout preview completed for booking summary ${ref}.`, {
      display: false,
      context: `The payment preview used ${label}; no payment was charged and no VOX inventory was reserved. Booking summary ${ref} is displayed for ${order.movieTitle} at ${order.cinemaName} on ${order.performanceDate || order.date} ${order.showtime}, seats ${order.seats.join(", ")}, total ${order.currency || "AED"} ${order.total}. Acknowledge the summary briefly. Mention the no-charge/no-reservation boundary once without applying a product-wide environment label.`,
    });
    return true;
  };

  /* ========================================================================
   * CLIENT TOOLS — the six original names stay unchanged. show_seat_map is
   * non-blocking and select_seats remains the only voice seat-confirmation
   * path. Phase C and D append show_offers and handover_to_agent.
   * ====================================================================== */
  const clientTools = {
    show_movie_selection: async ({ cinemaId, cinemaName, date, displayDate, scheduleDate: toolDate } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      const requested = resolveCinema(cinemaId) || resolveCinema(cinemaName);
      const target = requested || cinemaRef.current;
      if ((cinemaId || cinemaName) && !requested) {
        return JSON.stringify({ shown: false, reason: `No matching VOX Cinemas UAE location was found for ${cinemaName || cinemaId}. Ask the guest to choose from the cinema picker.` });
      }
      if (!target) {
        cinemaReturnRef.current = { view: "empty" };
        showStage({ view: "cinemas" });
        resetClarificationFailures();
        return JSON.stringify({
          shown: "cinema picker",
          cinemas: CINEMAS.map((item) => ({ id: item.id, name: item.name })),
          instruction: "Ask the guest to choose a VOX Cinemas UAE location before listing movies.",
        });
      }
      const availableDates = programmingDatesForCinema(target);
      const requestedDateText = toolDate || displayDate || date;
      const dateDecision = resolveClientToolProgrammingDate(requestedDateText, availableDates);
      if (dateDecision.blocked) {
        return JSON.stringify({ shown: false, requestedDate: dateDecision.unavailableDate, availableDates, reason: `No published programming is available for ${dateDecision.unavailableDate} at ${target.name}. Do not substitute another date; ask the guest to choose one of the published dates.` });
      }
      const requestedDate = dateDecision.date;
      if (!requestedDate) {
        return JSON.stringify({ shown: false, cinema: { id: target.id, name: target.name }, availableDates, reason: "No future programming dates are published for this cinema." });
      }
      if (target.id !== cinemaRef.current?.id) {
        cinemaRef.current = target;
        setCinema(target);
        filmsRef.current = [];
        filmsCinemaRef.current = "";
        filmsDateRef.current = "";
        sessionsRef.current = [];
        sessionsFilmRef.current = "";
        planRef.current = [];
        planContextRef.current = null;
        seatsRef.current = [];
        setSelectedSeats([]);
      }
      if (requestedDate !== scheduleDateRef.current) applyProgrammingDate(requestedDate, "tool_date_changed", availableDates);
      const epoch = beginAsyncRequest();
      showStage({ view: "loading", label: t("app.loadingMovies") });
      const revision = stageRevisionRef.current;
      let movies;
      try {
        movies = await ensureFilms(target.id, requestedDate);
      } catch (error) {
        const reason = error?.message || "Movie results could not be loaded.";
        if (requestIsCurrent(epoch, revision, target.id, requestedDate)) {
          showStage({ view: "movies", movies: [], error: reason });
          say("system", loadingErrorMessage("movies"));
        }
        return JSON.stringify({ shown: false, cinema: { id: target.id, name: target.name }, selectedDate: requestedDate, availableDates, reason, retryAvailable: true });
      }
      if (!requestIsCurrent(epoch, revision, target.id, requestedDate)) {
        return JSON.stringify({ shown: false, reason: "The guest selected a different VOX Cinemas UAE location while movies were loading." });
      }
      showStage({ view: "movies", movies });
      resetClarificationFailures();
      const resultMeta = vista.getResultMeta(movies);
      return JSON.stringify({
        shown: movies.length ? "movie list" : "empty movie list",
        cinema: { id: target.id, name: target.name },
        selectedDate: requestedDate,
        availableDates,
        reason: movies.length ? null : resultMeta?.reason || "No movies are published for this cinema and date.",
        movies: movies.map((movie) => ({
          id: movie.id,
          title: movie.title,
          rating: movie.rating,
          language: movie.languageName || movie.language || null,
        })),
      });
    },

    show_showtimes: async ({ movieId, movieTitle, date, displayDate, scheduleDate: toolDate } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      if (!cinemaRef.current) {
        showStage({ view: "cinemas" });
        return JSON.stringify({ shown: false, reason: "A VOX Cinemas UAE location must be selected first. The cinema picker is displayed." });
      }
      const cinemaId = cinemaRef.current.id;
      const availableDates = programmingDatesForCinema(cinemaId);
      const requestedDateText = toolDate || displayDate || date;
      const dateDecision = resolveClientToolProgrammingDate(requestedDateText, availableDates);
      if (dateDecision.blocked) return JSON.stringify({ shown: false, requestedDate: dateDecision.unavailableDate, availableDates, reason: `No published programming is available for ${dateDecision.unavailableDate} at ${cinemaRef.current.name}. Do not substitute another date; ask the guest to choose one of the published dates.` });
      const requestedDate = dateDecision.date;
      if (!requestedDate) return JSON.stringify({ shown: false, availableDates, reason: "No future programming dates are published for this cinema." });
      if (requestedDate !== scheduleDateRef.current) applyProgrammingDate(requestedDate, "tool_date_changed", availableDates);
      const epoch = beginAsyncRequest();
      const revision = stageRevisionRef.current;
      try {
        await ensureFilms(cinemaId, requestedDate);
      } catch (error) {
        return JSON.stringify({ shown: false, reason: error?.message || "Movie results could not be loaded." });
      }
      if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return JSON.stringify({ shown: false, reason: "The cinema, date, or active task changed while showtimes were loading." });
      const hasRequestedMovie = Boolean(movieId || movieTitle);
      const movie = resolveFilm(movieId) || resolveFilm(movieTitle) || (!hasRequestedMovie ? filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle || movieId}. Ask the guest to choose a title from the displayed movie list.` });
      let sessions;
      try {
        sessions = await vista.getSessions(cinemaId, movie.id, requestedDate);
      } catch (error) {
        return JSON.stringify({ shown: false, reason: error?.message || "Showtimes could not be loaded." });
      }
      if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return JSON.stringify({ shown: false, reason: "The cinema, date, movie, or active task changed while showtimes were loading." });
      sessionsRef.current = sessions;
      sessionsFilmRef.current = movie.id;
      showStage({ view: "showtimes", movie, sessions });
      resetClarificationFailures();
      return JSON.stringify({
        movie: movie.title,
        cinema: cinemaRef.current.name,
        date: requestedDate,
        showtimes: sessions.map((session) => ({ sessionId: session.sessionId, time: session.time, experience: session.exp, screen: session.screen, language: movie.language, seatsAvailable: session.seatsAvailable })),
      });
    },

    show_seat_map: async ({ movieTitle, sessionId, showtime, ticketQuantity: requestedQuantity, date, displayDate, scheduleDate: toolDate } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      if (!cinemaRef.current) {
        showStage({ view: "cinemas" });
        return JSON.stringify({ shown: false, reason: "A VOX Cinemas UAE location must be selected first. The cinema picker is displayed." });
      }
      const cinemaId = cinemaRef.current.id;
      const availableDates = programmingDatesForCinema(cinemaId);
      const requestedDateText = toolDate || displayDate || date;
      const dateDecision = resolveClientToolProgrammingDate(requestedDateText, availableDates);
      if (dateDecision.blocked) return JSON.stringify({ shown: false, requestedDate: dateDecision.unavailableDate, availableDates, reason: `No published programming is available for ${dateDecision.unavailableDate} at ${cinemaRef.current.name}. Do not substitute another date; ask the guest to choose one of the published dates.` });
      const requestedDate = dateDecision.date;
      if (!requestedDate) return JSON.stringify({ shown: false, availableDates, reason: "No future programming dates are published for this cinema." });
      if (requestedDate !== scheduleDateRef.current) applyProgrammingDate(requestedDate, "tool_date_changed", availableDates);
      const epoch = beginAsyncRequest();
      const revision = stageRevisionRef.current;
      try {
        await ensureFilms(cinemaId, requestedDate);
      } catch (error) {
        return JSON.stringify({ shown: false, reason: error?.message || "Movie results could not be loaded." });
      }
      if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return JSON.stringify({ shown: false, reason: "The cinema, date, or active task changed while the seat map was loading." });
      const current = stageRef.current;
      const resolvedMovie = resolveFilm(movieTitle);
      const movie = resolvedMovie || (!movieTitle ? current.movie || filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle}. Ask the guest to choose a title from the displayed movie list.` });
      let sessions = sessionsRef.current;
      if (!sessions.length || sessionsFilmRef.current !== movie?.id) {
        try {
          sessions = movie ? await vista.getSessions(cinemaId, movie.id, requestedDate) : [];
        } catch (error) {
          return JSON.stringify({ shown: false, reason: error?.message || "Showtimes could not be loaded." });
        }
        if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return JSON.stringify({ shown: false, reason: "The cinema, date, movie, or active task changed while the seat map was loading." });
        sessionsRef.current = sessions;
        sessionsFilmRef.current = movie?.id || "";
      }
      const resolution = resolveSession(sessions, sessionId, showtime);
      const session = resolution.session;
      if (!session) {
        const options = resolution.matches.map((item) => ({ sessionId: item.sessionId, time: item.time, experience: item.exp, screen: item.screen }));
        return JSON.stringify({
          shown: false,
          reason: resolution.reason === "ambiguous"
            ? `More than one session starts at ${showtime}. Ask the guest to choose an experience, then use its sessionId.`
            : `No exact session was found for ${showtime || sessionId || "the requested showtime"}. Ask the guest to choose one of the displayed showtimes.`,
          options,
        });
      }
      let plan;
      try {
        plan = await vista.getSeatPlan(cinemaId, session.sessionId);
      } catch (error) {
        return JSON.stringify({ shown: false, reason: error?.message || "The seat map could not be loaded." });
      }
      if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return JSON.stringify({ shown: false, reason: "The cinema, date, showtime, or active task changed while the seat map was loading." });
      setSelectedSeats([]);
      seatsRef.current = [];
      const quantity = Math.max(1, Math.min(MAX_TICKETS, Math.trunc(Number(requestedQuantity ?? ticketQuantityRef.current ?? 1)) || 1));
      ticketQuantityRef.current = quantity;
      setTicketQuantity(quantity);
      const planMeta = vista.getResultMeta(plan);
      planRef.current = plan;
      planContextRef.current = { cinemaId, sessionId: session.sessionId };
      showStage({ view: "seatmap", movie, session, plan, planMeta });
      resetClarificationFailures();
      const available = plan.flatMap((row) => row.seats).filter((seat) => seat.status === 0).map((seat) => seat.id);
      return JSON.stringify({
        shown: "seat map",
        availableSeats: available,
        dataMode: planMeta?.mode || null,
        inventoryVerified: planMeta?.verified === true,
        inventoryMismatch: planMeta?.inventoryMismatch === true,
        warning: planMeta?.warning || null,
        instruction: "Ask the guest which seats they'd like. When they answer, call select_seats with those seat labels. They may also tap the map.",
      });
    },

    select_seats: async ({ seats } = {}) => {
      const ids = (Array.isArray(seats) ? seats : String(seats || "").split(/[,\s]+/))
        .map((value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean);
      const result = await finalizeSeats(ids);
      if (!result.valid.length) {
        const reason = result.reason === "ticket_limit"
          ? `A booking can contain at most ${MAX_TICKETS} tickets.`
          : result.reason === "quantity_mismatch"
            ? `Exactly ${result.expectedQuantity} available seat${result.expectedQuantity === 1 ? "" : "s"} must be selected for the requested ticket quantity.`
            : result.reason === "pricing_unavailable"
              ? `Pricing could not be verified: ${result.detail || "try again"}. Do not continue to checkout.`
              : "None of those seats are available. Ask the guest to choose from the available seats shown on the map.";
        return JSON.stringify({ confirmed: false, reason, expectedQuantity: result.expectedQuantity });
      }
      if (result.reason === "quantity_mismatch") {
        return JSON.stringify({ confirmed: false, seatsAvailable: result.valid, expectedQuantity: result.expectedQuantity, reason: `The guest requested ${result.expectedQuantity} ticket${result.expectedQuantity === 1 ? "" : "s"}. Ask for exactly that many available seat labels.` });
      }
      const dropped = ids.filter((id) => !result.valid.includes(id));
      return JSON.stringify({
        confirmed: true,
        seats: result.valid,
        total: result.total,
        currency: "AED",
        pricingVerified: result.quote?.verified === true,
        simulationOnly: result.quote?.demo === true,
        next: "Checkout is displayed. Ask the guest to complete payment on screen. Do not ask for card details by voice.",
        note: dropped.length ? `Unavailable and skipped: ${dropped.join(", ")}` : undefined,
      });
    },

    show_booking_summary: ({ movieTitle, screen, showtime, seats, ref, total } = {}) => {
      dismissPendingCancellation("booking_summary");
      const storedRecord = findBooking(ref);
      const activeRecord = bookingRef.current?.ref && norm(bookingRef.current.ref) === norm(ref) ? bookingRef.current : null;
      const displayed = storedRecord || activeRecord;
      if (!displayed) {
        return JSON.stringify({ shown: false, verified: false, bookingRef: ref || null, reason: "No matching locally stored or active booking was found for that reference. Ask the guest to check it." });
      }
      clearPendingOrder();
      const film = resolveFilm(movieTitle || displayed?.movieTitle);
      const performanceDate = displayed.performanceDate || displayed.sourceDate || displayed.date || null;
      const withTint = {
        ...displayed,
        date: performanceDate,
        performanceDate,
        tint: displayed.tint || film?.tint || stageRef.current.movie?.tint,
      };
      const locallyStored = Boolean(storedRecord);
      const providerVerified = !locallyStored && withTint.verified === true;
      bookingRef.current = withTint;
      setBooking(withTint);
      showStage({ view: "booking", booking: withTint });
      resetClarificationFailures();
      return JSON.stringify({
        shown: true,
        source: locallyStored ? "local_device_storage" : "active_provider_result",
        locallyStored,
        verified: providerVerified,
        providerVerified,
        simulationOnly: locallyStored || withTint.demo === true || !providerVerified,
        bookingRef: withTint.ref,
        cinema: withTint.cinemaName || null,
        performanceDate,
        status: withTint.bookingStatus || (withTint.cancelled ? "cancelled" : "locally_stored"),
        refundRoute: withTint.refundRoute || null,
        refundStatus: withTint.refundStatus || null,
        refundReference: withTint.refundReference || null,
      });
    },

    show_booking_for_cancellation: async ({ bookingRef: requestedRef } = {}) => {
      dismissPendingCancellation("replaced");
      clearPendingOrder();
      const requestRevision = stageRevisionRef.current;
      let found;
      try {
        found = await vista.searchBooking(requestedRef);
      } catch (error) {
        return JSON.stringify({ found: false, bookingRef: requestedRef || null, reason: error?.message || "Booking not found." });
      }
      if (stageRevisionRef.current !== requestRevision) {
        return JSON.stringify({ found: false, bookingRef: requestedRef || null, reason: "The guest moved to another task while the booking was being checked." });
      }
      const displayed = {
        ...found,
        date: found.performanceDate || found.sourceDate || found.date || null,
        performanceDate: found.performanceDate || found.sourceDate || found.date || null,
        total: found.total ?? found.refundAmount,
        tint: found.tint || resolveFilm(found.movieTitle)?.tint,
        cancelled: Boolean(found.cancelled),
        bookingStatus: found.bookingStatus || (found.cancelled ? "cancelled" : "confirmed"),
      };
      bookingRef.current = displayed;
      setBooking(displayed);
      showStage({ view: "booking", booking: displayed });
      resetClarificationFailures();
      if (displayed.cancelled) {
        return JSON.stringify({
          confirmed: false,
          alreadyCancelled: true,
          bookingRef: displayed.ref,
          bookingStatus: displayed.bookingStatus,
          refundStatus: displayed.refundStatus || null,
          refundReference: displayed.refundReference || null,
          demo: displayed.refundStatus === "not_processed_demo",
          message: displayed.refundStatus === "not_processed_demo"
            ? "This booking is marked cancelled on this device. No refund was processed."
            : undefined,
        });
      }
      const demoOnly = displayed.cancellation?.demoOnly === true
        || displayed.demo === true
        || displayed.verified !== true
        || ["snapshot_demo", "local_demo"].includes(displayed.dataMode)
        || displayed.paymentStatus === "simulated_not_charged"
        || displayed.bookingStatus === "confirmed_demo";
      if (demoOnly) {
        return await new Promise((resolve) => {
          cancelResolver.current = resolve;
          cancellationFlowRef.current = {
            bookingRef: displayed.ref,
            phase: "final_confirmation",
            refundRoute: null,
            eligibilityStatus: "local_demo_only",
            demoOnly: true,
          };
          say("system", localeRef.current === "ar"
            ? `هل تريد تسجيل الحجز ${displayed.ref} كملغى على هذا الجهاز؟ لن يتم التواصل مع VOX أو إصدار أي استرداد. قل نعم لتسجيله كملغى أو لا للإبقاء عليه.`
            : `Mark booking ${displayed.ref} as cancelled on this device? This will not contact VOX or issue a refund. Say yes to mark it cancelled or no to keep it active.`);
          cancelTimerRef.current = window.setTimeout(() => dismissPendingCancellation("confirmation_timeout"), 90_000);
        });
      }
      if (displayed.cancellation?.status === "ineligible") {
        return JSON.stringify({
          confirmed: false,
          found: true,
          eligible: false,
          bookingRef: displayed.ref,
          reason: displayed.cancellation.reason,
          message: "This booking is not eligible for cancellation. Do not ask the guest to confirm a refund.",
        });
      }
      if (displayed.cancellation?.status !== "eligible") {
        return JSON.stringify({
          confirmed: false,
          found: true,
          eligible: false,
          reviewRequired: true,
          bookingRef: displayed.ref,
          reason: displayed.cancellation?.reason || "provider_verification_required",
          message: "Cancellation eligibility could not be verified. Do not ask the guest to confirm a refund; direct them to the official VOX Manage Booking flow.",
        });
      }
      return await new Promise((resolve) => {
        cancelResolver.current = resolve;
        cancellationFlowRef.current = {
          bookingRef: displayed.ref,
          phase: "route_confirmation",
          refundRoute: "VOX Wallet",
          eligibilityStatus: displayed.cancellation?.status || "unknown",
        };
        say("system", localeRef.current === "ar"
          ? `سيُعاد المبلغ المؤهل افتراضياً إلى محفظة VOX للحجز ${displayed.ref}. قل نعم لاختيار محفظة VOX، ثم سأطلب تأكيداً نهائياً منفصلاً.`
          : `Eligible refunds default to VOX Wallet credit for booking ${displayed.ref}. Say yes to choose VOX Wallet; Voxi will then ask for a separate final confirmation.`);
        cancelTimerRef.current = window.setTimeout(() => dismissPendingCancellation("confirmation_timeout"), 90_000);
      });
    },

    show_offers: async ({ bankName = "", cardName = "", experience = "" } = {}) => {
      dismissPendingCancellation("offers_opened");
      const current = stageRef.current;
      const activeBooking = current.view === "booking" ? bookingRef.current : null;
      const order = current.view === "checkout" ? pendingOrderRef.current : null;
      const selectedExperience = experience || current.session?.exp || current.order?.experience || order?.experience || activeBooking?.experience || "";
      const query = [bankName, cardName].filter(Boolean).join(" ").trim();
      const context = {
        cinemaId: cinemaRef.current?.id,
        cinemaName: cinemaRef.current?.name,
        experience: selectedExperience,
        ticketCount: order?.seats?.length || seatsRef.current.length || ticketQuantityRef.current || undefined,
        orderTotal: order?.total,
        channel: "web",
      };
      const result = query
        ? cardName
          ? resolveOfferForBankAndCard(bankName, cardName, context)
          : resolveOffer(bankName || query, context)
        : null;
      lastOfferRef.current = result;
      const toolLocale = localeRef.current;
      const disclaimer = OFFER_META.disclaimer[toolLocale] || OFFER_META.disclaimer.en;
      offersReturnRef.current = current.view === "offers" ? { view: "empty" } : current;
      showStage({ view: "offers", query, context, result, showtimeRequired: Boolean(query && !selectedExperience) });
      resetClarificationFailures();
      if (!query) {
        return JSON.stringify({ shown: "all offers", offerCount: 19, context, disclaimer });
      }
      const localizedReason = localizedOfferReason(result, toolLocale);
      const localizedHeadline = localizedValue(result?.offer?.headline, toolLocale) || (toolLocale === "ar" ? "لا يوجد عرض مطابق" : "No matching offer");
      const localizedAdvisory = toolLocale === "ar" && result?.advisory
        ? "قد تُطلب عضوية ڤوكس مسجلة، ويتم التأكيد النهائي للأهلية عند الدفع."
        : result?.advisory || "";
      return JSON.stringify({
        shown: "offer card",
        bank: localizedValue(result?.offer?.bank, toolLocale) || bankName,
        card: localizedValue(result?.cardProfile?.name, toolLocale) || cardName || null,
        headline: localizedHeadline,
        eligibility: result?.status || "ineligible",
        showtimeRequired: !selectedExperience,
        missingFields: result?.missingFields || [],
        reason: localizedReason,
        advisory: localizedAdvisory,
        answer: `${localizedHeadline} — ${localizedReason}${localizedAdvisory ? ` ${localizedAdvisory}` : ""}`,
        context,
        disclaimer,
      });
    },

    handover_to_agent: ({ reason = "explicit_request", detail = "" } = {}) => {
      const normalizedReason = norm(reason);
      const isClarificationFailure = isClarificationFailureReason(normalizedReason);
      if (isClarificationFailure) {
        clarificationFailuresRef.current += 1;
        clarificationFailureLogRef.current.push({ detail, at: new Date().toISOString() });
        if (clarificationFailuresRef.current < 2) {
          return JSON.stringify({ handoverStarted: false, clarificationFailureCount: 1, remaining: 1, instruction: "Try one more concise clarification. If it also fails, call handover_to_agent again with reason clarification_failure." });
        }
      }

      dismissPendingCancellation("handover_started");
      const current = stageRef.current;
      const currentBooking = bookingRef.current;
      const currentOrder = pendingOrderRef.current;
      const handoverBooking = currentOrder || (current.view === "booking" ? currentBooking : null);
      const handoverSeats = currentOrder?.seats?.length
        ? currentOrder.seats
        : handoverBooking?.seats?.length
          ? handoverBooking.seats
          : seatsRef.current;
      const payload = buildHandoverPayload({
        conversationId: conversationIdRef.current,
        requestedAt: new Date().toISOString(),
        trigger: isClarificationFailure ? HANDOVER_TRIGGER.FAILED_CLARIFICATIONS : HANDOVER_TRIGGER.EXPLICIT_REQUEST,
        reason: detail || reason,
        clarificationFailures: clarificationFailuresRef.current,
        locale: localeRef.current === "ar" ? "ar-AE" : "en-AE",
        stage: current.view,
        cinema: cinemaRef.current,
        movie: current.movie || (currentOrder ? { id: currentOrder.movieId, title: currentOrder.movieTitle } : handoverBooking ? { id: handoverBooking.movieId, title: handoverBooking.movieTitle } : null),
        session: current.session || (currentOrder
          ? { sessionId: currentOrder.sessionId, date: currentOrder.performanceDate || currentOrder.sourceDate || currentOrder.date, time: currentOrder.showtime, experience: currentOrder.experience, screen: currentOrder.screen }
          : handoverBooking
            ? { sessionId: handoverBooking.sessionId, date: handoverBooking.performanceDate || handoverBooking.sourceDate || handoverBooking.date, time: handoverBooking.showtime, experience: handoverBooking.experience, screen: handoverBooking.screen }
            : null),
        selectedSeats: handoverSeats,
        booking: handoverBooking,
        offer: lastOfferRef.current ? {
          id: lastOfferRef.current.offer?.id,
          bank: lastOfferRef.current.offer?.bank?.en,
          title: lastOfferRef.current.offer?.headline?.en,
          eligibility: lastOfferRef.current.status,
        } : null,
        messages: messagesRef.current,
      });
      showStage({ view: "handover", payload });
      clarificationFailureLogRef.current = [];
      return JSON.stringify({ handoverStarted: true, mode: "simulated", status: "connecting", schemaVersion: payload.schemaVersion, handoverId: payload.event.handoverId });
    },
  };

  const routeRecognizedCinema = async (matchedCinema, requestedDate = null) => {
    if (!matchedCinema?.id) return { shown: false, reason: "No cinema was recognized." };
    const rawResult = await clientTools.show_movie_selection({
      cinemaId: matchedCinema.id,
      scheduleDate: requestedDate || scheduleDateRef.current,
    });
    try {
      return typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
    } catch {
      return { shown: false, reason: "The cinema selection returned an unreadable result." };
    }
  };

  const clearConversationState = useCallback((reason = "reset") => {
    sessionEpochRef.current += 1;
    cancellationOperationRef.current += 1;
    requestedSessionEpochRef.current = null;
    dismissPendingCancellation(reason);
    cancellationFlowRef.current = null;
    cancellationInFlightRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setInput("");
    stageRevisionRef.current += 1;
    stageRef.current = { view: "empty" };
    setStage({ view: "empty" });
    cinemaRef.current = null;
    setCinema(null);
    bookingRef.current = null;
    setBooking(null);
    pendingOrderRef.current = null;
    setPendingOrder(null);
    seatsRef.current = [];
    setSelectedSeats([]);
    ticketQuantityRef.current = null;
    setTicketQuantity(null);
    scheduleDateRef.current = vista.demoDate();
    userRequestedDateRef.current = null;
    setScheduleDate(vista.demoDate());
    filmsRef.current = [];
    filmsCinemaRef.current = "";
    filmsDateRef.current = "";
    filmRequestsRef.current.clear();
    sessionsRef.current = [];
    sessionsFilmRef.current = "";
    planRef.current = [];
    planContextRef.current = null;
    cinemaReturnRef.current = null;
    historyReturnRef.current = null;
    offersReturnRef.current = null;
    faqReturnRef.current = null;
    lastOfferRef.current = null;
    resetClarificationFailures();
    transportConversationIdRef.current = null;
    appConversationIdRef.current = newConversationId();
    conversationIdRef.current = appConversationIdRef.current;
    journeyRef.current = createConversationJourney(appConversationIdRef.current);
    dispatchJourney({ type: "reset", sessionId: appConversationIdRef.current });
    lastSentTextRef.current = null;
    pendingTypedMessagesRef.current = [];
    hasStartedConversationRef.current = false;
    hasDisplayedWelcomeRef.current = false;
    continuationSessionRef.current = false;
    pendingLanguageSwitchRef.current = null;
    requestEpochRef.current += 1;
    lastActivityRef.current = Date.now();
  }, []);

  /* ========================================================================
   * REAL ELEVENLABS CONNECTION — do not change the connection type, location,
   * or client-tool names. The agent uses the public VITE_AGENT_ID identifier.
   * ====================================================================== */
  let conversation;
  const transportCallbacks = {
    onConnect: () => {
      if (requestedSessionEpochRef.current !== sessionEpochRef.current) return;
      const connectedMode = requestedSessionModeRef.current || "voice";
      sessionModeRef.current = connectedMode;
      setSessionMode(connectedMode);
      setStartingMode(null);
      switchingSessionRef.current = false;
      say("system", t(connectedMode === "text" ? "app.textConnected" : "app.voiceConnected"));
    },
    onDisconnect: () => {
      const switching = switchingSessionRef.current;
      pendingLanguageSwitchRef.current = null;
      sessionModeRef.current = null;
      setSessionMode(null);
      if (!switching) {
        requestedSessionModeRef.current = null;
        requestedSessionEpochRef.current = null;
        setStartingMode(null);
        const reason = disconnectReasonRef.current;
        const suppressNotice = suppressDisconnectNoticeRef.current;
        disconnectReasonRef.current = "ended";
        suppressDisconnectNoticeRef.current = false;
        // An SDK transport can end independently of the guest's local journey
        // (for example, when the ElevenLabs session reaches its own timeout).
        // Keep the current history/offer/booking view and cinema mounted so a
        // later text turn can reconnect with the same context. The deliberate
        // app inactivity timeout remains a privacy reset, while restart/logout
        // perform their own full reset in restartConversation.
        if (reason === "timeout") {
          clearConversationState(reason);
        } else if (cancelResolver.current && !cancellationInFlightRef.current) {
          dismissPendingCancellation("transport_disconnected");
        }
        if (!suppressNotice) say("system", t(reason === "timeout" ? "app.timeoutMessage" : "app.disconnectedMessage"));
      }
    },
    onMessage: (message) => {
      const normalizedMessage = normalizeElevenLabsMessageEvent(message);
      if (!normalizedMessage) return;
      const { role, text: eventText } = normalizedMessage;
      const sentIndex = role === "user"
        ? pendingTypedMessagesRef.current.findIndex((sent) => sent.text === eventText && Date.now() - sent.at < 15000)
        : -1;
      if (sentIndex >= 0) {
        pendingTypedMessagesRef.current.splice(sentIndex, 1);
        lastSentTextRef.current = pendingTypedMessagesRef.current.at(-1) || null;
        return;
      }

      const sanitized = role === "user" ? sanitizeUserText(eventText) : { safeText: eventText, sensitive: false };
      const safeMessage = sanitized.safeText;
      if (role === "user") {
        if (sanitized.sensitive) say("system", localeRef.current === "ar" ? "تمت إزالة بيانات الدفع الحساسة من المحادثة. استخدم شاشة الدفع الآمنة فقط." : "Sensitive payment details were removed. Use only the secure checkout screen for payment.");
        say("user", safeMessage);
        const decision = cancellationFlowRef.current ? cancellationDecision(safeMessage) : null;
        if (decision !== null) handleCancellationDecision(decision, { source: "conversation" });
        const historyRequested = isBookingHistoryRequest(safeMessage);
        if (historyRequested) openHistory({ notifyAgent: false, forceOpen: true });
        const directCinemaSelection = isDirectCinemaSelectionUtterance({
          text: safeMessage,
          view: stageRef.current.view,
          cinemaMatch: resolveCinema(safeMessage),
        });
        const actionIntent = classifyFaqActionIntent(safeMessage);
        dismissStaleTransactionalView({ text: safeMessage, actionIntent, historyRequested, cancellationReply: decision !== null });
        const faq = directCinemaSelection ? { matches: [], context: "" } : prepareFaqContext(safeMessage);
        const details = applyUtteranceBookingDetails(safeMessage, { actionIntent, hasFaq: faq.matches.length > 0 });
        const availableDates = programmingDatesForCinema(cinemaRef.current);
        const bookingContext = !faq.matches.length && (
          actionIntent === "booking"
          || journeyRef.current.intent === "booking"
          || isCinemaSelectionTurn({ view: stageRef.current.view, intent: journeyRef.current.intent, actionIntent, cinemaMatch: details.cinema })
        );
        const dateRequest = bookingContext
          ? captureUserProgrammingDate(safeMessage, availableDates)
          : { requestedDate: null, unavailableDate: null };
        const { requestedDate, unavailableDate } = dateRequest;
        if (requestedDate) {
          if (!details.cinema && requestedDate !== scheduleDateRef.current) chooseDate(requestedDate, { notifyAgent: false, addTranscript: false });
          conversation.sendContextualUpdate?.(`The guest explicitly selected programming date ${requestedDate}; the widget has applied it. Use that date and do not fall back to another date.`);
        } else if (unavailableDate) {
          showUnavailableProgrammingDate(unavailableDate);
          conversation.sendContextualUpdate?.(`The guest requested ${unavailableDate}, but it is not published for the selected cinema. Do not substitute another date. Available dates: ${availableDates.join(", ")}.`);
        }
        if (details.cinema && !unavailableDate) {
          conversation.sendContextualUpdate?.(`The guest explicitly named ${details.cinema.name}. The widget recognized it and is loading that cinema's movie list now. Do not ask for the cinema again and do not describe movies from another location.`);
          void routeRecognizedCinema(details.cinema, requestedDate).then((result) => {
            const count = Array.isArray(result?.movies) ? result.movies.length : 0;
            conversation.sendContextualUpdate?.(result?.shown === "movie list"
              ? `${details.cinema.name} is selected and ${count} current movies are displayed in the widget. Ask only for the next missing booking detail.`
              : `${details.cinema.name} is selected, but no movie list was displayed. Reason: ${result?.reason || "No published movies were returned."}`);
          }).catch((error) => {
            conversation.sendContextualUpdate?.(`${details.cinema.name} was recognized, but its movie list could not be loaded: ${error?.message || "unknown error"}. Do not claim that movies are displayed.`);
          });
        } else if (!details.cinema && !cinemaRef.current && actionIntent === "booking" && !faq.matches.length) {
          void clientTools.show_movie_selection({});
          conversation.sendContextualUpdate?.("Only the VOX Cinemas UAE cinema picker is displayed; no movie list is visible yet. Ask the guest for one cinema and do not say that movies are being shown.");
        } else if (details.cinema) {
          conversation.sendContextualUpdate?.(`The guest explicitly named ${details.cinema.name}. The widget selected that cinema; do not ask for it again.`);
        }
        if (details.ticketQuantity) conversation.sendContextualUpdate?.(`The guest explicitly requested ${details.ticketQuantity} tickets. Preserve that quantity through seat selection.`);
        if (historyRequested) {
          conversation.sendContextualUpdate?.("The guest's booking summaries saved on this device are already displayed. Do not call another booking-history tool or present these summaries as provider confirmations. Ask them to select the relevant booking.");
        }
        if (faq.matches.length) {
          conversation.sendContextualUpdate?.(`${faq.context}\nThe guest's spoken question is: ${safeMessage}. Answer from this approved context without restarting the active task.`);
        } else updateIntentFromText(safeMessage);
      }
      const languageSignal = resolveLanguageSignal({
        role,
        text: safeMessage,
        currentLocale: localeRef.current,
        pendingLocale: pendingLanguageSwitchRef.current,
      });
      pendingLanguageSwitchRef.current = languageSignal.pendingLocale;
      if (languageSignal.nextLocale && languageSignal.nextLocale !== localeRef.current) {
        localeRef.current = languageSignal.nextLocale;
        setLocale(languageSignal.nextLocale);
      }
      if (role === "agent" && isAgentWelcome(safeMessage)) {
        const pendingTyped = pendingTypedMessagesRef.current.at(-1) || lastSentTextRef.current;
        const hasRecentTypedMessage = pendingTyped && Date.now() - pendingTyped.at < 15000;
        if (pendingTyped && !hasRecentTypedMessage) lastSentTextRef.current = null;
        if (!hasDisplayedWelcomeRef.current && !continuationSessionRef.current && !hasRecentTypedMessage) {
          const displayedWelcome = /\bvox concierge\b/i.test(safeMessage)
            ? VOXI_FIRST_MESSAGES[localeRef.current]
            : safeMessage;
          say("agent", displayedWelcome);
        }
        hasDisplayedWelcomeRef.current = true;
        return;
      }
      if (role !== "user") say(role, safeMessage);
    },
    onError: (error) => {
      console.error("Conversation error", error);
      say("system", t("app.connectionError"));
    },
  };

  const isTransportGenerationActive = useCallback(
    (generation) => transportGenerationRef.current === generation,
    [],
  );
  const updateTransportStatus = useCallback((generation, nextStatus) => {
    if (transportGenerationRef.current === generation) setTransportStatus(nextStatus);
  }, []);
  const retireTransportGeneration = useCallback((generation) => {
    if (transportGenerationRef.current !== generation) return;
    const nextGeneration = generation + 1;
    transportGenerationRef.current = nextGeneration;
    transportRef.current = null;
    setTransportStatus("disconnected");
    setTransportGeneration(nextGeneration);
  }, []);

  const unavailableTransport = () => Promise.reject(new Error("Conversation transport is restarting"));
  conversation = {
    status: transportStatus,
    startSession: (...args) => transportRef.current?.startSession(...args) ?? unavailableTransport(),
    endSession: (...args) => transportRef.current?.endSession(...args) ?? Promise.resolve(),
    getId: (...args) => transportRef.current?.getId?.(...args),
    sendContextualUpdate: (...args) => transportRef.current?.sendContextualUpdate?.(...args),
    sendUserMessage: (...args) => transportRef.current?.sendUserMessage?.(...args),
    sendUserActivity: (...args) => transportRef.current?.sendUserActivity?.(...args),
  };

  const status = conversation.status;
  const isConnected = status === "connected";

  const restartConversation = useCallback(async (reason = "manual_restart") => {
    suppressDisconnectNoticeRef.current = true;
    disconnectReasonRef.current = reason;
    switchingSessionRef.current = false;
    try {
      if (conversation.status === "connected" || conversation.status === "connecting") await conversation.endSession();
    } catch (error) {
      console.warn("Conversation reset could not close the active transport cleanly", error);
    } finally {
      clearConversationState(reason);
      requestedSessionModeRef.current = null;
      sessionModeRef.current = null;
      setSessionMode(null);
      setStartingMode(null);
      suppressDisconnectNoticeRef.current = false;
      disconnectReasonRef.current = "ended";
    }
  }, [clearConversationState, conversation]);

  useEffect(() => {
    const onRestart = () => { restartConversation("new_conversation"); };
    const onLogout = async () => {
      let bookingClearFailed = false;
      let cardClearFailed = false;
      try {
        clearBookings();
      } catch (error) {
        bookingClearFailed = true;
        console.error("Locally stored bookings could not be cleared during logout", error);
      }
      try {
        window.localStorage.removeItem(DEMO_CARD_STORAGE_KEY);
        if (window.localStorage.getItem(DEMO_CARD_STORAGE_KEY) !== null) throw new Error("Demo card metadata remained after logout.");
      } catch (error) {
        cardClearFailed = true;
        console.error("Demo card metadata could not be cleared during logout", error);
      }
      try {
        window.localStorage.removeItem("vox_cards");
      } catch (error) {
        cardClearFailed = true;
        console.error("Legacy card metadata could not be cleared during logout", error);
      }
      setBookings(bookingClearFailed ? readBookings() : []);
      await restartConversation("logout");
      if (bookingClearFailed || cardClearFailed) {
        say("system", localeRef.current === "ar"
          ? "تعذر مسح بعض البيانات المحلية من هذا الجهاز. أغلق المتصفح وامسح بيانات الموقع قبل استخدام حساب آخر."
          : "Some local data could not be cleared from this device. Close the browser and clear this site's data before another account is used.");
      }
    };
    window.addEventListener("voxi:new-conversation", onRestart);
    window.addEventListener("voxi:logout", onLogout);
    return () => {
      window.removeEventListener("voxi:new-conversation", onRestart);
      window.removeEventListener("voxi:logout", onLogout);
    };
  }, [restartConversation]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const hasTransientState = messagesRef.current.length > 0 || stageRef.current.view !== "empty" || Boolean(sessionModeRef.current);
      if (!hasTransientState || Date.now() - lastActivityRef.current < CONVERSATION_IDLE_MS) return;
      disconnectReasonRef.current = "timeout";
      suppressDisconnectNoticeRef.current = false;
      if (sessionModeRef.current) conversation.endSession().catch(() => {
        clearConversationState("timeout");
        say("system", t("app.timeoutMessage"));
      });
      else {
        clearConversationState("timeout");
        say("system", t("app.timeoutMessage"));
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [clearConversationState, conversation, say, t]);

  const startTransportWithGuards = useCallback(async (options, epoch) => {
    const generation = transportGenerationRef.current;
    const transport = transportRef.current;
    if (!transport) throw new Error("Conversation transport is restarting");
    const startedConversationId = await startTransportWithRetirement({
      transport,
      options,
      retire: () => {
        if (sessionEpochRef.current === epoch) sessionEpochRef.current += 1;
        retireTransportGeneration(generation);
      },
    });
    if (epoch !== sessionEpochRef.current || generation !== transportGenerationRef.current) {
      switchingSessionRef.current = true;
      try { await transport.endSession(); } catch {}
      finally { switchingSessionRef.current = false; }
      return null;
    }
    return startedConversationId || transport.getId?.() || "connected";
  }, [retireTransportGeneration]);

  const startTextSession = useCallback(async (excludeMessageId = null) => {
    if (sessionModeRef.current) return true;
    const activeStart = sessionStartRef.current;
    if (activeStart) {
      await activeStart.promise;
      if (sessionModeRef.current) return true;
    }

    const epoch = sessionEpochRef.current;
    requestedSessionEpochRef.current = epoch;
    requestedSessionModeRef.current = "text";
    continuationSessionRef.current = hasStartedConversationRef.current;
    setStartingMode("text");
    const contextMessages = messagesRef.current.filter((message) => message.id !== excludeMessageId);
    const start = (async () => {
      try {
        const activeLocale = localeRef.current;
        const continuation = continuationSessionRef.current;
        const previousTransportId = transportConversationIdRef.current;
        const handoffJourney = { ...journeyRef.current, locale: activeLocale, transportConversationId: previousTransportId };
        const startedConversationId = await startTransportWithGuards({
          agentId: import.meta.env.VITE_AGENT_ID,
          connectionType: "websocket",
          textOnly: true,
          overrides: {
            conversation: { textOnly: true },
          },
          dynamicVariables: {
            ...journeyDynamicVariables(handoffJourney, { continuation }),
            voxi_session_opening: continuation
              ? (activeLocale === "ar" ? "نكمل من حيث توقفنا في طلبك الحالي." : "Let’s continue from your current booking or enquiry step.")
              : VOXI_FIRST_MESSAGES[activeLocale],
          },
        }, epoch);
        if (!startedConversationId || epoch !== sessionEpochRef.current) return false;
        hasStartedConversationRef.current = true;
        const nextTransportId = startedConversationId === "connected" ? conversation.getId?.() || null : startedConversationId;
        transportConversationIdRef.current = nextTransportId;
        const journeyPayload = {
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: scheduleDateRef.current,
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
          ticketQuantity: ticketQuantityRef.current,
          pendingOrder: pendingOrderRef.current,
          booking: bookingRef.current,
          transportConversationId: nextTransportId,
          previousTransportConversationId: previousTransportId,
        };
        journeyRef.current = syncJourney(handoffJourney, journeyPayload);
        dispatchJourney({ type: "sync", payload: journeyPayload });
        conversation.sendContextualUpdate?.(`${VOXI_AGENT_PROMPT}\n\n${buildVoxiContext({
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: scheduleDateRef.current,
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
          journey: journeyRef.current,
          messages: contextMessages,
        })}${continuation ? `\n\n${buildTransportHandoff(handoffJourney, contextMessages)}` : ""}\n\n${serializeFaqContext(VOX_FAQ_ENTRIES, { locale: activeLocale, maxChars: 14_000 })}`);
        return true;
      } catch (error) {
        console.error("Text conversation could not start", error);
        requestedSessionModeRef.current = null;
        sessionModeRef.current = null;
        setSessionMode(null);
        setStartingMode(null);
        say("system", t("app.textStartError"));
        return false;
      }
    })();
    const entry = { mode: "text", promise: start };
    sessionStartRef.current = entry;
    try {
      return await start;
    } finally {
      if (sessionStartRef.current === entry) sessionStartRef.current = null;
    }
  }, [conversation, say, startTransportWithGuards, t]);

  const startVoiceSession = useCallback(async () => {
    if (sessionModeRef.current === "voice") return;
    const activeStart = sessionStartRef.current;
    if (activeStart) await activeStart.promise;
    if (sessionModeRef.current === "voice") return;

    const previousMode = sessionModeRef.current;
    const epoch = sessionEpochRef.current;
    const start = (async () => {
      let endedPreviousSession = false;
      setStartingMode("voice");
      try {
        // Permission is checked before ending text chat so a denial never
        // removes the guest's working, microphone-free conversation.
        const permissionRequest = navigator.mediaDevices.getUserMedia({ audio: true });
        let permissionTimer;
        let permissionStream;
        try {
          permissionStream = await Promise.race([
            permissionRequest,
            new Promise((_, reject) => {
              permissionTimer = window.setTimeout(() => reject(new Error("Microphone permission timed out")), 10000);
            }),
          ]);
        } catch (error) {
          permissionRequest.then((lateStream) => lateStream.getTracks().forEach((track) => track.stop())).catch(() => {});
          throw error;
        } finally {
          window.clearTimeout(permissionTimer);
        }
        permissionStream.getTracks().forEach((track) => track.stop());
        if (epoch !== sessionEpochRef.current) return false;
        if (sessionModeRef.current) {
          if (cancelResolver.current) {
            dismissPendingCancellation("transport_switch_retry_required");
            say("system", localeRef.current === "ar" ? "أعد طلب الإلغاء بعد تشغيل الصوت لتأكيده بأمان." : "Please restart the cancellation check after voice connects so its confirmation stays attached to the active session.");
          }
          switchingSessionRef.current = true;
          await conversation.endSession();
          endedPreviousSession = true;
        }
        requestedSessionEpochRef.current = epoch;
        requestedSessionModeRef.current = "voice";
        continuationSessionRef.current = hasStartedConversationRef.current;
        const activeLocale = localeRef.current;
        const continuation = continuationSessionRef.current;
        const previousTransportId = transportConversationIdRef.current;
        const handoffJourney = { ...journeyRef.current, locale: activeLocale, transportConversationId: previousTransportId };
        const startedConversationId = await startTransportWithGuards({
          agentId: import.meta.env.VITE_AGENT_ID,
          connectionType: "webrtc",
          textOnly: false,
          dynamicVariables: {
            ...journeyDynamicVariables(handoffJourney, { continuation }),
            voxi_session_opening: continuation
              ? (activeLocale === "ar" ? "نكمل من حيث توقفنا في طلبك الحالي." : "Let’s continue from your current booking or enquiry step.")
              : VOXI_FIRST_MESSAGES[activeLocale],
          },
        }, epoch);
        if (!startedConversationId || epoch !== sessionEpochRef.current) return false;
        hasStartedConversationRef.current = true;
        const nextTransportId = startedConversationId === "connected" ? conversation.getId?.() || null : startedConversationId;
        transportConversationIdRef.current = nextTransportId;
        const journeyPayload = {
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: scheduleDateRef.current,
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
          ticketQuantity: ticketQuantityRef.current,
          pendingOrder: pendingOrderRef.current,
          booking: bookingRef.current,
          transportConversationId: nextTransportId,
          previousTransportConversationId: previousTransportId,
        };
        journeyRef.current = syncJourney(handoffJourney, journeyPayload);
        dispatchJourney({ type: "sync", payload: journeyPayload });
        conversation.sendContextualUpdate?.(`${VOXI_AGENT_PROMPT}\n\n${buildVoxiContext({
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: scheduleDateRef.current,
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
          journey: journeyRef.current,
          messages: messagesRef.current,
        })}${continuation ? `\n\n${buildTransportHandoff(handoffJourney, messagesRef.current)}` : ""}\n\n${serializeFaqContext(VOX_FAQ_ENTRIES, { locale: activeLocale, maxChars: 14_000 })}`);
      } catch (error) {
        console.error("Voice conversation could not start", error);
        switchingSessionRef.current = false;
        setStartingMode(null);
        if (previousMode && !endedPreviousSession) {
          requestedSessionModeRef.current = previousMode;
          sessionModeRef.current = previousMode;
          setSessionMode(previousMode);
        } else {
          requestedSessionModeRef.current = null;
          sessionModeRef.current = null;
          setSessionMode(null);
        }
        say("system", t("app.voiceStartError"));
      }
    })();
    const entry = { mode: "voice", promise: start };
    sessionStartRef.current = entry;
    try {
      return await start;
    } finally {
      if (sessionStartRef.current === entry) sessionStartRef.current = null;
    }
  }, [conversation, say, startTransportWithGuards, t]);

  const endVoiceSession = useCallback(async () => {
    switchingSessionRef.current = true;
    try {
      await conversation.endSession();
    } catch (error) {
      console.warn("Voice transport could not close cleanly", error);
    } finally {
      requestedSessionModeRef.current = null;
      sessionModeRef.current = null;
      setSessionMode(null);
      switchingSessionRef.current = false;
    }
    await startTextSession();
  }, [conversation, startTextSession]);

  const sendText = useCallback(async (text) => {
    const rawValue = (text ?? input).trim();
    if (!rawValue) return;
    const sanitized = sanitizeUserText(rawValue);
    const value = sanitized.safeText.trim();
    if (sanitized.sensitive) {
      say("system", localeRef.current === "ar" ? "تمت إزالة بيانات الدفع الحساسة. أدخل معلومات الدفع في شاشة الدفع الآمنة فقط." : "Sensitive payment details were removed. Enter payment information only in the secure checkout screen.");
    }
    const languageSignal = resolveLanguageSignal({
      role: "user",
      text: value,
      currentLocale: localeRef.current,
      pendingLocale: pendingLanguageSwitchRef.current,
    });
    pendingLanguageSwitchRef.current = languageSignal.pendingLocale;
    if (languageSignal.nextLocale && languageSignal.nextLocale !== localeRef.current) {
      localeRef.current = languageSignal.nextLocale;
      setLocale(languageSignal.nextLocale);
    }
    const localMessage = say("user", value);
    const decision = cancellationFlowRef.current ? cancellationDecision(value) : null;
    if (decision !== null) handleCancellationDecision(decision, { source: "conversation" });
    const historyRequested = isBookingHistoryRequest(value);
    if (historyRequested) openHistory({ notifyAgent: false, forceOpen: true });
    const directCinemaSelection = isDirectCinemaSelectionUtterance({
      text: value,
      view: stageRef.current.view,
      cinemaMatch: resolveCinema(value),
    });
    const actionIntent = classifyFaqActionIntent(value);
    dismissStaleTransactionalView({ text: value, actionIntent, historyRequested, cancellationReply: decision !== null });
    const faq = directCinemaSelection ? { matches: [], context: "" } : prepareFaqContext(value);
    const details = applyUtteranceBookingDetails(value, { actionIntent, hasFaq: faq.matches.length > 0 });
    const bookingContext = !faq.matches.length && (
      actionIntent === "booking"
      || journeyRef.current.intent === "booking"
      || isCinemaSelectionTurn({ view: stageRef.current.view, intent: journeyRef.current.intent, actionIntent, cinemaMatch: details.cinema })
    );
    const availableDates = programmingDatesForCinema(cinemaRef.current);
    const dateRequest = bookingContext
      ? captureUserProgrammingDate(value, availableDates)
      : { requestedDate: null, unavailableDate: null };
    const { requestedDate, unavailableDate } = dateRequest;
    if (!details.cinema && requestedDate && requestedDate !== scheduleDateRef.current) chooseDate(requestedDate, { notifyAgent: false, addTranscript: false });
    if (unavailableDate) showUnavailableProgrammingDate(unavailableDate);
    if (!faq.matches.length) updateIntentFromText(value);
    setInput("");
    if (unavailableDate) {
      conversation.sendContextualUpdate?.(`The guest requested ${unavailableDate}, but it is not published for the selected cinema. No movies were displayed and no other date was substituted. Available dates: ${availableDates.join(", ")}.`);
      return;
    }
    let cinemaRouteResult = null;
    let cinemaPickerDisplayed = false;
    if (details.cinema) {
      cinemaRouteResult = await routeRecognizedCinema(details.cinema, requestedDate);
    } else if (!cinemaRef.current && actionIntent === "booking" && !faq.matches.length) {
      await clientTools.show_movie_selection({});
      cinemaPickerDisplayed = true;
    }
    queuePendingEcho(value);
    const transition = sessionStartRef.current;
    if (transition) await transition.promise;
    const ready = sessionModeRef.current ? true : await startTextSession(localMessage.id);
    if (ready && conversation.sendUserMessage) {
      if (requestedDate) conversation.sendContextualUpdate?.(`The guest explicitly selected programming date ${requestedDate}; the widget has already applied it. Use that date in every movie/session tool call and do not fall back to another date.`);
      if (unavailableDate) conversation.sendContextualUpdate?.(`The guest requested ${unavailableDate}, but it is not published for the selected cinema. Do not substitute another date. Available dates: ${availableDates.join(", ")}.`);
      if (details.cinema) {
        const movieCount = Array.isArray(cinemaRouteResult?.movies) ? cinemaRouteResult.movies.length : 0;
        conversation.sendContextualUpdate?.(cinemaRouteResult?.shown === "movie list"
          ? `The guest explicitly named ${details.cinema.name}. The widget selected it and is displaying ${movieCount} current movies for that cinema. Do not ask for the cinema again; ask only for the next missing booking detail.`
          : `The guest explicitly named ${details.cinema.name}. It is selected, but no movie list is displayed. Reason: ${cinemaRouteResult?.reason || "No published movies were returned."} Do not claim that movies are visible.`);
      } else if (cinemaPickerDisplayed) {
        conversation.sendContextualUpdate?.("Only the VOX Cinemas UAE cinema picker is displayed; no movie list is visible yet. Ask the guest for one cinema and do not say that movies are being shown.");
      }
      if (details.ticketQuantity) conversation.sendContextualUpdate?.(`The guest explicitly requested ${details.ticketQuantity} tickets. Preserve that quantity through seat selection.`);
      if (historyRequested) conversation.sendContextualUpdate?.("The guest's booking summaries saved on this device are already displayed. Do not present them as provider confirmations. Acknowledge and ask them to select the booking they need help with.");
      if (faq.matches.length) conversation.sendContextualUpdate?.(`${faq.context}\nThe guest's current question is: ${value}. Answer from this approved context, use live data only when supplied, and do not restart the conversation.`);
      conversation.sendUserMessage(value);
    }
    else {
      pendingTypedMessagesRef.current = pendingTypedMessagesRef.current.filter((item) => item.text !== value);
      lastSentTextRef.current = pendingTypedMessagesRef.current.at(-1) || null;
    }
  }, [conversation, input, prepareFaqContext, say, setLocale, startTextSession, updateIntentFromText]);

  const sendUiTurn = (text, { display = true, context = "" } = {}) => {
    if (display) say("user", text);
    if (!isConnected || !conversation.sendUserMessage) return;
    if (context) conversation.sendContextualUpdate?.(context);
    queuePendingEcho(text);
    conversation.sendUserMessage(text);
  };

  const pickMovie = async (movie) => {
    const cinemaId = cinemaRef.current?.id;
    if (!cinemaId) {
      showStage({ view: "cinemas" });
      return;
    }
    dismissPendingCancellation("movie_selected");
    clearPendingOrder();
    resetClarificationFailures();
    const requestedDate = scheduleDateRef.current;
    const epoch = beginAsyncRequest();
    const revision = stageRevisionRef.current;
    let sessions;
    try {
      sessions = await vista.getSessions(cinemaId, movie.id, requestedDate);
    } catch (error) {
      if (requestIsCurrent(epoch, revision, cinemaId, requestedDate)) say("system", loadingErrorMessage("showtimes"));
      return;
    }
    if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return;
    sessionsRef.current = sessions;
    sessionsFilmRef.current = movie.id;
    showStage({ view: "showtimes", movie, sessions });
    sendUiTurn(movie.title, { context: `The guest selected ${movie.title} through the UI and its showtimes are already displayed. Do not call show_showtimes again. Acknowledge briefly and ask them to choose a showtime.` });
  };

  const pickSession = async (session) => {
    const cinemaId = cinemaRef.current?.id;
    if (!cinemaId) {
      showStage({ view: "cinemas" });
      return;
    }
    dismissPendingCancellation("session_selected");
    clearPendingOrder();
    resetClarificationFailures();
    const movie = stageRef.current.movie;
    const requestedDate = scheduleDateRef.current;
    const epoch = beginAsyncRequest();
    const revision = stageRevisionRef.current;
    let plan;
    try {
      plan = await vista.getSeatPlan(cinemaId, session.sessionId);
    } catch (error) {
      if (requestIsCurrent(epoch, revision, cinemaId, requestedDate)) say("system", loadingErrorMessage("seats"));
      return;
    }
    if (!requestIsCurrent(epoch, revision, cinemaId, requestedDate)) return;
    const planMeta = vista.getResultMeta(plan);
    planRef.current = plan;
    planContextRef.current = { cinemaId, sessionId: session.sessionId };
    seatsRef.current = [];
    setSelectedSeats([]);
    const quantity = Math.max(1, Math.min(MAX_TICKETS, Math.trunc(Number(ticketQuantityRef.current)) || 1));
    ticketQuantityRef.current = quantity;
    setTicketQuantity(quantity);
    showStage({ view: "seatmap", movie, session, plan, planMeta });
    sendUiTurn(`${session.time} ${session.exp}`, { context: `The guest selected session ${session.sessionId}: ${session.time} ${session.exp} on ${session.date}, and the seat map is already displayed. Inventory verified: ${planMeta?.verified === true ? "yes" : "no"}. ${planMeta?.warning || ""} Do not call show_seat_map again. Acknowledge briefly, disclose any demo warning, and ask for ticket quantity and seats.` });
  };

  const openCinemaPicker = () => {
    dismissPendingCancellation("cinema_picker_opened");
    if (stageRef.current.view === "cinemas") {
      showStage(cinemaReturnRef.current || { view: "empty" });
      return;
    }
    cinemaReturnRef.current = stageRef.current;
    showStage({ view: "cinemas" });
  };

  const chooseCinema = async (nextCinema) => {
    if (nextCinema.id === cinemaRef.current?.id) {
      const pendingDate = userRequestedDateRef.current;
      if (pendingDate && !programmingDatesForCinema(nextCinema).includes(pendingDate)) {
        showUnavailableProgrammingDate(pendingDate);
        return;
      }
      showStage(cinemaReturnRef.current || stageRef.current);
      return;
    }
    const previousCinema = cinemaRef.current;
    const previousDate = scheduleDateRef.current;
    const availableDates = programmingDatesForCinema(nextCinema);
    const dateDecision = resolveProgrammingDateSelection({
      availableDates,
      userRequestedDate: userRequestedDateRef.current,
      selectedDate: previousDate,
    });
    const requestedDate = dateDecision.date || (availableDates.includes(previousDate) ? previousDate : availableDates[0]);
    if (!requestedDate) {
      showStage({ view: "cinemas" });
      say("system", localeRef.current === "ar" ? "لا توجد تواريخ عروض مستقبلية منشورة لهذه السينما." : "No future programming dates are published for this cinema.");
      return;
    }
    resetClarificationFailures();
    clearPendingOrder();
    cinemaRef.current = nextCinema;
    setCinema(nextCinema);
    filmsRef.current = [];
    filmsCinemaRef.current = "";
    filmsDateRef.current = "";
    sessionsRef.current = [];
    sessionsFilmRef.current = "";
    planRef.current = [];
    planContextRef.current = null;
    seatsRef.current = [];
    setSelectedSeats([]);
    if (requestedDate !== scheduleDateRef.current) {
      scheduleDateRef.current = requestedDate;
      setScheduleDate(requestedDate);
    }
    if (dateDecision.blocked) {
      showUnavailableProgrammingDate(dateDecision.unavailableDate);
      sendUiTurn(localeRef.current === "ar" ? `اخترت ${nextCinema.name}` : `I selected ${nextCinema.name}`, {
        context: `The guest selected ${nextCinema.name}, but their explicit date ${dateDecision.unavailableDate} is not published there. No movies were displayed and no other date was substituted. Ask the guest to choose one of these dates: ${availableDates.join(", ")}.`,
      });
      return;
    }
    if (dateDecision.source === "user") userRequestedDateRef.current = null;
    const epoch = beginAsyncRequest();
    showStage({ view: "loading", label: t("app.loadingMovies") });
    const revision = stageRevisionRef.current;
    let movies;
    try {
      movies = await ensureFilms(nextCinema.id, requestedDate);
    } catch (error) {
      if (requestIsCurrent(epoch, revision, nextCinema.id, requestedDate)) {
        cinemaRef.current = previousCinema;
        setCinema(previousCinema);
        scheduleDateRef.current = previousDate;
        setScheduleDate(previousDate);
        showStage({ view: "cinemas" });
        say("system", loadingErrorMessage("movies"));
      }
      return;
    }
    if (!requestIsCurrent(epoch, revision, nextCinema.id, requestedDate)) return;
    showStage({ view: "movies", movies });
    sendUiTurn(localeRef.current === "ar" ? `اخترت ${nextCinema.name}` : `I selected ${nextCinema.name}`, {
      context: `The guest selected ${nextCinema.name} through the UI and its movies are already displayed. Do not call show_movie_selection again. Continue using that cinema, acknowledge briefly, and ask for a movie or date.`,
    });
  };

  const chooseDate = async (nextDate, { notifyAgent = true, addTranscript = true } = {}) => {
    const availableDates = programmingDatesForCinema(cinemaRef.current);
    if (!availableDates.includes(nextDate)) return;
    const hadUserDateConstraint = Boolean(userRequestedDateRef.current);
    userRequestedDateRef.current = null;
    const isRetry = nextDate === scheduleDateRef.current
      && ((stageRef.current.view === "movies" && !stageRef.current.movies?.length) || hadUserDateConstraint);
    if (nextDate === scheduleDateRef.current && !isRetry) return;
    if (!isRetry) applyProgrammingDate(nextDate, "date_changed", availableDates);
    const selectedCinema = cinemaRef.current;
    if (!selectedCinema) {
      showStage({ view: "cinemas" });
      return;
    }
    const epoch = beginAsyncRequest();
    showStage({ view: "loading", label: t("app.loadingMovies") });
    const revision = stageRevisionRef.current;
    let movies;
    try {
      movies = await ensureFilms(selectedCinema.id, nextDate);
    } catch (error) {
      if (requestIsCurrent(epoch, revision, selectedCinema.id, nextDate)) {
        showStage({ view: "movies", movies: [], error: error?.message || "Movie results could not be loaded." });
        say("system", loadingErrorMessage("movies"));
      }
      return;
    }
    if (!requestIsCurrent(epoch, revision, selectedCinema.id, nextDate)) return;
    showStage({ view: "movies", movies });
    if (notifyAgent) sendUiTurn(localeRef.current === "ar" ? `اخترت تاريخ ${nextDate}` : `I selected ${nextDate}`, {
      display: addTranscript,
      context: `The guest selected ${nextDate} through the UI and movie results are already displayed for that date. Do not call show_movie_selection again. Acknowledge briefly and do not ask for the date again.`,
    });
  };

  const openHistory = ({ notifyAgent = true, forceOpen = false } = {}) => {
    dismissPendingCancellation("history_opened");
    if (stageRef.current.view === "history" && !forceOpen) {
      showStage(historyReturnRef.current || { view: "empty" });
      return;
    }
    historyReturnRef.current = stageRef.current;
    setBookings(readBookings());
    showStage({ view: "history" });
    if (notifyAgent) sendUiTurn(localeRef.current === "ar" ? "اعرض حجوزاتي" : "Show my booking history", {
      context: "The guest opened booking summaries saved on this device. Do not describe them as provider confirmations. Acknowledge briefly and ask them to select one if they need help.",
    });
  };

  const openOffers = () => {
    if (stageRef.current.view === "offers") {
      showStage(offersReturnRef.current || { view: "empty" });
      return;
    }
    const current = stageRef.current;
    const activeOrder = current.view === "checkout" ? pendingOrderRef.current : null;
    const activeBooking = current.view === "booking" ? bookingRef.current : null;
    clientTools.show_offers({ experience: current.session?.exp || activeOrder?.experience || activeBooking?.experience || "" });
  };

  const handleOfferSelection = (result) => {
    lastOfferRef.current = result || null;
    if (!result?.offer || !isConnected || !conversation.sendContextualUpdate) return;
    const bank = localizedValue(result.offer.bank, "en") || "the selected bank";
    const card = localizedValue(result.cardProfile?.name, "en") || "no exact card selected";
    const missing = (result.missingFields || []).join(", ") || "none";
    conversation.sendContextualUpdate(
      `The guest selected a published offer in the widget. Bank: ${bank}; card profile: ${card}; eligibility state: ${result.status || "unknown"}; missing fields: ${missing}. This contains offer labels only, not payment credentials. Treat it as guidance and never say the offer was applied.`,
    );
  };

  const selectHistoryBooking = (selected) => {
    clearPendingOrder();
    const performanceDate = selected.performanceDate || selected.sourceDate || selected.date || null;
    const localBooking = { ...selected, date: performanceDate, performanceDate };
    if (localBooking.cinemaId || localBooking.cinemaName) {
      const selectedCinema = resolveCinema(localBooking.cinemaId) || resolveCinema(localBooking.cinemaName) || { id: localBooking.cinemaId || null, name: localBooking.cinemaName || null };
      cinemaRef.current = selectedCinema;
      setCinema(selectedCinema);
    }
    bookingRef.current = localBooking;
    setBooking(localBooking);
    showStage({ view: "booking", booking: localBooking });
    sendUiTurn(localeRef.current === "ar" ? `اخترت الحجز ${localBooking.ref}` : `I selected booking ${localBooking.ref}`, {
      context: `The guest selected on-device booking summary ${localBooking.ref}. Do not present it as a provider confirmation. Its performance date is ${performanceDate || "not supplied"}; status is ${localBooking.cancelled ? "cancelled" : localBooking.bookingStatus || "saved"}; refund status is ${localBooking.refundStatus || "none"}; refund reference is ${localBooking.refundReference || "none"}.`,
    });
  };

  const toggleSeat = (seat) => {
    resetClarificationFailures();
    const current = seatsRef.current;
    const target = Math.max(1, Math.min(MAX_TICKETS, Math.trunc(Number(ticketQuantityRef.current)) || 1));
    if (!current.includes(seat.id) && current.length >= target) {
      say("system", localeRef.current === "ar" ? `اختر ${target} مقعداً فقط، أو غيّر عدد التذاكر أولاً.` : `Select exactly ${target} seat${target === 1 ? "" : "s"}, or change the ticket quantity first.`);
      return;
    }
    const next = current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id];
    seatsRef.current = next;
    setSelectedSeats(next);
  };

  const confirmSeats = async (seats) => {
    const result = await finalizeSeats(seats);
    if (!result.valid.length || ["quantity_mismatch", "pricing_unavailable"].includes(result.reason)) {
      const expected = result.expectedQuantity || ticketQuantityRef.current || 1;
      const message = result.reason === "pricing_unavailable"
        ? (localeRef.current === "ar" ? "تعذر التحقق من السعر. حاول مرة أخرى قبل المتابعة إلى الدفع." : "The price could not be verified. Please try again before continuing to checkout.")
        : (localeRef.current === "ar" ? `اختر ${expected} مقعداً متاحاً لتطابق عدد التذاكر.` : `Select exactly ${expected} available seat${expected === 1 ? "" : "s"} to match the ticket quantity.`);
      say("system", message);
      return;
    }
    sendUiTurn(`Confirm seats ${result.valid.join(", ")}`, {
      context: `The guest confirmed seats ${result.valid.join(", ")} through the UI and checkout is already displayed. Do not call select_seats again; acknowledge briefly and never ask for payment details by voice or text.`,
    });
  };

  const completeCancellation = async ({ source = "ui" } = {}) => {
    const current = bookingRef.current;
    const flow = cancellationFlowRef.current;
    if (!current || current.cancelled || cancellationInFlightRef.current) return false;
    if (flow?.bookingRef && norm(flow.bookingRef) !== norm(current.ref)) return false;
    const operationId = cancellationOperationRef.current + 1;
    cancellationOperationRef.current = operationId;
    const operationSessionEpoch = sessionEpochRef.current;
    const operationBookingRef = norm(current.ref);
    cancellationInFlightRef.current = true;
    let refundResult;
    try {
      refundResult = await vista.refundBooking(current.ref, { booking: current });
    } catch (error) {
      refundResult = { Result: -1, ErrorDescription: error?.message || "Refund request failed." };
    }
    const isDemoSimulation = refundResult?.demo === true
      && refundResult?.verified !== true
      && refundResult?.applied !== true;
    const refundReference = refundResult?.RefundReference || refundResult?.refundReference || refundResult?.reference || null;
    const liveRefundSucceeded = refundResult?.demo !== true
      && refundResult?.verified === true
      && refundResult?.applied === true
      && Boolean(refundReference);
    const operationIsCurrent = cancellationOperationRef.current === operationId;
    const sessionIsCurrent = sessionEpochRef.current === operationSessionEpoch
      && norm(bookingRef.current?.ref) === operationBookingRef;
    if (operationIsCurrent) cancellationInFlightRef.current = false;
    const cancelledAt = new Date().toISOString();
    const updated = {
      ...current,
      cancelled: true,
      cancelledAt,
      bookingStatus: isDemoSimulation ? "cancelled_demo" : "cancelled",
      refundRoute: isDemoSimulation ? null : "VOX Wallet",
      refundStatus: isDemoSimulation ? "not_processed_demo" : "processed",
      refundReference: isDemoSimulation ? null : refundReference,
    };
    if (!operationIsCurrent || !sessionIsCurrent) {
      // Never repopulate device storage after a reset/logout. A verified live
      // refund remains provider truth, but it must not leak into a new session.
      if (liveRefundSucceeded) console.warn("A live refund completed after its Voxi session was no longer active", refundReference);
      return liveRefundSucceeded;
    }
    if (!isDemoSimulation && !liveRefundSucceeded) {
      const reason = refundResult?.ErrorDescription || refundResult?.message || "The refund adapter did not confirm cancellation.";
      window.clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
      const resolver = cancelResolver.current;
      cancelResolver.current = null;
      cancellationFlowRef.current = null;
      if (resolver) resolver(JSON.stringify({ confirmed: false, bookingRef: current.ref, reason }));
      say("system", localeRef.current === "ar" ? `لم يتم إلغاء الحجز: ${reason}` : `The booking was not cancelled: ${reason}`);
      return false;
    }
    let storagePersisted = false;
    let storageError = null;
    try {
      appendBooking(updated);
      storagePersisted = true;
    } catch (error) {
      storageError = error;
      console.error("Cancellation result could not be written to local booking history", error);
    }
    if (isDemoSimulation && !storagePersisted) {
      if (cancelResolver.current) {
        window.clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = null;
        const resolver = cancelResolver.current;
        cancelResolver.current = null;
        resolver(JSON.stringify({
          confirmed: false,
          simulationOnly: true,
          localCancellationRecorded: false,
          refundApplied: false,
          bookingRef: current.ref,
          reason: storageError?.message || "The on-device cancellation could not be saved.",
          message: "No refund was processed and the booking summary remains active on this device.",
        }));
      }
      cancellationFlowRef.current = null;
      say("system", localeRef.current === "ar"
        ? "تعذر تسجيل الإلغاء على هذا الجهاز. بقي سجل الحجز نشطاً، ولم تتم معالجة أي استرداد."
        : "The cancellation could not be saved on this device. The booking summary remains active and no refund was processed.");
      return false;
    }
    bookingRef.current = updated;
    setBooking(updated);
    setBookings(storagePersisted
      ? readBookings()
      : (existing) => existing.some((item) => norm(item.ref) === operationBookingRef)
        ? existing.map((item) => norm(item.ref) === operationBookingRef ? updated : item)
        : [...existing, updated]);
    showStage({ view: "booking", booking: updated });
    if (cancelResolver.current) {
      window.clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
      const resolver = cancelResolver.current;
      cancelResolver.current = null;
      resolver(JSON.stringify(isDemoSimulation ? {
        confirmed: true,
        simulationOnly: true,
        localCancellationRecorded: true,
        liveRefundConfirmed: false,
        refundApplied: false,
        bookingRef: updated.ref,
        bookingStatus: updated.bookingStatus,
        cancelledAt: updated.cancelledAt,
        refundRoute: updated.refundRoute,
        refundStatus: updated.refundStatus,
        refundReference: null,
        storagePersisted,
        message: "The booking is marked cancelled on this device. No refund was processed.",
      } : {
        confirmed: true,
        simulationOnly: false,
        liveRefundConfirmed: true,
        refundApplied: true,
        bookingRef: updated.ref,
        bookingStatus: updated.bookingStatus,
        cancelledAt: updated.cancelledAt,
        refundRoute: updated.refundRoute,
        refundStatus: updated.refundStatus,
        refundReference,
        storagePersisted,
        localStorageWarning: storagePersisted ? null : "The verified refund was applied, but the device booking record could not be saved.",
      }));
    }
    cancellationFlowRef.current = null;
    if (isDemoSimulation) {
      say("system", localeRef.current === "ar"
        ? "تم تسجيل الحجز كملغى على هذا الجهاز فقط، ولم تتم معالجة أي استرداد مالي."
        : "The booking is marked cancelled on this device only. No refund was processed.");
    } else if (!storagePersisted) {
      say("system", localeRef.current === "ar"
        ? `تم تأكيد الاسترداد الحقيقي بالمرجع ${refundReference}، لكن تعذر حفظ حالة الإلغاء على هذا الجهاز.`
        : `The live refund was confirmed with reference ${refundReference}, but the cancelled status could not be saved on this device.`);
    }
    if (source === "ui") {
      sendUiTurn(localeRef.current === "ar" ? `نعم، ألغِ الحجز ${updated.ref}` : `Yes, cancel booking ${updated.ref}`, {
        context: isDemoSimulation
          ? `Booking summary ${updated.ref} is marked cancelled only on this device. Refund status is not processed; no refund occurred and there is no refund reference. State that boundary once and never describe it as a completed refund.`
          : `The verified refund adapter confirmed cancellation of ${updated.ref}. Refund route: VOX Wallet. Refund reference: ${refundReference}. Local storage persisted: ${storagePersisted ? "yes" : "no"}. Confirm the refund truthfully and disclose the local-storage warning when present.`,
      });
    }
    resetClarificationFailures();
    return true;
  };

  const handleCancellationDecision = (decision, { source = "conversation", explicitFinal = false } = {}) => {
    if (!cancellationFlowRef.current && explicitFinal && bookingRef.current?.ref) {
      const current = bookingRef.current;
      const demoOnly = current.demo === true
        || current.verified !== true
        || current.paymentStatus === "simulated_not_charged"
        || current.bookingStatus === "confirmed_demo";
      cancellationFlowRef.current = { bookingRef: current.ref, phase: "final_confirmation", refundRoute: demoOnly ? null : "VOX Wallet", demoOnly };
    }
    const flow = cancellationFlowRef.current;
    if (!flow) return false;
    if (!decision) {
      dismissPendingCancellation("guest_declined");
      cancellationFlowRef.current = null;
      say("system", localeRef.current === "ar" ? "لم يتم إلغاء الحجز." : "The booking was kept active.");
      return true;
    }
    if (flow.phase === "route_confirmation" && !explicitFinal) {
      flow.phase = "final_confirmation";
      window.clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = window.setTimeout(() => dismissPendingCancellation("confirmation_timeout"), 90_000);
      const current = bookingRef.current;
      say("system", localeRef.current === "ar"
        ? `تأكيد نهائي: هل تريد إلغاء الحجز ${flow.bookingRef} وإعادة ${current?.total ?? current?.refundAmount ?? "المبلغ"} درهماً إلى محفظة VOX؟ قل نعم للمتابعة أو لا للإبقاء على الحجز.`
        : `Final confirmation: cancel booking ${flow.bookingRef} and return AED ${current?.total ?? current?.refundAmount ?? "the eligible amount"} to VOX Wallet? Say yes to proceed or no to keep the booking.`);
      return true;
    }
    completeCancellation({ source });
    return true;
  };

  const cancelBooking = () => {
    if (!cancellationFlowRef.current && bookingRef.current?.ref) {
      const current = bookingRef.current;
      const demoOnly = current.demo === true
        || current.verified !== true
        || current.paymentStatus === "simulated_not_charged"
        || current.bookingStatus === "confirmed_demo";
      cancellationFlowRef.current = { bookingRef: current.ref, phase: "final_confirmation", refundRoute: demoOnly ? null : "VOX Wallet", demoOnly };
    }
    handleCancellationDecision(true, { source: "ui", explicitFinal: true });
  };

  const changeLanguage = (nextLocale) => {
    if (nextLocale === locale) return;
    pendingLanguageSwitchRef.current = null;
    localeRef.current = nextLocale;
    setLocale(nextLocale);
    if (stageRef.current.view === "faq" && stageRef.current.faq?.entry?.answer?.[nextLocale]) {
      showStage({
        ...stageRef.current,
        faq: { ...stageRef.current.faq, locale: nextLocale, answer: stageRef.current.faq.entry.answer[nextLocale] },
      });
    }
    const next = nextLocale === "ar" ? "Arabic" : "English";
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`The guest explicitly selected ${next}. This visible selector action is confirmed. Preserve the active task and continue in ${next} without repeating the welcome message. ${buildVoxiContext({
        locale: nextLocale,
        cinema: cinemaRef.current,
        scheduleDate: scheduleDateRef.current,
        stage: stageRef.current,
        selectedSeats: seatsRef.current,
        journey: { ...journeyRef.current, locale: nextLocale },
        messages: messagesRef.current,
      })} ${serializeFaqContext(VOX_FAQ_ENTRIES, { locale: nextLocale, maxChars: 14_000 })}`);
    }
  };

  const scrollRef = useRef(null);
  const stageAnchorRef = useRef(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (stage.view === "empty") {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    const anchor = stageAnchorRef.current;
    if (!anchor) return;
    const target = anchor.getBoundingClientRect().top
      - scroller.getBoundingClientRect().top
      + scroller.scrollTop
      - 10;
    scroller.scrollTop = Math.max(0, target);
  }, [stage]);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && stageRef.current.view === "empty") scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  const chips = [t("app.chipShowing"), t("app.chipBook"), t("app.chipCancel")];
  const statusLabel = startingMode
    ? t("app.connectingMode", { mode: t(startingMode === "text" ? "app.textMode" : "app.voiceMode") })
    : status === "connected"
      ? t(sessionMode === "text" ? "app.textMode" : "app.voiceMode")
      : t("app.disconnected");
  const displayedBooking = stage.booking || booking;
  const displayedProgrammingDates = programmingDatesForCinema(cinema);

  return (
    <div lang={locale} dir={dir} style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <ElevenLabsTransport
        key={transportGeneration}
        ref={transportRef}
        callbacks={transportCallbacks}
        clientTools={clientTools}
        generation={transportGeneration}
        isActive={isTransportGenerationActive}
        onStatus={updateTransportStatus}
      />
      <style>{`.voxi-chip-row::-webkit-scrollbar{display:none}.voxi-widget :is(button,input,select,summary):focus-visible{outline:2px solid ${C.lavender}!important;outline-offset:2px;box-shadow:0 0 0 4px rgba(228,220,240,.16)}`}</style>
      <div className="voxi-widget" style={{ width: "100%", maxWidth: 420, height: "min(860px, 96vh)", display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.55)", background: C.ink, border: "1px solid rgba(255,255,255,.06)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,.08)", padding: "11px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 9 }}>
            <div style={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 8, fontWeight: 900, color: "#fff", background: C.magenta }}>V</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: "hidden", fontSize: 14, fontWeight: 700, color: "#fff", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("app.title")}</div>
                <div dir="ltr" style={{ overflow: "hidden", maxWidth: 128, color: "rgba(255,255,255,.48)", fontSize: 10, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("app.brand")}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
              <TopButton label={cinema ? `${t("app.changeCinema")}: ${stripVox(cinema.name)}` : t("app.chooseCinema")} onClick={openCinemaPicker}><MapPin size={14} /></TopButton>
              <TopButton label={t("app.offers")} onClick={openOffers}><BadgePercent size={14} /></TopButton>
              <TopButton label={t("app.history")} onClick={openHistory}><History size={14} /></TopButton>
              <TopButton label={t("app.restart")} onClick={() => restartConversation("manual_restart")}><RotateCcw size={14} /></TopButton>
              <LanguageSelector locale={locale} label={t("app.language")} onSelect={changeLanguage} />
            <span role="status" aria-live="polite" title={statusLabel} aria-label={statusLabel} style={{ display: "flex", width: 18, height: 28, alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.52)" }}>
              <span style={{ height: 7, width: 7, borderRadius: 999, background: isConnected ? C.green : status === "connecting" ? "#D9A94B" : "#777" }} />
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{statusLabel}</span>
            </span>
          </div>
        </header>

        <main ref={scrollRef} aria-label={t("app.conversation")} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", padding: 16, background: `radial-gradient(120% 60% at 50% -10%, ${C.screen}, ${C.ink})` }}>
          {!!messages.length && (
            <div role="log" aria-live="polite" aria-relevant="additions text" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: stage.view === "empty" ? 0 : 14 }}>
              {messages.map((message, index) => (
                <div key={message.id || `${message.at}-${index}`} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                  <div dir="auto" style={{ maxWidth: "85%", borderRadius: 16, padding: "9px 13px", fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere", background: message.role === "user" ? C.purple : message.role === "system" ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)", color: message.role === "system" ? "rgba(255,255,255,.5)" : message.role === "user" ? "#fff" : "rgba(255,255,255,.9)", fontStyle: message.role === "system" ? "italic" : "normal" }}>{message.text}</div>
                </div>
              ))}
            </div>
          )}
          {stage.view === "empty" && (!messages.length || messages.every((message) => message.role === "system")) && (
            <div style={{ display: "flex", height: "100%", minHeight: 240, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ display: "flex", height: 56, width: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, background: "rgba(182,24,108,.15)", marginBottom: 16 }}><Sparkles color={C.lavender} size={26} /></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{t("app.emptyTitle")}</div>
              <p style={{ maxWidth: 280, marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.5)" }}>{t("app.emptyBody")}</p>
              {!cinema && <button type="button" onClick={openCinemaPicker} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, border: 0, borderRadius: 999, background: C.magenta, padding: "9px 15px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><MapPin size={14} />{t("app.chooseCinema")}</button>}
            </div>
          )}
          {stage.view !== "empty" && <div ref={stageAnchorRef} aria-hidden="true" />}
          {cinema && ["movies", "showtimes"].includes(stage.view) && <DateStrip dates={displayedProgrammingDates} selected={stage.errorCode === "date_unavailable" ? null : scheduleDate} locale={locale} label={t("dates.label")} onSelect={chooseDate} />}
          {stage.view === "loading" && <LoadingPanel label={stage.label} />}
          {stage.view === "faq" && stage.faq && <FaqPanel result={stage.faq} label={t("faq.official")} capabilityLabel={t("faq.capability")} liveLabel={t("faq.live")} backLabel={t("common.back")} onBack={() => showStage(faqReturnRef.current || { view: "empty" })} />}
          {stage.view === "cinemas" && <CinemaPicker cinemas={CINEMAS} selected={cinema} onSelect={chooseCinema} onBack={() => showStage(cinemaReturnRef.current || { view: "empty" })} />}
          {stage.view === "movies" && cinema && <MovieGrid movies={stage.movies} cinemaName={stripVox(cinema.name)} scheduleDate={stage.errorCode === "date_unavailable" ? userRequestedDateRef.current : scheduleDate} onSelect={pickMovie} error={stage.error} onRetry={stage.errorCode === "date_unavailable" ? undefined : () => clientTools.show_movie_selection({ cinemaId: cinema.id, date: scheduleDate })} />}
          {stage.view === "showtimes" && <Showtimes movie={stage.movie} sessions={stage.sessions} onSelect={pickSession} onBack={() => clientTools.show_movie_selection()} />}
          {stage.view === "seatmap" && (
            <div>
              <TicketQuantityControl value={ticketQuantity || Math.max(selectedSeats.length, 1)} label={t("tickets.quantity")} decreaseLabel={t("tickets.decrease")} increaseLabel={t("tickets.increase")} onChange={(value) => {
                ticketQuantityRef.current = value;
                setTicketQuantity(value);
                if (selectedSeats.length > value) {
                  const next = selectedSeats.slice(0, value);
                  seatsRef.current = next;
                  setSelectedSeats(next);
                }
              }} />
              <SeatMap movie={stage.movie} session={stage.session} plan={stage.plan} selected={selectedSeats} pricing={SEAT_PRICING_PREVIEW} notice={stage.planMeta?.verified === false ? true : stage.planMeta?.warning || false} onToggle={toggleSeat} onConfirm={confirmSeats} onBack={() => clientTools.show_showtimes({ movieId: stage.movie.id, movieTitle: stage.movie.title })} />
            </div>
          )}
          {stage.view === "checkout" && stage.order && <Checkout key={stage.order.checkoutId} order={stage.order} onPaid={handlePaid} onCancel={() => { clearPendingOrder(); showStage({ view: "seatmap", movie: stage.movie, session: stage.session, plan: planRef.current, planMeta: stage.planMeta || vista.getResultMeta(planRef.current) }); }} />}
          {stage.view === "booking" && displayedBooking && <BookingCard booking={displayedBooking} onCancel={cancelBooking} onDecline={() => handleCancellationDecision(false, { source: "ui" })} cancelled={displayedBooking.cancelled} />}
          {stage.view === "history" && <BookingHistory bookings={bookings} onSelect={selectHistoryBooking} onBack={() => showStage(historyReturnRef.current || { view: "empty" })} />}
          {stage.view === "offers" && (
            <div>
              {stage.showtimeRequired && <div role="status" style={{ marginBottom: 10, borderRadius: 10, background: "rgba(217,169,75,.12)", padding: "9px 11px", color: "#EAD19A", fontSize: 10, lineHeight: 1.45 }}>{t("offers.showtimeRequired")}</div>}
              <OffersPanel
                locale={locale}
                context={stage.context}
                initialQuery={stage.query}
                initialOfferId={stage.result?.offer?.id}
                initialProfileId={stage.result?.cardProfile?.id}
                onSelectionChange={handleOfferSelection}
                onBack={() => showStage(offersReturnRef.current || { view: "empty" })}
              />
            </div>
          )}
          {stage.view === "handover" && <HandoverPanel payload={stage.payload} labels={{
            connectingTitle: t("handover.connecting"),
            connectingBody: t("handover.connectingBody"),
            readyTitle: t("handover.ready"),
            readyBody: t("handover.readyBody"),
            simulation: t("handover.badge"),
            debugTitle: t("handover.payload"),
            debugHint: t("handover.debugHint"),
            summaryStep: t("handover.summaryStep"),
            queueReadyStep: t("handover.queueStep"),
            connectingStep: t("handover.preparingStep"),
            safeContext: t("handover.safeContext"),
          }} />}
        </main>

        <section aria-label={t("app.conversation")} style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,.08)", background: C.ink2, flexShrink: 0 }}>
          <div className="voxi-chip-row" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 16px 8px", scrollbarWidth: "none" }}>
            {chips.map((chip) => <button key={chip} onClick={() => sendText(chip)} style={{ flexShrink: 0, borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "none", padding: "5px 11px", color: "rgba(255,255,255,.7)", fontSize: 11, whiteSpace: "nowrap", cursor: "pointer" }}>{chip}</button>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,.08)", padding: 12 }}>
            <button onClick={isConnected && sessionMode === "voice" ? endVoiceSession : startVoiceSession} disabled={startingMode === "voice"} title={isConnected && sessionMode === "voice" ? t("app.endVoice") : t("app.enableVoice")} aria-label={isConnected && sessionMode === "voice" ? t("app.endVoice") : t("app.enableVoice")} style={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", cursor: startingMode === "voice" ? "progress" : "pointer", color: "#fff", opacity: startingMode === "voice" ? 0.65 : 1, background: isConnected && sessionMode === "voice" ? "#8D2E3A" : `radial-gradient(circle at 35% 30%, ${C.lavender}, ${C.purple})` }}>{isConnected && sessionMode === "voice" ? <MicOff size={17} /> : <Mic size={17} />}</button>
            <input dir="auto" value={input} onChange={(event) => { lastActivityRef.current = Date.now(); setInput(event.target.value); if (isConnected && conversation.sendUserActivity) conversation.sendUserActivity(); }} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && sendText()} placeholder={t("app.inputPlaceholder")} aria-label={t("app.inputPlaceholder")} style={{ minWidth: 0, flex: 1, border: "none", borderRadius: 999, outline: "none", background: "rgba(255,255,255,.05)", padding: "10px 14px", color: "#fff", fontSize: 14, textAlign: "start" }} />
            <button onClick={() => sendText()} disabled={!input.trim()} aria-label={t("app.send")} style={{ display: "flex", height: 36, width: 36, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", cursor: "pointer", color: "#fff", background: C.magenta, opacity: input.trim() ? 1 : 0.3 }}><Send size={16} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function TopButton({ label, onClick, children }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} style={{ display: "grid", width: 28, height: 28, flexShrink: 0, placeItems: "center", border: 0, borderRadius: 8, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.62)", cursor: "pointer" }}>{children}</button>;
}

function DateStrip({ dates, selected, locale, label, onSelect }) {
  const format = new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div role="group" aria-label={label} className="voxi-chip-row" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2, scrollbarWidth: "none" }}>
      {dates.map((date) => (
        <button key={date} type="button" aria-pressed={date === selected} onClick={() => onSelect(date)} style={{ flexShrink: 0, border: date === selected ? `1px solid ${C.magenta}` : "1px solid rgba(255,255,255,.12)", borderRadius: 10, background: date === selected ? "rgba(182,24,108,.18)" : "rgba(255,255,255,.035)", padding: "7px 10px", color: date === selected ? "#fff" : "rgba(255,255,255,.62)", fontSize: 10, fontWeight: date === selected ? 700 : 500, cursor: "pointer" }}>
          <span dir="auto">{format.format(new Date(`${date}T12:00:00+04:00`))}</span>
        </button>
      ))}
    </div>
  );
}

function LoadingPanel({ label }) {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", minHeight: 220, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,.62)", textAlign: "center" }}>
      <span aria-hidden="true" style={{ display: "block", width: 24, height: 24, border: "3px solid rgba(255,255,255,.14)", borderTopColor: C.lavender, borderRadius: "50%", animation: "voxi-spin .9s linear infinite" }} />
      <style>{`@keyframes voxi-spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}

function FaqPanel({ result, label, capabilityLabel, liveLabel, backLabel, onBack }) {
  const source = result.metadata?.source?.[0];
  const heading = result.metadata?.provenance === "product" ? capabilityLabel : label;
  return (
    <article style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, background: "linear-gradient(145deg, rgba(99,65,141,.25), rgba(30,23,40,.62))", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.lavender, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .6 }}><Sparkles size={14} />{heading}</div>
      <p dir="auto" style={{ margin: "11px 0 0", color: "rgba(255,255,255,.86)", fontSize: 13, lineHeight: 1.55 }}>{result.answer}</p>
      {result.needsLiveData && <p style={{ margin: "9px 0 0", color: "rgba(255,255,255,.48)", fontSize: 10, lineHeight: 1.45 }}>{liveLabel}</p>}
      {source?.url && <a href={source.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: C.lavender, fontSize: 10 }}>{source.title}</a>}
      {onBack && <button type="button" onClick={onBack} style={{ display: "block", marginTop: 14, border: "1px solid rgba(255,255,255,.14)", borderRadius: 8, background: "rgba(255,255,255,.04)", padding: "7px 11px", color: "rgba(255,255,255,.76)", fontSize: 11, cursor: "pointer" }}>{backLabel}</button>}
    </article>
  );
}

function TicketQuantityControl({ value, label, decreaseLabel, increaseLabel, onChange }) {
  const quantity = Math.max(1, Math.min(10, Number(value) || 1));
  return (
    <div role="group" aria-label={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, background: "rgba(255,255,255,.035)", padding: "9px 12px" }}>
      <span style={{ color: "rgba(255,255,255,.68)", fontSize: 12 }}>{label}</span>
      <span dir="ltr" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" aria-label={decreaseLabel} disabled={quantity <= 1} onClick={() => onChange(quantity - 1)} style={{ width: 28, height: 28, border: "1px solid rgba(255,255,255,.14)", borderRadius: 8, background: "rgba(255,255,255,.04)", color: "#fff", opacity: quantity <= 1 ? .35 : 1, cursor: quantity <= 1 ? "not-allowed" : "pointer" }}>−</button>
        <strong style={{ minWidth: 16, color: "#fff", textAlign: "center" }}>{quantity}</strong>
        <button type="button" aria-label={increaseLabel} disabled={quantity >= 10} onClick={() => onChange(quantity + 1)} style={{ width: 28, height: 28, border: 0, borderRadius: 8, background: C.magenta, color: "#fff", opacity: quantity >= 10 ? .35 : 1, cursor: quantity >= 10 ? "not-allowed" : "pointer" }}>+</button>
      </span>
    </div>
  );
}

function LanguageSelector({ locale, label, onSelect }) {
  return (
    <div role="group" aria-label={label} title={label} style={{ display: "flex", height: 28, flexShrink: 0, alignItems: "center", gap: 1, borderRadius: 8, background: "rgba(255,255,255,.05)", padding: 2 }}>
      {[{ code: "en", label: "English" }, { code: "ar", label: "العربية" }].map((item) => (
        <button key={item.code} type="button" aria-pressed={locale === item.code} aria-label={item.code === "en" ? "English" : "العربية"} onClick={() => onSelect(item.code)} style={{ minWidth: item.code === "en" ? 43 : 47, height: 22, border: 0, borderRadius: 6, paddingInline: 5, background: locale === item.code ? C.magenta : "transparent", color: locale === item.code ? "#fff" : "rgba(255,255,255,.55)", fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{item.label}</button>
      ))}
    </div>
  );
}
