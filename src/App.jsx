import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { BadgePercent, History, MapPin, Mic, MicOff, RotateCcw, Send, Sparkles } from "lucide-react";
import { C } from "./theme.js";
import { BookingCard, CinemaPicker, MovieGrid, SeatMap, Showtimes } from "./components/RichMedia.jsx";
import BookingHistory from "./components/BookingHistory.jsx";
import Checkout from "./components/Checkout.jsx";
import HandoverPanel from "./components/HandoverPanel.jsx";
import OffersPanel from "./components/OffersPanel.jsx";
import { appendBooking, findBooking, markCancelled, readBookings } from "./bookingStore.js";
import { useI18n } from "./i18n/I18nProvider.jsx";
import { HANDOVER_TRIGGER, buildHandoverPayload, isClarificationFailureReason } from "./lib/handoverSummary.js";
import { resolveFilmCandidate } from "./lib/fuzzyResolvers.js";
import { resolveLanguageSignal } from "./lib/languageSwitch.js";
import { buildTransportHandoff, createConversationJourney, inferIntent, journeyDynamicVariables, journeyReducer, syncJourney } from "./lib/conversationJourney.js";
import { VOXI_AGENT_PROMPT, VOXI_FIRST_MESSAGES, buildVoxiContext } from "./lib/voxiSession.js";
import { OFFER_META } from "./offers/offersData.js";
import { resolveOffer, resolveOfferForBankAndCard } from "./offers/offerResolver.js";
import { VOX_FAQ_ENTRIES, buildFaqContextForQuery, serializeFaqContext } from "./knowledge/index.js";
import * as vista from "./vistaClient.js";

const CINEMAS = vista.getCinemas();
const PROGRAMMING_DATES = vista.getProgrammingDates();
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
  if (result?.status === "card_required") return "نحتاج إلى تفاصيل إضافية عن البطاقة أو صيغة العرض أو فئة المقعد لتأكيد الأهلية.";
  return "لا تتحقق جميع شروط العرض في السياق المحدد؛ راجع الشروط أو أكد الأهلية عند الدفع.";
};

const CONVERSATION_IDLE_MS = 15 * 60 * 1000;

function newConversationId() {
  try { return crypto.randomUUID(); } catch { return `voxi-${Date.now().toString(36)}`; }
}

