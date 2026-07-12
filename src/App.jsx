import React, { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { BadgePercent, History, Languages, MapPin, Mic, MicOff, Send, Sparkles } from "lucide-react";
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
import { OFFER_META } from "./offers/offersData.js";
import { resolveOffer, resolveOfferForBankAndCard } from "./offers/offerResolver.js";
import * as vista from "./vistaClient.js";

const CINEMAS = vista.getCinemas();
const DEFAULT_CINEMA = CINEMAS.find((item) => item.id === "0002") || CINEMAS[0];
const stripVox = (name) => String(name || "").replace(/^VOX\s*[—-]\s*/, "");
const norm = (value) => String(value ?? "").toLowerCase().trim();
const localizedValue = (value, locale) => typeof value === "string" ? value : value?.[locale] || value?.en || "";
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
  const { locale, dir, t, setLocale, toggleLocale } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState({ view: "empty" });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [bookings, setBookings] = useState(readBookings);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [cinema, setCinema] = useState(DEFAULT_CINEMA);

  // Blocking cancellation tool state. Seat selection remains deliberately
  // non-blocking so both voice and touch can continue to use select_seats.
  const cancelResolver = useRef(null);

  // Voice-resolution caches and non-recursive return-navigation snapshots.
  const filmsRef = useRef([]);
  const filmsCinemaRef = useRef("");
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

  const ensureFilms = useCallback(async (cinemaId = cinemaRef.current.id) => {
    if (!filmsRef.current.length || filmsCinemaRef.current !== cinemaId) {
      filmsRef.current = await vista.getScheduledFilms(cinemaId);
      filmsCinemaRef.current = cinemaId;
      sessionsRef.current = [];
      sessionsFilmRef.current = "";
    }
    return filmsRef.current;
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
    ensureFilms(cinema.id).catch(() => {});
  }, [cinema.id, ensureFilms]);

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
    if (valid.length) {
      const order = {
        movieId: movie?.id,
        movieTitle: movie?.title,
        cinemaId: cinemaRef.current.id,
        cinemaName: cinemaRef.current.name,
        sessionId: session?.sessionId,
        date: session?.date || vista.demoDate(),
        experience: session?.exp,
        screen: session?.screen,
        showtime: session?.time,
        seats: valid,
        total,
        currency: cinemaRef.current.currency || "AED",
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
      if (target.id !== cinemaRef.current.id) {
        cinemaRef.current = target;
        setCinema(target);
      }
      const movies = await ensureFilms(target.id);
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
      await ensureFilms(cinemaRef.current.id);
      const hasRequestedMovie = Boolean(movieId || movieTitle);
      const movie = resolveFilm(movieId) || resolveFilm(movieTitle) || (!hasRequestedMovie ? filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle || movieId}. Ask the guest to choose a title from the displayed movie list.` });
      const sessions = await vista.getSessions(cinemaRef.current.id, movie.id);
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
      await ensureFilms(cinemaRef.current.id);
      const current = stageRef.current;
      const resolvedMovie = resolveFilm(movieTitle);
      const movie = resolvedMovie || (!movieTitle ? current.movie || filmsRef.current[0] : null);
      if (!movie) return JSON.stringify({ shown: false, reason: `No matching movie was found for ${movieTitle}. Ask the guest to choose a title from the displayed movie list.` });
      let sessions = sessionsRef.current;
      if (!sessions.length || sessionsFilmRef.current !== movie?.id) {
        sessions = movie ? await vista.getSessions(cinemaRef.current.id, movie.id) : [];
        sessionsRef.current = sessions;
        sessionsFilmRef.current = movie?.id || "";
      }
      const session = resolveSession(sessions, sessionId, showtime) || { sessionId, time: showtime, exp: "", screen: "" };
      const plan = await vista.getSeatPlan(cinemaRef.current.id, session.sessionId);
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
        cinemaId: cinemaRef.current.id,
        cinemaName: cinemaRef.current.name,
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
    onConnect: () => say("system", t("app.connectedMessage")),
    onDisconnect: () => say("system", t("app.disconnectedMessage")),
    onMessage: (message) => {
      if (!message?.message) return;
      const role = message.source === "user" ? "user" : "agent";
      say(role, message.message);
      if (role === "user" && /[\u0600-\u06ff]/.test(message.message) && localeRef.current !== "ar") setLocale("ar");
    },
    onError: (error) => say("system", `${t("app.errorPrefix")}: ${typeof error === "string" ? error : error?.message || t("app.unknownError")}`),
  });

  const status = conversation.status;
  const isConnected = status === "connected";

  const startCall = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: import.meta.env.VITE_AGENT_ID,
        connectionType: "webrtc",
      });
    } catch (error) {
      say("system", t("app.startError", { message: error?.message || t("app.unknownError") }));
    }
  }, [conversation, say, t]);

  const endCall = useCallback(() => conversation.endSession(), [conversation]);

  const sendText = useCallback((text) => {
    const value = (text ?? input).trim();
    if (!value) return;
    say("user", value);
    setInput("");
    if (isConnected && conversation.sendUserMessage) conversation.sendUserMessage(value);
    else say("system", t("app.startFirst"));
  }, [conversation, input, isConnected, say, t]);

  const pickMovie = async (movie) => {
    dismissPendingCancellation("movie_selected");
    clearPendingOrder();
    resetClarificationFailures();
    say("user", movie.title);
    const sessions = await vista.getSessions(cinemaRef.current.id, movie.id);
    sessionsRef.current = sessions;
    sessionsFilmRef.current = movie.id;
    setStage({ view: "showtimes", movie, sessions });
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest selected ${movie.title}. Showtimes are displayed.`);
  };

  const pickSession = async (session) => {
    dismissPendingCancellation("session_selected");
    clearPendingOrder();
    resetClarificationFailures();
    const movie = stageRef.current.movie;
    say("user", `${session.time} ${session.exp}`);
    const plan = await vista.getSeatPlan(cinemaRef.current.id, session.sessionId);
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

  const changeLanguage = () => {
    toggleLocale();
    const next = locale === "en" ? "Arabic" : "English";
    if (isConnected && conversation.sendContextualUpdate) conversation.sendContextualUpdate(`The guest switched the interface to ${next}. Continue speaking in ${next}.`);
  };

  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const chips = [t("app.chipShowing"), t("app.chipBook"), t("app.chipCancel")];
  const statusLabel = status === "connected" ? t("app.connected") : status === "connecting" ? t("app.connecting") : t("app.disconnected");
  const displayedBooking = stage.booking || booking;

  return (
    <div lang={locale} dir={dir} style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <style>{`.voxi-chip-row::-webkit-scrollbar{display:none}`}</style>
      <div style={{ width: "100%", maxWidth: 420, height: "min(860px, 96vh)", display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.55)", background: C.ink, border: "1px solid rgba(255,255,255,.06)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,.08)", padding: "11px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 9 }}>
            <div style={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 8, fontWeight: 900, color: "#fff", background: C.magenta }}>V</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: "hidden", fontSize: 14, fontWeight: 700, color: "#fff", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("app.title")}</div>
              <button onClick={openCinemaPicker} title={t("app.changeCinema")} style={{ display: "flex", maxWidth: 145, alignItems: "center", gap: 3, padding: 0, border: 0, background: "transparent", color: "rgba(255,255,255,.45)", fontSize: 10, cursor: "pointer" }}>
                <MapPin size={10} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripVox(cinema.name)}</span>
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
            <TopButton label={t("app.offers")} onClick={openOffers}><BadgePercent size={14} /></TopButton>
            <TopButton label={t("app.history")} onClick={openHistory}><History size={14} /></TopButton>
            <TopButton label={locale === "en" ? "العربية" : "English"} onClick={changeLanguage}><Languages size={14} /></TopButton>
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
            </div>
          )}
          {stage.view === "cinemas" && <CinemaPicker cinemas={CINEMAS} selected={cinema} onSelect={chooseCinema} onBack={() => setStage(cinemaReturnRef.current || { view: "empty" })} />}
          {stage.view === "movies" && <MovieGrid movies={stage.movies} cinemaName={stripVox(cinema.name)} onSelect={pickMovie} />}
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
            <button onClick={isConnected ? endCall : startCall} title={isConnected ? t("app.endCall") : t("app.startCall")} aria-label={isConnected ? t("app.endCall") : t("app.startCall")} style={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", cursor: "pointer", color: "#fff", background: isConnected ? "#8D2E3A" : `radial-gradient(circle at 35% 30%, ${C.lavender}, ${C.purple})` }}>{isConnected ? <MicOff size={17} /> : <Mic size={17} />}</button>
            <input dir="auto" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendText()} placeholder={t("app.inputPlaceholder")} style={{ minWidth: 0, flex: 1, border: "none", borderRadius: 999, outline: "none", background: "rgba(255,255,255,.05)", padding: "10px 14px", color: "#fff", fontSize: 14, textAlign: "start" }} />
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
