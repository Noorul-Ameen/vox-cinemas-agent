import React, { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { BadgePercent, History, MapPin, Mic, MicOff, Send, Sparkles } from "lucide-react";
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
import { VOXI_AGENT_PROMPT, VOXI_FIRST_MESSAGES, buildVoxiContext } from "./lib/voxiSession.js";
import { OFFER_META } from "./offers/offersData.js";
import { resolveOffer, resolveOfferForBankAndCard } from "./offers/offerResolver.js";
import * as vista from "./vistaClient.js";

const CINEMAS = vista.getCinemas();
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

  // Blocking cancellation tool state. Seat selection remains deliberately
  // non-blocking so both voice and touch can continue to use select_seats.
  const cancelResolver = useRef(null);

  // Voice-resolution caches and non-recursive return-navigation snapshots.
  const filmsRef = useRef([]);
  const filmsCinemaRef = useRef("");
  const filmRequestsRef = useRef(new Map());
  const sessionsRef = useRef([]);
  const sessionsFilmRef = useRef("");
  const planRef = useRef([]);
  const cinemaReturnRef = useRef(null);
  const historyReturnRef = useRef(null);
  const offersReturnRef = useRef(null);

  // Current-value refs make client-tool calls deterministic even when the SDK
  // invokes a handler between React renders.
  const stageRef = useRef(stage);
  const cinemaRef = useRef(cinema);
  const bookingRef = useRef(booking);
  const pendingOrderRef = useRef(pendingOrder);
  const seatsRef = useRef(selectedSeats);
  const messagesRef = useRef(messages);
  const localeRef = useRef(locale);
  const lastOfferRef = useRef(null);
  const clarificationFailuresRef = useRef(0);
  const clarificationFailureLogRef = useRef([]);
  const conversationIdRef = useRef(newConversationId());
  const sessionModeRef = useRef(null);
  const requestedSessionModeRef = useRef(null);
  const sessionStartRef = useRef(null);
  const switchingSessionRef = useRef(false);
  const lastSentTextRef = useRef(null);
  const hasStartedConversationRef = useRef(false);
  const hasDisplayedWelcomeRef = useRef(false);
  const continuationSessionRef = useRef(false);
  const pendingLanguageSwitchRef = useRef(null);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { cinemaRef.current = cinema; }, [cinema]);
  useEffect(() => { bookingRef.current = booking; }, [booking]);
  useEffect(() => { pendingOrderRef.current = pendingOrder; }, [pendingOrder]);
  useEffect(() => { seatsRef.current = selectedSeats; }, [selectedSeats]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  const say = useCallback((role, text) => {
    setMessages((current) => [...current, { role, text, at: new Date().toISOString() }]);
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

  const ensureFilms = useCallback(async (cinemaId = cinemaRef.current?.id) => {
    if (!cinemaId) return [];
    if (filmsRef.current.length && filmsCinemaRef.current === cinemaId) return filmsRef.current;
    let request = filmRequestsRef.current.get(cinemaId);
    if (!request) {
      request = vista.getScheduledFilms(cinemaId);
      filmRequestsRef.current.set(cinemaId, request);
    }
    try {
      const movies = await request;
      if (cinemaRef.current?.id === cinemaId) {
        filmsRef.current = movies;
        filmsCinemaRef.current = cinemaId;
        sessionsRef.current = [];
        sessionsFilmRef.current = "";
      }
      return movies;
    } finally {
      if (filmRequestsRef.current.get(cinemaId) === request) filmRequestsRef.current.delete(cinemaId);
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
    const resolver = cancelResolver.current;
    cancelResolver.current = null;
    resolver(JSON.stringify({ confirmed: false, reason }));
  };

  const clearPendingOrder = () => {
    pendingOrderRef.current = null;
    setPendingOrder(null);
  };

  useEffect(() => {
    filmsRef.current = [];
    filmsCinemaRef.current = "";
    sessionsRef.current = [];
    sessionsFilmRef.current = "";
    if (cinema?.id) ensureFilms(cinema.id).catch(() => {});
  }, [cinema?.id, ensureFilms]);

  useEffect(() => () => dismissPendingCancellation("widget_unmounted"), []);

  const finalizeSeats = (seatIds) => {
    const plan = planRef.current || [];
    const all = plan.flatMap((row) => row.seats);
    const requested = [...new Set((seatIds || []).map((id) => String(id).toUpperCase()))];
    const valid = requested.filter((id) => all.some((seat) => seat.id === id && seat.status === 0));
    const price = (premium) => (premium ? 63 : 42);
    const total = valid.reduce((sum, id) => {
      const seat = all.find((item) => item.id === id);
      return sum + (seat ? price(seat.premium) : 0);
    }, 0);
    const current = stageRef.current;
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
        date: session?.date || vista.demoDate(),
        experience: session?.exp,
        screen: session?.screen,
        showtime: session?.time,
        seats: valid,
        total,
        currency: selectedCinema.currency || "AED",
        tint: movie?.tint,
        checkoutId: `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      };
      pendingOrderRef.current = order;
      setPendingOrder(order);
      setStage({ ...current, view: "checkout", order, movie, session });
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
    setStage({ view: "booking", booking: completed });
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
        setStage({ view: "cinemas" });
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
      const movies = await ensureFilms(target.id);
      if (cinemaRef.current?.id !== target.id) {
        return JSON.stringify({ shown: false, reason: "The guest selected a different VOX Cinemas UAE location while movies were loading." });
      }
      setStage({ view: "movies", movies });
      resetClarificationFailures();
      return JSON.stringify({
        shown: "movie list",
        cinema: { id: target.id, name: target.name },
        movies: movies.map((movie) => ({ id: movie.id, title: movie.title, rating: movie.rating })),
      });
    },

    show_showtimes: async ({ movieId, movieTitle } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      if (!cinemaRef.current) {
        setStage({ view: "cinemas" });
        return JSON.stringify({ shown: false, reason: "A VOX Cinemas UAE location must be selected first. The cinema picker is displayed." });
      }
      const cinemaId = cinemaRef.current.id;
      await ensureFilms(cinemaId);
      if (cinemaRef.current?.id !== cinemaId) return JSON.stringify({ shown: false, reason: "The cinema changed while showtimes were loading." });
      const hasRequestedMovie = Boolean(movieId || movieTitle);
      const movie = resolveFilm(movieId) || resolveFilm(movieTitle) || (!hasRequestedMovie ? filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle || movieId}. Ask the guest to choose a title from the displayed movie list.` });
      const sessions = await vista.getSessions(cinemaId, movie.id);
      if (cinemaRef.current?.id !== cinemaId) return JSON.stringify({ shown: false, reason: "The cinema changed while showtimes were loading." });
      sessionsRef.current = sessions;
      sessionsFilmRef.current = movie.id;
      setStage({ view: "showtimes", movie, sessions });
      resetClarificationFailures();
      return JSON.stringify({
        movie: movie.title,
        cinema: cinemaRef.current.name,
        showtimes: sessions.map((session) => ({ sessionId: session.sessionId, time: session.time, experience: session.exp, seatsAvailable: session.seatsAvailable })),
      });
    },

    show_seat_map: async ({ movieTitle, sessionId, showtime } = {}) => {
      dismissPendingCancellation("new_journey");
      clearPendingOrder();
      if (!cinemaRef.current) {
        setStage({ view: "cinemas" });
        return JSON.stringify({ shown: false, reason: "A VOX Cinemas UAE location must be selected first. The cinema picker is displayed." });
      }
      const cinemaId = cinemaRef.current.id;
      await ensureFilms(cinemaId);
      if (cinemaRef.current?.id !== cinemaId) return JSON.stringify({ shown: false, reason: "The cinema changed while the seat map was loading." });
      const current = stageRef.current;
      const resolvedMovie = resolveFilm(movieTitle);
      const movie = resolvedMovie || (!movieTitle ? current.movie || filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle}. Ask the guest to choose a title from the displayed movie list.` });
      let sessions = sessionsRef.current;
      if (!sessions.length || sessionsFilmRef.current !== movie?.id) {
        sessions = movie ? await vista.getSessions(cinemaId, movie.id) : [];
        if (cinemaRef.current?.id !== cinemaId) return JSON.stringify({ shown: false, reason: "The cinema changed while the seat map was loading." });
        sessionsRef.current = sessions;
        sessionsFilmRef.current = movie?.id || "";
      }
      const session = resolveSession(sessions, sessionId, showtime) || { sessionId, time: showtime, exp: "", screen: "" };
      const plan = await vista.getSeatPlan(cinemaId, session.sessionId);
      if (cinemaRef.current?.id !== cinemaId) return JSON.stringify({ shown: false, reason: "The cinema changed while the seat map was loading." });
      setSelectedSeats([]);
      seatsRef.current = [];
      planRef.current = plan;
      setStage({ view: "seatmap", movie, session, plan });
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
      setStage({ view: "booking", booking: withTint });
      resetClarificationFailures();
      return `Booking ${withTint.ref} displayed to the customer${withTint.cancelled ? " (cancelled)" : ""}.`;
    },

    show_booking_for_cancellation: async ({ bookingRef: requestedRef } = {}) => {
      dismissPendingCancellation("replaced");
      clearPendingOrder();
      let found;
      try {
        found = await vista.searchBooking(requestedRef);
      } catch (error) {
        return JSON.stringify({ found: false, bookingRef: requestedRef || null, reason: error?.message || "Booking not found." });
      }
      const displayed = {
        ...found,
        total: found.total ?? found.refundAmount,
        tint: found.tint || resolveFilm(found.movieTitle)?.tint,
        cancelled: Boolean(found.cancelled),
      };
      bookingRef.current = displayed;
      setBooking(displayed);
      setStage({ view: "booking", booking: displayed });
      resetClarificationFailures();
      if (displayed.cancelled) {
        return JSON.stringify({ confirmed: false, alreadyCancelled: true, bookingRef: displayed.ref });
      }
      return await new Promise((resolve) => { cancelResolver.current = resolve; });
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
      setStage({ view: "offers", query, context, result, showtimeRequired: !selectedExperience });
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
      setStage({ view: "handover", payload });
      clarificationFailureLogRef.current = [];
      return JSON.stringify({ handoverStarted: true, mode: "simulated", status: "connecting", schemaVersion: payload.schemaVersion, handoverId: payload.event.handoverId });
    },
  };

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
        say("system", t("app.disconnectedMessage"));
      }
    },
    onMessage: (message) => {
      if (!message?.message) return;
      const role = message.source === "user" ? "user" : "agent";
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
        const pendingTyped = lastSentTextRef.current;
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
      const sent = lastSentTextRef.current;
      const isTypedEcho = role === "user" && sent && sent.text === message.message && Date.now() - sent.at < 15000;
      if (isTypedEcho) lastSentTextRef.current = null;
      else say(role, message.message);
    },
    onError: (error) => {
      console.error("Conversation error", error);
      say("system", t("app.connectionError"));
    },
  });

  const status = conversation.status;
  const isConnected = status === "connected";

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
        await conversation.startSession({
          agentId: import.meta.env.VITE_AGENT_ID,
          connectionType: "websocket",
          textOnly: true,
          overrides: {
            conversation: { textOnly: true },
          },
          dynamicVariables: {
            preferred_language: activeLocale === "ar" ? "Arabic" : "English",
          },
        });
        hasStartedConversationRef.current = true;
        conversationIdRef.current = conversation.getId?.() || conversationIdRef.current;
        conversation.sendContextualUpdate?.(`${VOXI_AGENT_PROMPT}\n\n${buildVoxiContext({
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: vista.demoDate(),
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
        })}`);
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
        await conversation.startSession({
          agentId: import.meta.env.VITE_AGENT_ID,
          connectionType: "webrtc",
          textOnly: false,
          dynamicVariables: {
            preferred_language: activeLocale === "ar" ? "Arabic" : "English",
          },
        });
        hasStartedConversationRef.current = true;
        conversationIdRef.current = conversation.getId?.() || conversationIdRef.current;
        conversation.sendContextualUpdate?.(`${VOXI_AGENT_PROMPT}\n\n${buildVoxiContext({
          locale: activeLocale,
          cinema: cinemaRef.current,
          scheduleDate: vista.demoDate(),
          stage: stageRef.current,
          selectedSeats: seatsRef.current,
        })}`);
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
    say("user", value);
    setInput("");
    lastSentTextRef.current = { text: value, at: Date.now() };
    const transition = sessionStartRef.current;
    if (transition) await transition.promise;
    const ready = sessionModeRef.current ? true : await startTextSession();
    if (ready && conversation.sendUserMessage) conversation.sendUserMessage(value);
    else lastSentTextRef.current = null;
  }, [conversation, input, say, setLocale, startTextSession]);

  const pickMovie = async (movie) => {
    const cinemaId = cinemaRef.current?.id;
    if (!cinemaId) {
      setStage({ view: "cinemas" });
      return;
    }
    dismissPendingCancellation("movie_selected");
    clearPendingOrder();
    resetClarificationFailures();
    say("user", movie.title);
    const sessions = await vista.getSessions(cinemaId, movie.id);
    if (cinemaRef.current?.id !== cinemaId) return;
    sessionsRef.current = sessions;
    sessionsFilmRef.current = movie.id;
    setStage({ view: "showtimes", movie, sessions });
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected ${movie.title}. Showtimes are displayed.`);
  };

  const pickSession = async (session) => {
    const cinemaId = cinemaRef.current?.id;
    if (!cinemaId) {
      setStage({ view: "cinemas" });
      return;
    }
    dismissPendingCancellation("session_selected");
    clearPendingOrder();
    resetClarificationFailures();
    const movie = stageRef.current.movie;
    say("user", `${session.time} ${session.exp}`);
    const plan = await vista.getSeatPlan(cinemaId, session.sessionId);
    if (cinemaRef.current?.id !== cinemaId) return;
    planRef.current = plan;
    seatsRef.current = [];
    setSelectedSeats([]);
    setStage({ view: "seatmap", movie, session, plan });
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected the ${session.time} ${session.exp} session. The seat map is displayed.`);
  };

  const openCinemaPicker = () => {
    dismissPendingCancellation("cinema_picker_opened");
    cinemaReturnRef.current = stageRef.current.view === "cinemas" ? { view: "empty" } : stageRef.current;
    setStage({ view: "cinemas" });
  };

  const chooseCinema = async (nextCinema) => {
    resetClarificationFailures();
    clearPendingOrder();
    cinemaRef.current = nextCinema;
    setCinema(nextCinema);
    filmsRef.current = [];
    filmsCinemaRef.current = "";
    sessionsRef.current = [];
    sessionsFilmRef.current = "";
    planRef.current = [];
    seatsRef.current = [];
    setSelectedSeats([]);
    const movies = await ensureFilms(nextCinema.id);
    if (cinemaRef.current?.id !== nextCinema.id) return;
    setStage({ view: "movies", movies });
    say("system", t("app.cinemaChanged", { cinema: stripVox(nextCinema.name) }));
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected ${nextCinema.name}. Continue using that cinema.`);
  };

  const openHistory = () => {
    dismissPendingCancellation("history_opened");
    historyReturnRef.current = stageRef.current.view === "history" ? { view: "empty" } : stageRef.current;
    setBookings(readBookings());
    setStage({ view: "history" });
  };

  const openOffers = () => {
    clientTools.show_offers({ experience: stageRef.current.session?.exp || pendingOrderRef.current?.experience || bookingRef.current?.experience || "" });
  };

  const selectHistoryBooking = (selected) => {
    clearPendingOrder();
    bookingRef.current = selected;
    setBooking(selected);
    setStage({ view: "booking", booking: selected });
  };

  const toggleSeat = (seat) => {
    resetClarificationFailures();
    setSelectedSeats((current) => {
      const next = current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id];
      seatsRef.current = next;
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
    setStage({ view: "booking", booking: updated });
    if (cancelResolver.current) {
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
    const next = nextLocale === "ar" ? "Arabic" : "English";
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`The guest explicitly selected ${next}. This visible selector action is confirmed. Preserve the active task and continue in ${next} without repeating the welcome message. ${buildVoxiContext({
        locale: nextLocale,
        cinema: cinemaRef.current,
        scheduleDate: vista.demoDate(),
        stage: stageRef.current,
        selectedSeats: seatsRef.current,
      })}`);
    }
  };

  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

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
              <LanguageSelector locale={locale} label={t("app.language")} onSelect={changeLanguage} />
            <span role="status" aria-live="polite" title={statusLabel} aria-label={statusLabel} style={{ display: "flex", width: 18, height: 28, alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.52)" }}>
              <span style={{ height: 7, width: 7, borderRadius: 999, background: isConnected ? C.green : status === "connecting" ? "#D9A94B" : "#777" }} />
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{statusLabel}</span>
            </span>
          </div>
        </header>

        <main style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", padding: 16, background: `radial-gradient(120% 60% at 50% -10%, ${C.screen}, ${C.ink})` }}>
          {stage.view === "empty" && (
            <div style={{ display: "flex", height: "100%", minHeight: 240, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ display: "flex", height: 56, width: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, background: "rgba(182,24,108,.15)", marginBottom: 16 }}><Sparkles color={C.lavender} size={26} /></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{t("app.emptyTitle")}</div>
              <p style={{ maxWidth: 280, marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.5)" }}>{t("app.emptyBody")}</p>
              {!cinema && <button type="button" onClick={openCinemaPicker} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, border: 0, borderRadius: 999, background: C.magenta, padding: "9px 15px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><MapPin size={14} />{t("app.chooseCinema")}</button>}
            </div>
          )}
          {stage.view === "cinemas" && <CinemaPicker cinemas={CINEMAS} selected={cinema} onSelect={chooseCinema} onBack={() => setStage(cinemaReturnRef.current || { view: "empty" })} />}
          {stage.view === "movies" && cinema && <MovieGrid movies={stage.movies} cinemaName={stripVox(cinema.name)} scheduleDate={vista.demoDate()} onSelect={pickMovie} />}
          {stage.view === "showtimes" && <Showtimes movie={stage.movie} sessions={stage.sessions} onSelect={pickSession} onBack={() => clientTools.show_movie_selection()} />}
          {stage.view === "seatmap" && <SeatMap movie={stage.movie} session={stage.session} plan={stage.plan} selected={selectedSeats} onToggle={toggleSeat} onConfirm={confirmSeats} onBack={() => clientTools.show_showtimes({ movieId: stage.movie.id, movieTitle: stage.movie.title })} />}
          {stage.view === "checkout" && stage.order && <Checkout order={stage.order} onPaid={handlePaid} onCancel={() => { clearPendingOrder(); setStage({ view: "seatmap", movie: stage.movie, session: stage.session, plan: planRef.current }); }} />}
          {stage.view === "booking" && displayedBooking && <BookingCard booking={displayedBooking} onCancel={cancelBooking} cancelled={displayedBooking.cancelled} />}
          {stage.view === "history" && <BookingHistory bookings={bookings} onSelect={selectHistoryBooking} onBack={() => setStage(historyReturnRef.current || { view: "empty" })} />}
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
                onBack={() => setStage(offersReturnRef.current || { view: "empty" })}
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
          <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text" style={{ display: "flex", maxHeight: 200, flexDirection: "column", gap: 10, overflowY: "auto", padding: "12px 16px" }}>
            {!messages.length && <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>{t("app.transcriptHint")}</div>}
            {messages.map((message, index) => (
              <div key={`${message.at}-${index}`} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                <div dir="auto" style={{ maxWidth: "85%", borderRadius: 16, padding: "9px 13px", fontSize: 13, lineHeight: 1.35, overflowWrap: "anywhere", background: message.role === "user" ? C.purple : message.role === "system" ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)", color: message.role === "system" ? "rgba(255,255,255,.5)" : message.role === "user" ? "#fff" : "rgba(255,255,255,.9)", fontStyle: message.role === "system" ? "italic" : "normal" }}>{message.text}</div>
              </div>
            ))}
          </div>
          <div className="voxi-chip-row" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 16px 8px", scrollbarWidth: "none" }}>
            {chips.map((chip) => <button key={chip} onClick={() => sendText(chip)} style={{ flexShrink: 0, borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "none", padding: "5px 11px", color: "rgba(255,255,255,.7)", fontSize: 11, whiteSpace: "nowrap", cursor: "pointer" }}>{chip}</button>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,.08)", padding: 12 }}>
            <button onClick={isConnected && sessionMode === "voice" ? endVoiceSession : startVoiceSession} disabled={startingMode === "voice"} title={isConnected && sessionMode === "voice" ? t("app.endVoice") : t("app.enableVoice")} aria-label={isConnected && sessionMode === "voice" ? t("app.endVoice") : t("app.enableVoice")} style={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", cursor: startingMode === "voice" ? "progress" : "pointer", color: "#fff", opacity: startingMode === "voice" ? 0.65 : 1, background: isConnected && sessionMode === "voice" ? "#8D2E3A" : `radial-gradient(circle at 35% 30%, ${C.lavender}, ${C.purple})` }}>{isConnected && sessionMode === "voice" ? <MicOff size={17} /> : <Mic size={17} />}</button>
            <input dir="auto" value={input} onChange={(event) => { setInput(event.target.value); if (isConnected && conversation.sendUserActivity) conversation.sendUserActivity(); }} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && sendText()} placeholder={t("app.inputPlaceholder")} aria-label={t("app.inputPlaceholder")} style={{ minWidth: 0, flex: 1, border: "none", borderRadius: 999, outline: "none", background: "rgba(255,255,255,.05)", padding: "10px 14px", color: "#fff", fontSize: 14, textAlign: "start" }} />
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

function LanguageSelector({ locale, label, onSelect }) {
  return (
    <div role="group" aria-label={label} title={label} style={{ display: "flex", height: 28, flexShrink: 0, alignItems: "center", gap: 1, borderRadius: 8, background: "rgba(255,255,255,.05)", padding: 2 }}>
      {[{ code: "en", label: "English" }, { code: "ar", label: "العربية" }].map((item) => (
        <button key={item.code} type="button" aria-pressed={locale === item.code} aria-label={item.code === "en" ? "English" : "العربية"} onClick={() => onSelect(item.code)} style={{ minWidth: item.code === "en" ? 43 : 47, height: 22, border: 0, borderRadius: 6, paddingInline: 5, background: locale === item.code ? C.magenta : "transparent", color: locale === item.code ? "#fff" : "rgba(255,255,255,.55)", fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{item.label}</button>
      ))}
    </div>
  );
}
