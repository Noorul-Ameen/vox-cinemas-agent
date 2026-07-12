import React, { useState, useRef, useCallback, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Send, Sparkles } from "lucide-react";
import { C } from "./theme.js";
import { MovieGrid, Showtimes, SeatMap, BookingCard } from "./components/RichMedia.jsx";
import Checkout from "./components/Checkout.jsx";
import * as vista from "./vistaClient.js";

const CINEMA = { id: "0002", name: "VOX — Mall of the Emirates" };

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState({ view: "empty" });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);

  // For BLOCKING tools: the client tool returns a Promise we resolve when the
  // user confirms. We stash the resolver here so onConfirm can call it.
  const seatResolver = useRef(null);
  const cancelResolver = useRef(null);

  // Caches so tool calls can resolve the RIGHT film/session even when the agent
  // passes a guessed id or just a title/time. This is what makes voice work.
  const filmsRef = useRef([]);
  const sessionsRef = useRef([]);
  const planRef = useRef([]);

  const say = (role, text) => setMessages((m) => [...m, { role, text }]);

  // --- fuzzy resolvers --------------------------------------------------------
  const norm = (s) => (s ?? "").toString().toLowerCase().trim();
  const firstWord = (s) => norm(s).split(/[:\s]/).filter(Boolean)[0] || "";

  const ensureFilms = useCallback(async () => {
    if (!filmsRef.current.length) filmsRef.current = await vista.getScheduledFilms(CINEMA.id);
    return filmsRef.current;
  }, []);

  const resolveFilm = (idOrTitle) => {
    const films = filmsRef.current;
    const key = norm(idOrTitle);
    if (!key) return null;
    return (
      films.find((m) => norm(m.id) === key) ||
      films.find((m) => norm(m.title) === key) ||
      films.find((m) => norm(m.title).includes(key) || key.includes(norm(m.title))) ||
      films.find((m) => firstWord(m.title) === firstWord(idOrTitle)) ||
      null
    );
  };

  const resolveSession = (sessions, sessionId, showtime) => {
    if (!sessions.length) return null;
    return (
      sessions.find((s) => s.sessionId === sessionId) ||
      sessions.find((s) => norm(s.time) === norm(showtime)) ||
      sessions.find((s) => norm(showtime).includes(norm(s.time))) ||
      sessions[0]
    );
  };

  // Prefetch films on mount so resolution works even if the guest jumps
  // straight to "book seats for Dune" without seeing the movie list first.
  useEffect(() => { ensureFilms().catch(() => {}); }, [ensureFilms]);

  // Shared seat-finalization: used by BOTH voice (select_seats) and tap (confirm
  // button). Validates seats, then routes to CHECKOUT (payment) — the booking is
  // only created after payment succeeds.
  const finalizeSeats = (seatIds) => {
    const plan = planRef.current || [];
    const all = plan.flatMap((r) => r.seats);
    const valid = seatIds.filter((id) => all.some((s) => s.id === id && s.status === 0));
    const price = (p) => (p ? 63 : 42);
    const total = valid.reduce((sum, id) => {
      const s = all.find((x) => x.id === id);
      return sum + (s ? price(s.premium) : 0);
    }, 0);
    const movie = stage.movie;
    const session = stage.session;
    if (valid.length) {
      const order = { movieTitle: movie?.title, screen: session?.screen, showtime: session?.time, seats: valid, total, tint: movie?.tint };
      setPendingOrder(order);
      setStage((s) => ({ ...s, view: "checkout", order }));
    }
    return { valid, total };
  };

  // Payment success -> create the booking, persist it, notify the agent.
  const handlePaid = ({ label }) => {
    const order = pendingOrder;
    const ref = "WL" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const b = { ...order, ref, paidWith: label, cancelled: false, createdAt: new Date().toISOString() };
    // Persist so cancellation later can find it (survives refresh).
    try {
      const store = JSON.parse(localStorage.getItem("vox_bookings") || "[]");
      store.push(b);
      localStorage.setItem("vox_bookings", JSON.stringify(store));
    } catch {}
    setBooking(b); setCancelled(false); setPendingOrder(null);
    setStage({ view: "booking", booking: b });
    say("system", `Payment via ${label} — booking ${ref} confirmed.`);
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`Payment completed via ${label}. Booking confirmed with reference ${ref} for ${order.movieTitle}, seats ${order.seats.join(", ")}, total AED ${order.total}. Tell the guest their booking reference.`);
    }
  };

  /* ==========================================================================
   *  CLIENT TOOLS  — registered with the REAL ElevenLabs SDK below.
   *  The agent invokes these by name. They fetch Vista data + render UI.
   *  Blocking tools (show_seat_map, show_booking_for_cancellation) return a
   *  Promise so the agent waits for the user's action.
   * ========================================================================== */
  const clientTools = {
    show_movie_selection: async () => {
      const movies = await ensureFilms();                          // <-- hits Vista
      setStage({ view: "movies", movies });
      // Return the real ids/titles so the agent can reference them later (voice).
      return JSON.stringify({
        shown: "movie list",
        movies: movies.map((m) => ({ id: m.id, title: m.title, rating: m.rating })),
      });
    },

    show_showtimes: async ({ movieId, movieTitle }) => {
      await ensureFilms();
      const movie = resolveFilm(movieId) || resolveFilm(movieTitle) || filmsRef.current[0];
      const sessions = await vista.getSessions(CINEMA.id, movie.id); // <-- real id -> real sessions
      sessionsRef.current = sessions;
      setStage({ view: "showtimes", movie, sessions });
      return JSON.stringify({
        movie: movie.title,
        showtimes: sessions.map((s) => ({ sessionId: s.sessionId, time: s.time, experience: s.exp, seatsAvailable: s.seatsAvailable })),
      });
    },

    show_seat_map: async ({ movieTitle, sessionId, showtime }) => {
      await ensureFilms();
      const movie = stage.movie || resolveFilm(movieTitle) || filmsRef.current[0];
      // Make sure we have this film's sessions cached to resolve against.
      let sessions = sessionsRef.current;
      if (!sessions.length && movie) {
        sessions = await vista.getSessions(CINEMA.id, movie.id);
        sessionsRef.current = sessions;
      }
      const session = resolveSession(sessions, sessionId, showtime) || { sessionId, time: showtime, exp: "", screen: "" };
      const plan = await vista.getSeatPlan(CINEMA.id, session.sessionId); // <-- real session id
      setSelectedSeats([]);
      planRef.current = plan;
      setStage({ view: "seatmap", movie, session, plan });
      // NON-blocking: return the available seats so the agent can guide the guest
      // to pick by voice (via select_seats) OR let them tap the map.
      const available = plan.flatMap((r) => r.seats).filter((s) => s.status === 0).map((s) => s.id);
      return JSON.stringify({
        shown: "seat map",
        availableSeats: available,
        instruction: "Ask the guest which seats they'd like. When they tell you (e.g. 'E1 and E2'), call select_seats with those seat labels. They may also tap the map.",
      });
    },

    select_seats: ({ seats }) => {
      const ids = (Array.isArray(seats) ? seats : String(seats || "").split(/[,\s]+/))
        .map((x) => String(x).toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean);
      const res = finalizeSeats(ids);
      if (!res.valid.length) {
        return JSON.stringify({ confirmed: false, reason: "None of those seats are available. Ask the guest to choose from the available seats shown on the map." });
      }
      const dropped = ids.filter((id) => !res.valid.includes(id));
      return JSON.stringify({
        confirmed: true,
        seats: res.valid,
        total: res.total,
        currency: "AED",
        next: "The checkout screen is now displayed. Ask the guest to complete payment on screen (saved card, new card, Apple Pay or Samsung Pay). Do NOT ask for card details by voice. You will be notified when payment completes.",
        note: dropped.length ? `These were unavailable and skipped: ${dropped.join(", ")}` : undefined,
      });
    },

    show_booking_summary: ({ movieTitle, screen, showtime, seats, ref, total }) => {
      const film = resolveFilm(movieTitle);
      // seats may arrive as an array OR a string like "C5, C6" — normalize to array.
      const seatArr = Array.isArray(seats)
        ? seats
        : (seats ? String(seats).split(/[,\s]+/).filter(Boolean) : []);
      const b = { movieTitle, screen, showtime, seats: seatArr, ref, total, tint: film?.tint || stage.movie?.tint };
      setBooking(b); setCancelled(false);
      setStage({ view: "booking", booking: b });
      return `Booking ${ref} displayed to the customer.`;
    },

    show_booking_for_cancellation: async ({ bookingRef }) => {
      const b = await vista.searchBooking(bookingRef);             // <-- hits Vista
      b.tint = resolveFilm(b.movieTitle)?.tint;
      setBooking(b); setCancelled(false);
      setStage({ view: "booking", booking: b });
      // BLOCKING: wait for the user to confirm cancellation.
      return await new Promise((resolve) => { cancelResolver.current = resolve; });
    },
  };

  /* ==========================================================================
   *  REAL ELEVENLABS AGENT  — the actual SDK hook.
   * ========================================================================== */
  const conversation = useConversation({
    clientTools,
    serverLocation: "eu-residency",
    onConnect: () => say("system", "Connected to the VOX concierge."),
    onDisconnect: () => say("system", "Call ended."),
    onMessage: (m) => {
      // m.source: "user" | "ai"; m.message: transcript text
      if (m?.message) say(m.source === "user" ? "user" : "agent", m.message);
    },
    onError: (e) => say("system", `Error: ${typeof e === "string" ? e : e?.message || "unknown"}`),
  });

  const status = conversation.status; // "disconnected" | "connecting" | "connected"
  const isConnected = status === "connected";

  const startCall = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }); // mic permission
      await conversation.startSession({
        agentId: import.meta.env.VITE_AGENT_ID,
        connectionType: "webrtc",
      });
    } catch (e) {
      say("system", `Could not start: ${e.message}. Check VITE_AGENT_ID and mic permission.`);
    }
  }, [conversation]);

  const endCall = useCallback(() => conversation.endSession(), [conversation]);

  // Text messages (works once connected; the agent replies by voice + transcript)
  const sendText = useCallback((text) => {
    const val = (text ?? input).trim();
    if (!val) return;
    say("user", val);
    setInput("");
    if (isConnected && conversation.sendUserMessage) conversation.sendUserMessage(val);
    else say("system", "Start the call first (tap the mic), then talk or type.");
  }, [input, isConnected, conversation]);

  // --- rich-media interactions feed the user's tap back to the agent ---------
  const pickMovie = (m) => {
    setStage((s) => ({ ...s, movie: m }));
    if (isConnected && conversation.sendUserMessage) conversation.sendUserMessage(`I'll watch ${m.title}`);
    say("user", m.title);
  };
  const pickSession = (s) => {
    setStage((st) => ({ ...st, session: s }));
    if (isConnected && conversation.sendUserMessage) conversation.sendUserMessage(`The ${s.time} ${s.exp} show`);
    say("user", `${s.time} ${s.exp}`);
  };
  const toggleSeat = (seat) => setSelectedSeats((cur) => cur.includes(seat.id) ? cur.filter((x) => x !== seat.id) : [...cur, seat.id]);

  const confirmSeats = (seats, total) => {
    // Tap path: finalize locally (instant), then tell the agent so it can
    // speak the confirmation. show_seat_map is no longer blocking.
    finalizeSeats(seats);
    say("user", `Confirm seats ${seats.join(", ")}`);
    if (isConnected && conversation.sendContextualUpdate) {
      conversation.sendContextualUpdate(`The guest selected and confirmed seats ${seats.join(", ")} via the seat map. Acknowledge the booking is confirmed.`);
    } else if (isConnected && conversation.sendUserMessage) {
      conversation.sendUserMessage(`I've selected seats ${seats.join(", ")}.`);
    }
  };
  const cancelBooking = () => {
    cancelResolver.current?.(JSON.stringify({ confirmed: true }));
    cancelResolver.current = null;
    setCancelled(true);
    try {
      const store = JSON.parse(localStorage.getItem("vox_bookings") || "[]");
      const b = store.find((x) => x.ref === booking?.ref);
      if (b) { b.cancelled = true; localStorage.setItem("vox_bookings", JSON.stringify(store)); }
    } catch {}
    say("user", "Yes, cancel it");
  };

  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const chips = ["What's showing tonight?", "Book seats for Dune", "Cancel booking WL59LFJ"];

  return (
    <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, height: "min(860px, 96vh)", display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.55)", background: C.ink, border: "1px solid rgba(255,255,255,.06)" }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.08)", padding: "14px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, fontWeight: 900, color: "#fff", background: C.magenta }}>V</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>VOX Concierge</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>ElevenLabs Agent · Live</div>
            </div>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,.5)" }}>
            <span style={{ height: 8, width: 8, borderRadius: 999, background: isConnected ? C.green : status === "connecting" ? "#D9A94B" : "#777" }} />
            {status}
          </span>
        </div>

        {/* stage — client tools render here (TOP, like a mobile app main view) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, background: `radial-gradient(120% 60% at 50% -10%, ${C.screen}, ${C.ink})` }}>
          {stage.view === "empty" && (
            <div style={{ height: "100%", minHeight: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ display: "flex", height: 56, width: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, background: "rgba(182,24,108,.15)", marginBottom: 16 }}>
                <Sparkles color={C.lavender} size={26} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>The concierge renders here</div>
              <p style={{ marginTop: 8, maxWidth: 280, fontSize: 13, color: "rgba(255,255,255,.5)" }}>
                Tap the mic below and ask what's showing. Movie cards, showtimes, seat maps, and your booking appear here.
              </p>
            </div>
          )}
          {stage.view === "movies" && <MovieGrid movies={stage.movies} cinemaName={CINEMA.name} onSelect={pickMovie} />}
          {stage.view === "showtimes" && <Showtimes movie={stage.movie} sessions={stage.sessions} onSelect={pickSession} onBack={() => clientTools.show_movie_selection()} />}
          {stage.view === "seatmap" && <SeatMap movie={stage.movie} session={stage.session} plan={stage.plan} selected={selectedSeats} onToggle={toggleSeat} onConfirm={confirmSeats} onBack={() => clientTools.show_showtimes({ movieId: stage.movie.id, movieTitle: stage.movie.title })} />}
          {stage.view === "checkout" && stage.order && (
            <Checkout
              order={stage.order}
              onPaid={handlePaid}
              onCancel={() => setStage({ view: "seatmap", movie: stage.movie, session: stage.session, plan: planRef.current })}
            />
          )}
          {stage.view === "booking" && booking && <BookingCard booking={booking} onCancel={cancelBooking} cancelled={cancelled} />}
        </div>

        {/* conversation panel (BOTTOM, collapsible-height transcript) */}
        <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,.08)", background: C.ink2, flexShrink: 0 }}>
          <div ref={scrollRef} style={{ overflowY: "auto", padding: "12px 16px", maxHeight: 200, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>
                Tap the mic to start, then speak or type. Try a suggestion below.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", borderRadius: 16, padding: "9px 13px", fontSize: 13, lineHeight: 1.35,
                  background: m.role === "user" ? C.purple : m.role === "system" ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)",
                  color: m.role === "system" ? "rgba(255,255,255,.5)" : m.role === "user" ? "#fff" : "rgba(255,255,255,.9)",
                  fontStyle: m.role === "system" ? "italic" : "normal",
                }}>{m.text}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, padding: "0 16px 8px", overflowX: "auto", flexWrap: "nowrap" }}>
            {chips.map((ch) => (
              <button key={ch} onClick={() => sendText(ch)} style={{ whiteSpace: "nowrap", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "none", color: "rgba(255,255,255,.7)", fontSize: 11, padding: "5px 11px", cursor: "pointer", flexShrink: 0 }}>{ch}</button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,.08)", padding: 12 }}>
            <button onClick={isConnected ? endCall : startCall} title={isConnected ? "End call" : "Start call"}
              style={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", cursor: "pointer", color: "#fff", background: isConnected ? "#8D2E3A" : `radial-gradient(circle at 35% 30%, ${C.lavender}, ${C.purple})` }}>
              {isConnected ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder="Message the concierge…" style={{ flex: 1, background: "rgba(255,255,255,.05)", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "10px 14px", borderRadius: 999 }} />
            <button onClick={() => sendText()} disabled={!input.trim()} style={{ display: "flex", height: 36, width: 36, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "none", cursor: "pointer", color: "#fff", background: C.magenta, opacity: input.trim() ? 1 : 0.3 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