async function withStartTimeout(promise, timeoutMs = 15_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Conversation start timed out")), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
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

  // Blocking cancellation tool state. Seat selection remains deliberately
  // non-blocking so both voice and touch can continue to use select_seats.
  const cancelResolver = useRef(null);
  const cancelTimerRef = useRef(null);

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
  const switchingSessionRef = useRef(false);
  const lastSentTextRef = useRef(null);
  const pendingTypedMessagesRef = useRef([]);
  const hasStartedConversationRef = useRef(false);
  const hasDisplayedWelcomeRef = useRef(false);
  const continuationSessionRef = useRef(false);
  const pendingLanguageSwitchRef = useRef(null);
  const disconnectReasonRef = useRef("ended");
  const suppressDisconnectNoticeRef = useRef(false);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { cinemaRef.current = cinema; }, [cinema]);
  useEffect(() => { bookingRef.current = booking; }, [booking]);
  useEffect(() => { pendingOrderRef.current = pendingOrder; }, [pendingOrder]);
  useEffect(() => { seatsRef.current = selectedSeats; }, [selectedSeats]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => { scheduleDateRef.current = scheduleDate; }, [scheduleDate]);
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
    lastActivityRef.current = Date.now();
    setMessages((current) => {
      const next = [...current, { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, role, text, at }];
      messagesRef.current = next;
      return next;
    });
  }, []);

  const updateIntentFromText = useCallback((text) => {
    const intent = inferIntent({ view: stageRef.current?.view, text, previousIntent: journeyRef.current.intent });
    if (!intent || intent === journeyRef.current.intent) return intent;
    journeyRef.current = { ...journeyRef.current, intent, lastActivityAt: new Date().toISOString() };
    dispatchJourney({ type: "intent", intent });
    return intent;
  }, []);

  const resolveCinema = (idOrName) => {
    const key = norm(idOrName).replace(/^vox\s*[—-]?\s*/, "");
    if (!key) return null;
    return (
      CINEMAS.find((item) => norm(item.id) === key) ||
      CINEMAS.find((item) => norm(stripVox(item.name)) === key) ||
      CINEMAS.find((item) => norm(item.name).includes(key) || key.includes(norm(stripVox(item.name)))) ||
      null
    );
  };

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
    if (!sessions.length) return null;
    return (
      sessions.find((item) => String(item.sessionId) === String(sessionId)) ||
      sessions.find((item) => norm(item.time) === norm(showtime)) ||
      sessions.find((item) => norm(showtime).includes(norm(item.time))) ||
      sessions[0]
    );
  };

  const resetClarificationFailures = () => {
    clarificationFailuresRef.current = 0;
    clarificationFailureLogRef.current = [];
  };

  const dismissPendingCancellation = (reason = "dismissed") => {
    if (!cancelResolver.current) return;
    window.clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = null;
    const resolver = cancelResolver.current;
    cancelResolver.current = null;
    resolver(JSON.stringify({ confirmed: false, reason }));
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
    const faqIntent = primary.topic === "offers" ? "offers" : primary.topic === "cancellations_refunds" ? "cancellation" : "general_enquiry";
    journeyRef.current = { ...journeyRef.current, intent: faqIntent };
    dispatchJourney({ type: "intent", intent: faqIntent });
    if (render) showStage({ view: "faq", faq: primary });
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

  const finalizeSeats = (seatIds) => {
    const current = stageRef.current;
    const planContext = planContextRef.current;
    if (current.view !== "seatmap" || !planContext || planContext.cinemaId !== cinemaRef.current?.id || String(planContext.sessionId) !== String(current.session?.sessionId)) {
      return { valid: [], total: 0, stale: true };
    }
    const plan = planRef.current || [];
    const all = plan.flatMap((row) => row.seats);
    const requested = [...new Set((seatIds || []).map((id) => String(id).toUpperCase()))];
    const valid = requested.filter((id) => all.some((seat) => seat.id === id && seat.status === 0));
    const price = (premium) => (premium ? 63 : 42);
    const total = valid.reduce((sum, id) => {
      const seat = all.find((item) => item.id === id);
      return sum + (seat ? price(seat.premium) : 0);
    }, 0);
    const movie = current.movie;
    const session = current.session;
    const selectedCinema = cinemaRef.current;
    if (valid.length && selectedCinema) {
      const order = {
        movieId: movie?.id,
        movieTitle: movie?.title,
        cinemaId: selectedCinema.id,
        cinemaName: selectedCinema.name,
        sessionId: session?.sessionId,
        date: session?.date || scheduleDateRef.current,
        experience: session?.exp,
        screen: session?.screen,
        showtime: session?.time,
        seats: valid,
        total,
        currency: selectedCinema.currency || "AED",
        tint: movie?.tint,
        posterUrl: movie?.posterUrl,
        ticketQuantity: valid.length,
        checkoutId: `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      };
      setTicketQuantity(valid.length);
      pendingOrderRef.current = order;
      setPendingOrder(order);
      showStage({ ...current, view: "checkout", order, movie, session });
      resetClarificationFailures();
    }
    return { valid, total };
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
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    };
    appendBooking(completed);
    setBookings(readBookings());
    bookingRef.current = completed;
    pendingOrderRef.current = null;
    setBooking(completed);
    setPendingOrder(null);
    showStage({ view: "booking", booking: completed });
    say("system", t("app.paymentConfirmed", { method: label, ref }));
    resetClarificationFailures();
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`Payment completed via ${label}. Booking confirmed with reference ${ref} for ${order.movieTitle}, seats ${order.seats.join(", ")}, total AED ${order.total}. Tell the guest their booking reference.`);
    }
  };

  /* ========================================================================
   * CLIENT TOOLS — the six original names stay unchanged. show_seat_map is
   * non-blocking and select_seats remains the only voice seat-confirmation
   * path. Phase C and D append show_offers and handover_to_agent.
   * ====================================================================== */
  const clientTools = {
    show_movie_selection: async ({ cinemaId, cinemaName } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      const requested = resolveCinema(cinemaId) || resolveCinema(cinemaName);
      const target = requested || cinemaRef.current;
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
      if (target.id !== cinemaRef.current?.id) {
        cinemaRef.current = target;
        setCinema(target);
      }
      const requestedDate = scheduleDateRef.current;
      const movies = await ensureFilms(target.id, requestedDate);
      if (cinemaRef.current?.id !== target.id || scheduleDateRef.current !== requestedDate) {
        return JSON.stringify({ shown: false, reason: "The guest selected a different VOX Cinemas UAE location while movies were loading." });
      }
      showStage({ view: "movies", movies });
      resetClarificationFailures();
      return JSON.stringify({
        shown: "movie list",
        cinema: { id: target.id, name: target.name },
        selectedDate: requestedDate,
        availableDates: PROGRAMMING_DATES,
        movies: movies.map((movie) => ({ id: movie.id, title: movie.title, rating: movie.rating })),
      });
    },

    show_showtimes: async ({ movieId, movieTitle } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      if (!cinemaRef.current) {
        showStage({ view: "cinemas" });
        return JSON.stringify({ shown: false, reason: "A VOX Cinemas UAE location must be selected first. The cinema picker is displayed." });
      }
      const cinemaId = cinemaRef.current.id;
      const requestedDate = scheduleDateRef.current;
      await ensureFilms(cinemaId, requestedDate);
      if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return JSON.stringify({ shown: false, reason: "The cinema or date changed while showtimes were loading." });
      const hasRequestedMovie = Boolean(movieId || movieTitle);
      const movie = resolveFilm(movieId) || resolveFilm(movieTitle) || (!hasRequestedMovie ? filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle || movieId}. Ask the guest to choose a title from the displayed movie list.` });
      const sessions = await vista.getSessions(cinemaId, movie.id, requestedDate);
      if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return JSON.stringify({ shown: false, reason: "The cinema or date changed while showtimes were loading." });
      sessionsRef.current = sessions;
      sessionsFilmRef.current = movie.id;
      showStage({ view: "showtimes", movie, sessions });
      resetClarificationFailures();
      return JSON.stringify({
        movie: movie.title,
        cinema: cinemaRef.current.name,
        date: requestedDate,
        showtimes: sessions.map((session) => ({ sessionId: session.sessionId, time: session.time, experience: session.exp, seatsAvailable: session.seatsAvailable })),
      });
    },

    show_seat_map: async ({ movieTitle, sessionId, showtime, ticketQuantity: requestedQuantity } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      if (!cinemaRef.current) {
        showStage({ view: "cinemas" });
        return JSON.stringify({ shown: false, reason: "A VOX Cinemas UAE location must be selected first. The cinema picker is displayed." });
      }
      const cinemaId = cinemaRef.current.id;
      const requestedDate = scheduleDateRef.current;
      await ensureFilms(cinemaId, requestedDate);
      if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return JSON.stringify({ shown: false, reason: "The cinema or date changed while the seat map was loading." });
      const current = stageRef.current;
      const resolvedMovie = resolveFilm(movieTitle);
      const movie = resolvedMovie || (!movieTitle ? current.movie || filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle}. Ask the guest to choose a title from the displayed movie list.` });
      let sessions = sessionsRef.current;
      if (!sessions.length || sessionsFilmRef.current !== movie?.id) {
        sessions = movie ? await vista.getSessions(cinemaId, movie.id, requestedDate) : [];
        if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return JSON.stringify({ shown: false, reason: "The cinema or date changed while the seat map was loading." });
        sessionsRef.current = sessions;
        sessionsFilmRef.current = movie?.id || "";
      }
      const session = resolveSession(sessions, sessionId, showtime) || { sessionId, time: showtime, exp: "", screen: "" };
      const plan = await vista.getSeatPlan(cinemaId, session.sessionId);
      if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return JSON.stringify({ shown: false, reason: "The cinema or date changed while the seat map was loading." });
      setSelectedSeats([]);
      seatsRef.current = [];
      setTicketQuantity(Math.max(1, Math.min(10, Number(requestedQuantity) || 1)));
      planRef.current = plan;
      planContextRef.current = { cinemaId, sessionId: session.sessionId };
      showStage({ view: "seatmap", movie, session, plan });
      resetClarificationFailures();
      const available = plan.flatMap((row) => row.seats).filter((seat) => seat.status === 0).map((seat) => seat.id);
      return JSON.stringify({
        shown: "seat map",
        availableSeats: available,
        instruction: "Ask the guest which seats they'd like. When they answer, call select_seats with those seat labels. They may also tap the map.",
      });
    },

    select_seats: ({ seats } = {}) => {
      const ids = (Array.isArray(seats) ? seats : String(seats || "").split(/[,\s]+/))
        .map((value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean);
      const result = finalizeSeats(ids);
      if (!result.valid.length) {
        return JSON.stringify({ confirmed: false, reason: "None of those seats are available. Ask the guest to choose from the available seats shown on the map." });
      }
      const dropped = ids.filter((id) => !result.valid.includes(id));
      return JSON.stringify({
        confirmed: true,
        seats: result.valid,
        total: result.total,
        currency: "AED",
        next: "Checkout is displayed. Ask the guest to complete payment on screen. Do not ask for card details by voice.",
        note: dropped.length ? `Unavailable and skipped: ${dropped.join(", ")}` : undefined,
      });
    },

    show_booking_summary: ({ movieTitle, screen, showtime, seats, ref, total } = {}) => {
      dismissPendingCancellation("booking_summary");
      clearPendingOrder();
      const stored = findBooking(ref);
      const film = resolveFilm(movieTitle || stored?.movieTitle);
      const seatArr = Array.isArray(seats)
        ? seats
        : seats ? String(seats).split(/[,\s]+/).filter(Boolean) : [];
      const displayed = stored || {
        movieTitle,
        screen,
        showtime,
        seats: seatArr,
        ref,
        total,
        currency: "AED",
        cancelled: false,
        tint: film?.tint || stageRef.current.movie?.tint,
      };
      const withTint = { ...displayed, tint: displayed.tint || film?.tint || stageRef.current.movie?.tint };
      bookingRef.current = withTint;
      setBooking(withTint);
      showStage({ view: "booking", booking: withTint });
      resetClarificationFailures();
      return `Booking ${withTint.ref} displayed to the customer${withTint.cancelled ? " (cancelled)" : ""}.`;
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
        total: found.total ?? found.refundAmount,
        tint: found.tint || resolveFilm(found.movieTitle)?.tint,
        cancelled: Boolean(found.cancelled),
      };
      bookingRef.current = displayed;
      setBooking(displayed);
      showStage({ view: "booking", booking: displayed });
      resetClarificationFailures();
      if (displayed.cancelled) {
        return JSON.stringify({ confirmed: false, alreadyCancelled: true, bookingRef: displayed.ref });
      }
      return await new Promise((resolve) => {
        cancelResolver.current = resolve;
        cancelTimerRef.current = window.setTimeout(() => dismissPendingCancellation("confirmation_timeout"), 90_000);
      });
    },

    show_offers: async ({ bankName = "", cardName = "", experience = "" } = {}) => {
      dismissPendingCancellation("offers_opened");
      const current = stageRef.current;
      const activeBooking = bookingRef.current;
      const order = pendingOrderRef.current;
      const selectedExperience = experience || current.session?.exp || current.order?.experience || order?.experience || activeBooking?.experience || "";
      const query = [bankName, cardName].filter(Boolean).join(" ").trim();
      const context = {
        cinemaId: cinemaRef.current?.id,
        cinemaName: cinemaRef.current?.name,
        experience: selectedExperience,
        ticketCount: order?.seats?.length || seatsRef.current.length || undefined,
        orderTotal: order?.total,
        channel: "web",
      };
      const result = query && selectedExperience
        ? cardName
          ? resolveOfferForBankAndCard(bankName, cardName, context)
          : resolveOffer(bankName || query, context)
        : null;
      lastOfferRef.current = result;
      const toolLocale = localeRef.current;
      const disclaimer = OFFER_META.disclaimer[toolLocale] || OFFER_META.disclaimer.en;
      offersReturnRef.current = current.view === "offers" ? { view: "empty" } : current;
      showStage({ view: "offers", query, context, result, showtimeRequired: !selectedExperience });
      resetClarificationFailures();
      if (!selectedExperience) {
        return JSON.stringify({ shown: "offers", eligibility: "showtime_required", reason: toolLocale === "ar" ? "اختر موعد العرض أو حدّد تجربة السينما أولاً." : "Select a showtime or provide an experience before checking eligibility.", disclaimer });
      }
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
          ? { sessionId: currentOrder.sessionId, date: currentOrder.date, time: currentOrder.showtime, experience: currentOrder.experience, screen: currentOrder.screen }
          : handoverBooking
            ? { sessionId: handoverBooking.sessionId, date: handoverBooking.date, time: handoverBooking.showtime, experience: handoverBooking.experience, screen: handoverBooking.screen }
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

  const clearConversationState = useCallback((reason = "reset") => {
    dismissPendingCancellation(reason);
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
    setTicketQuantity(null);
    scheduleDateRef.current = vista.demoDate();
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
    lastActivityRef.current = Date.now();
  }, []);

  /* ========================================================================
   * REAL ELEVENLABS CONNECTION — do not change the connection type, location,
   * or client-tool names. The agent uses the public VITE_AGENT_ID identifier.
   * ====================================================================== */
  const conversation = useConversation({
    clientTools,
    serverLocation: "eu-residency",
    onConnect: () => {
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
        setStartingMode(null);
        const reason = disconnectReasonRef.current;
        const suppressNotice = suppressDisconnectNoticeRef.current;
        disconnectReasonRef.current = "ended";
        suppressDisconnectNoticeRef.current = false;
        clearConversationState(reason);
        if (!suppressNotice) say("system", t(reason === "timeout" ? "app.timeoutMessage" : "app.disconnectedMessage"));
      }
    },
    onMessage: (message) => {
      if (!message?.message) return;
      const role = message.source === "user" ? "user" : "agent";
      if (role === "user") {
        const faq = prepareFaqContext(message.message);
        if (!faq.matches.length) updateIntentFromText(message.message);
      }
      const languageSignal = resolveLanguageSignal({
        role,
        text: message.message,
        currentLocale: localeRef.current,
        pendingLocale: pendingLanguageSwitchRef.current,
      });
      pendingLanguageSwitchRef.current = languageSignal.pendingLocale;
      if (languageSignal.nextLocale && languageSignal.nextLocale !== localeRef.current) {
        localeRef.current = languageSignal.nextLocale;
        setLocale(languageSignal.nextLocale);
      }
      if (role === "agent" && isAgentWelcome(message.message)) {
        const pendingTyped = pendingTypedMessagesRef.current.at(-1) || lastSentTextRef.current;
        const hasRecentTypedMessage = pendingTyped && Date.now() - pendingTyped.at < 15000;
        if (pendingTyped && !hasRecentTypedMessage) lastSentTextRef.current = null;
        if (!hasDisplayedWelcomeRef.current && !continuationSessionRef.current && !hasRecentTypedMessage) {
          const displayedWelcome = /\bvox concierge\b/i.test(message.message)
            ? VOXI_FIRST_MESSAGES[localeRef.current]
            : message.message;
          say("agent", displayedWelcome);
        }
        hasDisplayedWelcomeRef.current = true;
        return;
      }
      const sentIndex = role === "user"
        ? pendingTypedMessagesRef.current.findIndex((sent) => sent.text === message.message && Date.now() - sent.at < 15000)
        : -1;
      const isTypedEcho = sentIndex >= 0;
      if (isTypedEcho) {
        pendingTypedMessagesRef.current.splice(sentIndex, 1);
        lastSentTextRef.current = pendingTypedMessagesRef.current.at(-1) || null;
      }
      else say(role, message.message);
    },
    onError: (error) => {
      console.error("Conversation error", error);
      say("system", t("app.connectionError"));
    },
  });

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
    const onLogout = () => { restartConversation("logout"); };
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

  const startTextSession = useCallback(async () => {
    if (sessionModeRef.current) return true;
    const activeStart = sessionStartRef.current;
    if (activeStart) {
      await activeStart.promise;
      if (sessionModeRef.current) return true;
    }

    requestedSessionModeRef.current = "text";
    continuationSessionRef.current = hasStartedConversationRef.current;
    setStartingMode("text");
    const start = (async () => {
      try {
        const activeLocale = localeRef.current;
        const continuation = continuationSessionRef.current;
        const previousTransportId = transportConversationIdRef.current;
        const handoffJourney = { ...journeyRef.current, locale: activeLocale, transportConversationId: previousTransportId };
        const startedConversationId = await withStartTimeout(conversation.startSession({
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
        }));
        hasStartedConversationRef.current = true;
        const nextTransportId = startedConversationId || conversation.getId?.() || null;
        transportConversationIdRef.current = nextTransportId;
        journeyRef.current = syncJourney(handoffJourney, { transportConversationId: nextTransportId, previousTransportConversationId: previousTransportId });
        dispatchJourney({ type: "sync", payload: { transportConversationId: nextTransportId, previousTransportConversationId: previousTransportId } });
        conversation.sendContextualUpdate?.(`${VOXI_AGENT_PROMPT}\n\n${buildVoxiContext({
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: scheduleDateRef.current,
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
          journey: journeyRef.current,
          messages: messagesRef.current,
        })}${continuation ? `\n\n${buildTransportHandoff(handoffJourney, messagesRef.current)}` : ""}\n\n${serializeFaqContext(VOX_FAQ_ENTRIES, { locale: activeLocale, maxChars: 14_000 })}`);
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
  }, [conversation, say, t]);

  const startVoiceSession = useCallback(async () => {
    if (sessionModeRef.current === "voice") return;
    const activeStart = sessionStartRef.current;
    if (activeStart) await activeStart.promise;
    if (sessionModeRef.current === "voice") return;

    const previousMode = sessionModeRef.current;
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
        if (sessionModeRef.current) {
          switchingSessionRef.current = true;
          await conversation.endSession();
          endedPreviousSession = true;
        }
        requestedSessionModeRef.current = "voice";
        continuationSessionRef.current = hasStartedConversationRef.current;
        const activeLocale = localeRef.current;
        const continuation = continuationSessionRef.current;
        const previousTransportId = transportConversationIdRef.current;
        const handoffJourney = { ...journeyRef.current, locale: activeLocale, transportConversationId: previousTransportId };
        const startedConversationId = await withStartTimeout(conversation.startSession({
          agentId: import.meta.env.VITE_AGENT_ID,
          connectionType: "webrtc",
          textOnly: false,
          dynamicVariables: {
            ...journeyDynamicVariables(handoffJourney, { continuation }),
            voxi_session_opening: continuation
              ? (activeLocale === "ar" ? "نكمل من حيث توقفنا في طلبك الحالي." : "Let’s continue from your current booking or enquiry step.")
              : VOXI_FIRST_MESSAGES[activeLocale],
          },
        }));
        hasStartedConversationRef.current = true;
        const nextTransportId = startedConversationId || conversation.getId?.() || null;
        transportConversationIdRef.current = nextTransportId;
        journeyRef.current = syncJourney(handoffJourney, { transportConversationId: nextTransportId, previousTransportConversationId: previousTransportId });
        dispatchJourney({ type: "sync", payload: { transportConversationId: nextTransportId, previousTransportConversationId: previousTransportId } });
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
  }, [conversation, say, t]);

  const endVoiceSession = useCallback(async () => {
    disconnectReasonRef.current = "ended";
    switchingSessionRef.current = false;
    await conversation.endSession();
  }, [conversation]);

  const sendText = useCallback(async (text) => {
    const value = (text ?? input).trim();
    if (!value) return;
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
    const faq = prepareFaqContext(value);
    if (!faq.matches.length) updateIntentFromText(value);
    say("user", value);
    setInput("");
    lastSentTextRef.current = { text: value, at: Date.now() };
    pendingTypedMessagesRef.current.push(lastSentTextRef.current);
    pendingTypedMessagesRef.current = pendingTypedMessagesRef.current.filter((item) => Date.now() - item.at < 30_000).slice(-10);
    const transition = sessionStartRef.current;
    if (transition) await transition.promise;
    const ready = sessionModeRef.current ? true : await startTextSession();
    if (ready && conversation.sendUserMessage) {
      if (faq.matches.length) conversation.sendContextualUpdate?.(`${faq.context}\nThe guest's current question is: ${value}. Answer from this approved context, use live data only when supplied, and do not restart the conversation.`);
      conversation.sendUserMessage(value);
    }
    else {
      pendingTypedMessagesRef.current = pendingTypedMessagesRef.current.filter((item) => item.text !== value);
      lastSentTextRef.current = pendingTypedMessagesRef.current.at(-1) || null;
    }
  }, [conversation, input, prepareFaqContext, say, setLocale, startTextSession, updateIntentFromText]);

  const pickMovie = async (movie) => {
    const cinemaId = cinemaRef.current?.id;
    if (!cinemaId) {
      showStage({ view: "cinemas" });
      return;
    }
    dismissPendingCancellation("movie_selected");
    clearPendingOrder();
    resetClarificationFailures();
    say("user", movie.title);
    const requestedDate = scheduleDateRef.current;
    const sessions = await vista.getSessions(cinemaId, movie.id, requestedDate);
    if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return;
    sessionsRef.current = sessions;
    sessionsFilmRef.current = movie.id;
    showStage({ view: "showtimes", movie, sessions });
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected ${movie.title}. Showtimes are displayed.`);
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
    say("user", `${session.time} ${session.exp}`);
    const requestedDate = scheduleDateRef.current;
    const plan = await vista.getSeatPlan(cinemaId, session.sessionId);
    if (cinemaRef.current?.id !== cinemaId || scheduleDateRef.current !== requestedDate) return;
    planRef.current = plan;
    planContextRef.current = { cinemaId, sessionId: session.sessionId };
    seatsRef.current = [];
    setSelectedSeats([]);
    setTicketQuantity(1);
    showStage({ view: "seatmap", movie, session, plan });
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected the ${session.time} ${session.exp} session. The seat map is displayed.`);
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
      showStage(cinemaReturnRef.current || stageRef.current);
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
    setTicketQuantity(null);
    const requestedDate = scheduleDateRef.current;
    const movies = await ensureFilms(nextCinema.id, requestedDate);
    if (cinemaRef.current?.id !== nextCinema.id || scheduleDateRef.current !== requestedDate) return;
    showStage({ view: "movies", movies });
    say("system", t("app.cinemaChanged", { cinema: stripVox(nextCinema.name) }));
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected ${nextCinema.name}. Continue using that cinema.`);
  };

  const chooseDate = async (nextDate) => {
    if (!PROGRAMMING_DATES.includes(nextDate) || nextDate === scheduleDateRef.current) return;
    dismissPendingCancellation("date_changed");
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
    setTicketQuantity(null);
    const selectedCinema = cinemaRef.current;
    if (!selectedCinema) {
      showStage({ view: "cinemas" });
      return;
    }
    showStage({ view: "loading", label: t("app.loadingMovies") });
    const movies = await ensureFilms(selectedCinema.id, nextDate);
    if (cinemaRef.current?.id !== selectedCinema.id || scheduleDateRef.current !== nextDate) return;
    showStage({ view: "movies", movies });
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`The guest selected ${nextDate}. Movie results now use that date; keep the selected cinema and do not ask for the date again.`);
    }
  };

  const openHistory = () => {
    dismissPendingCancellation("history_opened");
    if (stageRef.current.view === "history") {
      showStage(historyReturnRef.current || { view: "empty" });
      return;
    }
    historyReturnRef.current = stageRef.current;
    setBookings(readBookings());
    showStage({ view: "history" });
  };

  const openOffers = () => {
    if (stageRef.current.view === "offers") {
      showStage(offersReturnRef.current || { view: "empty" });
      return;
    }
    clientTools.show_offers({ experience: stageRef.current.session?.exp || pendingOrderRef.current?.experience || bookingRef.current?.experience || "" });
  };

  const selectHistoryBooking = (selected) => {
    clearPendingOrder();
    bookingRef.current = selected;
    setBooking(selected);
    showStage({ view: "booking", booking: selected });
  };

  const toggleSeat = (seat) => {
    resetClarificationFailures();
    setSelectedSeats((current) => {
      const next = current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id];
      seatsRef.current = next;
      if (next.length > (ticketQuantity || 1)) setTicketQuantity(Math.min(10, next.length));
      return next;
    });
  };

  const confirmSeats = (seats) => {
    const result = finalizeSeats(seats);
    if (!result.valid.length) return;
    say("user", `Confirm seats ${result.valid.join(", ")}`);
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`The guest confirmed seats ${result.valid.join(", ")}. Checkout is displayed; never ask for payment details by voice.`);
    }
  };

  const cancelBooking = () => {
    const current = bookingRef.current;
    if (!current || current.cancelled) return;
    const cancelledAt = new Date().toISOString();
    let updated = markCancelled(current.ref, cancelledAt);
    if (!updated) {
      updated = { ...current, cancelled: true, cancelledAt };
      appendBooking(updated);
    }
    updated = { ...current, ...updated, cancelled: true, cancelledAt: updated.cancelledAt || cancelledAt };
    bookingRef.current = updated;
    setBooking(updated);
    setBookings(readBookings());
    showStage({ view: "booking", booking: updated });
    if (cancelResolver.current) {
      window.clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
      const resolver = cancelResolver.current;
      cancelResolver.current = null;
      resolver(JSON.stringify({ confirmed: true, bookingRef: updated.ref, cancelledAt: updated.cancelledAt }));
    }
    say("user", t("app.cancelConfirmed"));
    resetClarificationFailures();
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
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, stage]);

  const chips = [t("app.chipShowing"), t("app.chipBook"), t("app.chipCancel")];
  const statusLabel = startingMode
    ? t("app.connectingMode", { mode: t(startingMode === "text" ? "app.textMode" : "app.voiceMode") })
    : status === "connected"
      ? t(sessionMode === "text" ? "app.textMode" : "app.voiceMode")
      : t("app.disconnected");
  const displayedBooking = stage.booking || booking;

  return (
    <div lang={locale} dir={dir} style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
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
          {cinema && ["movies", "showtimes"].includes(stage.view) && <DateStrip dates={PROGRAMMING_DATES} selected={scheduleDate} locale={locale} label={t("dates.label")} onSelect={chooseDate} />}
          {stage.view === "loading" && <LoadingPanel label={stage.label} />}
          {stage.view === "faq" && stage.faq && <FaqPanel result={stage.faq} label={t("faq.official")} liveLabel={t("faq.live")} />}
          {stage.view === "cinemas" && <CinemaPicker cinemas={CINEMAS} selected={cinema} onSelect={chooseCinema} onBack={() => showStage(cinemaReturnRef.current || { view: "empty" })} />}
          {stage.view === "movies" && cinema && <MovieGrid movies={stage.movies} cinemaName={stripVox(cinema.name)} scheduleDate={scheduleDate} onSelect={pickMovie} />}
          {stage.view === "showtimes" && <Showtimes movie={stage.movie} sessions={stage.sessions} onSelect={pickSession} onBack={() => clientTools.show_movie_selection()} />}
          {stage.view === "seatmap" && (
            <div>
              <TicketQuantityControl value={ticketQuantity || Math.max(selectedSeats.length, 1)} label={t("tickets.quantity")} decreaseLabel={t("tickets.decrease")} increaseLabel={t("tickets.increase")} onChange={(value) => {
                setTicketQuantity(value);
                if (selectedSeats.length > value) {
                  const next = selectedSeats.slice(0, value);
                  seatsRef.current = next;
                  setSelectedSeats(next);
                }
              }} />
              <SeatMap movie={stage.movie} session={stage.session} plan={stage.plan} selected={selectedSeats} onToggle={toggleSeat} onConfirm={confirmSeats} onBack={() => clientTools.show_showtimes({ movieId: stage.movie.id, movieTitle: stage.movie.title })} />
            </div>
          )}
          {stage.view === "checkout" && stage.order && <Checkout key={stage.order.checkoutId} order={stage.order} onPaid={handlePaid} onCancel={() => { clearPendingOrder(); showStage({ view: "seatmap", movie: stage.movie, session: stage.session, plan: planRef.current }); }} />}
          {stage.view === "booking" && displayedBooking && <BookingCard booking={displayedBooking} onCancel={cancelBooking} onDecline={() => dismissPendingCancellation("guest_declined")} cancelled={displayedBooking.cancelled} />}
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
                onSelectionChange={(result) => { lastOfferRef.current = result; }}
                onBack={() => showStage(offersReturnRef.current || { view: "empty" })}
              />
            </div>
          )}
          {stage.view === "handover" && <HandoverPanel payload={stage.payload} labels={{
            connectingTitle: t("handover.connecting"),
            connectingBody: t("handover.connectingBody"),
            readyTitle: t("handover.ready"),
            readyBody: t("handover.readyBody"),
            simulation: t("handover.prototype"),
            debugTitle: t("handover.payload"),
            debugHint: t("handover.debugHint"),
            summaryStep: t("handover.summaryStep"),
            queueReadyStep: t("handover.queueStep"),
            connectingStep: t("app.connecting"),
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

function FaqPanel({ result, label, liveLabel }) {
  const source = result.metadata?.source?.[0];
  return (
    <article style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, background: "linear-gradient(145deg, rgba(99,65,141,.25), rgba(30,23,40,.62))", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.lavender, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .6 }}><Sparkles size={14} />{label}</div>
      <p dir="auto" style={{ margin: "11px 0 0", color: "rgba(255,255,255,.86)", fontSize: 13, lineHeight: 1.55 }}>{result.answer}</p>
      {result.needsLiveData && <p style={{ margin: "9px 0 0", color: "rgba(255,255,255,.48)", fontSize: 10, lineHeight: 1.45 }}>{liveLabel}</p>}
      {source?.url && <a href={source.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: C.lavender, fontSize: 10 }}>{source.title}</a>}
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
