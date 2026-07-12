import React from "react";
import { Film, Clock, Armchair, Ticket, ChevronRight, Check, RotateCcw } from "lucide-react";
import { C } from "../theme.js";

export function Poster({ tint, title, small, posterUrl }) {
  const [imgOk, setImgOk] = React.useState(!!posterUrl);
  const t = tint && tint.length === 2 ? tint : [C.purple, C.magenta];
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 12,
      width: small ? 56 : "100%", height: small ? 80 : undefined,
      aspectRatio: small ? undefined : "2/3",
      background: `linear-gradient(150deg, ${t[0]}, ${t[1]})`,
      display: "flex", alignItems: "flex-end",
    }}>
      {imgOk && posterUrl && (
        <img src={posterUrl} alt={title || "poster"} onError={() => setImgOk(false)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {!imgOk && <div style={{ position: "absolute", inset: 0, opacity: 0.35, backgroundImage: "radial-gradient(circle at 30% 15%, rgba(255,255,255,.6), transparent 50%)" }} />}
      {!imgOk && <Film style={{ position: "absolute", right: 8, top: 8, opacity: 0.45 }} size={small ? 12 : 18} color="#fff" />}
      {!small && title && (
        <div style={{ position: "relative", width: "100%", padding: "10px 10px 12px", background: "linear-gradient(transparent, rgba(0,0,0,.65))" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: 0.2, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>{title}</div>
        </div>
      )}
    </div>
  );
}

function Header({ icon, title, sub, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      {onBack && (
        <button onClick={onBack} style={btnGhost}>
          <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
      )}
      <div style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(182,24,108,.2)", color: C.lavender }}>{icon}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{sub}</div>
      </div>
    </div>
  );
}

export function MovieGrid({ movies, cinemaName, onSelect }) {
  return (
    <div>
      <Header icon={<Film size={16} />} title="Now Showing" sub={`${cinemaName} · Today`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
        {movies.map((m) => (
          <button key={m.id} onClick={() => onSelect(m)} style={{ ...btnReset, textAlign: "left" }}>
            <Poster tint={m.tint} title={m.title} posterUrl={m.posterUrl} />
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.15 }}>{m.title}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,.5)" }}>
              <span style={{ background: "rgba(182,24,108,.25)", color: C.lavender, borderRadius: 3, padding: "0 4px", marginRight: 6 }}>{m.rating}</span>
              {m.genre}{m.runtime ? ` · ${m.runtime}m` : m.language ? ` · ${m.language}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Showtimes({ movie, sessions, onSelect, onBack }) {
  const expColor = (e) => (["IMAX", "MAX"].includes(e) ? "#C79A4B" : e === "GOLD" ? "#D9A94B" : e === "KIDS" ? C.green : C.lavender);
  return (
    <div>
      <Header icon={<Clock size={16} />} title={movie.title} sub={`${movie.rating} · ${movie.runtime} min · Select a showtime`} onBack={onBack} />
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 96, flexShrink: 0 }}><Poster tint={movie.tint} title={movie.title} posterUrl={movie.posterUrl} /></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <button key={s.sessionId} onClick={() => onSelect(s)} style={rowBtn}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{s.time}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: expColor(s.exp) }}>{s.exp}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{s.screen}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{s.seatsAvailable} seats</span>
                <ChevronRight size={18} color="rgba(255,255,255,.4)" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SeatMap({ movie, session, plan, selected, onToggle, onConfirm, onBack }) {
  const price = (p) => (p ? 63 : 42);
  const total = selected.reduce((sum, id) => {
    const seat = plan.flatMap((r) => r.seats).find((s) => s.id === id);
    return sum + (seat ? price(seat.premium) : 0);
  }, 0);
  return (
    <div>
      <Header icon={<Armchair size={16} />} title={`${movie.title} · ${session.time}`} sub={`${session.exp} · ${session.screen} · Tap seats`} onBack={onBack} />
      <div style={{ maxWidth: 420, margin: "0 auto 24px" }}>
        <div style={{ height: 6, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${C.lavender}, transparent)`, boxShadow: "0 0 24px 4px rgba(228,220,240,.35)" }} />
        <div style={{ marginTop: 4, textAlign: "center", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>Screen</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {plan.map((r) => (
          <div key={r.row} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4 }}>
            <span style={{ width: 16, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)" }}>{r.row}</span>
            {r.seats.map((s, i) => {
              const isSel = selected.includes(s.id);
              const sold = s.status !== 0;
              return (
                <React.Fragment key={s.id}>
                  {i === 6 && <span style={{ width: 12 }} />}
                  <button disabled={sold} onClick={() => onToggle(s)} title={`${s.id}${s.premium ? " · Premium" : ""}`}
                    style={{
                      height: 22, width: 22, borderRadius: 5, border: "none", fontSize: 8, fontWeight: 700,
                      background: sold ? "rgba(255,255,255,.06)" : isSel ? C.magenta : s.premium ? "rgba(199,154,75,.25)" : "rgba(228,220,240,.14)",
                      color: sold ? "rgba(255,255,255,.2)" : isSel ? "#fff" : "rgba(255,255,255,.7)",
                      cursor: sold ? "not-allowed" : "pointer", outline: isSel ? "1px solid #fff" : "none",
                    }}>
                    {s.colIndex + 1}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, fontSize: 10, color: "rgba(255,255,255,.5)" }}>
        <Legend swatch="rgba(228,220,240,.14)" label="Standard · AED 42" />
        <Legend swatch="rgba(199,154,75,.25)" label="Premium · AED 63" />
        <Legend swatch={C.magenta} label="Selected" />
        <Legend swatch="rgba(255,255,255,.06)" label="Sold" />
      </div>
      <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)", padding: "12px 16px" }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{selected.length ? `${selected.length} seat(s): ${selected.join(", ")}` : "No seats selected"}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>AED {total}</div>
        </div>
        <button disabled={!selected.length} onClick={() => onConfirm(selected, total)}
          style={{ borderRadius: 8, border: "none", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: C.magenta, opacity: selected.length ? 1 : 0.3, cursor: selected.length ? "pointer" : "not-allowed" }}>
          Confirm seats
        </button>
      </div>
    </div>
  );
}

export function BookingCard({ booking, onCancel, cancelled }) {
  return (
    <div>
      <Header icon={<Ticket size={16} />} title={cancelled ? "Booking Cancelled" : "Booking Confirmed"} sub={cancelled ? "A refund has been initiated" : "Your tickets are ready"} />
      <div style={{ maxWidth: 420, margin: "0 auto", overflow: "hidden", borderRadius: 16, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(160deg, rgba(99,65,141,.35), rgba(30,23,40,.6))" }}>
        <div style={{ display: "flex", gap: 16, padding: 20 }}>
          <Poster tint={booking.tint || [C.purple, C.magenta]} small />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{booking.movieTitle}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{booking.screen} · {booking.showtime}</div>
          </div>
        </div>
        <div style={{ borderTop: "1px dashed rgba(255,255,255,.15)", padding: "12px 20px" }}>
          <Row k="Seats" v={(Array.isArray(booking.seats) ? booking.seats : [booking.seats].filter(Boolean)).join(", ")} />
          <Row k="Booking ref" v={<span style={{ fontFamily: "monospace", color: C.lavender }}>{booking.ref}</span>} />
          <Row k="Total" v={`AED ${booking.total ?? booking.refundAmount}`} />
        </div>
        {!cancelled ? (
          <button onClick={onCancel} style={{ ...cardFootBtn, color: "rgba(255,255,255,.7)" }}>
            <RotateCcw size={14} /> Cancel booking & refund
          </button>
        ) : (
          <div style={{ ...cardFootBtn, color: C.green, cursor: "default" }}>
            <Check size={14} /> Refund of AED {booking.total ?? booking.refundAmount} initiated
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 4 }}>
      <span style={{ color: "rgba(255,255,255,.6)" }}>{k}</span>
      <span style={{ fontWeight: 600, color: "#fff" }}>{v}</span>
    </div>
  );
}
function Legend({ swatch, label }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ height: 12, width: 12, borderRadius: 3, background: swatch }} />{label}</span>;
}

const btnReset = { background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" };
const btnGhost = { ...btnReset, borderRadius: 8, padding: 6, color: "rgba(255,255,255,.5)" };
const rowBtn = { display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", padding: "12px 16px", textAlign: "left", cursor: "pointer" };
const cardFootBtn = { display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,.12)", padding: "12px 0", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" };
