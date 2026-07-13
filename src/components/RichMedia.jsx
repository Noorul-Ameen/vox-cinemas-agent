import React from "react";
import { Film, Clock, Armchair, Ticket, ChevronRight, Check, RotateCcw, MapPin, Search } from "lucide-react";
import { C } from "../theme.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { getExperienceMedia, getMediaUrl } from "../mediaData.js";
import BookingQRCode from "./BookingQRCode.jsx";

export function Poster({ tint, title, small, posterUrl }) {
  const { t } = useI18n();
  const [imgOk, setImgOk] = React.useState(!!posterUrl);
  const palette = tint && tint.length === 2 ? tint : [C.purple, C.magenta];
  React.useEffect(() => setImgOk(!!posterUrl), [posterUrl]);
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 12,
      width: small ? 56 : "100%", height: small ? 80 : undefined,
      maxWidth: small ? 56 : 104, maxHeight: small ? 80 : 156,
      aspectRatio: small ? undefined : "2/3",
      background: `linear-gradient(150deg, ${palette[0]}, ${palette[1]})`,
      display: "flex", flexShrink: 0, alignItems: "flex-end", boxSizing: "border-box",
    }}>
      {imgOk && posterUrl && (
        <img src={posterUrl} alt={title ? `${title} — ${t("movies.poster")}` : t("movies.poster")} loading="lazy" decoding="async" onError={() => setImgOk(false)}
          style={{ position: "absolute", inset: 0, display: "block", width: "100%", maxWidth: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} />
      )}
      {!imgOk && <div style={{ position: "absolute", inset: 0, opacity: 0.35, backgroundImage: "radial-gradient(circle at 30% 15%, rgba(255,255,255,.6), transparent 50%)" }} />}
      {!imgOk && <Film style={{ position: "absolute", right: 8, top: 8, opacity: 0.45 }} size={small ? 12 : 18} color="#fff" />}
      {!small && title && (
        <div style={{ position: "relative", width: "100%", padding: "8px 8px 9px", background: "linear-gradient(transparent, rgba(0,0,0,.72))" }}>
          <div dir="auto" style={{ display: "-webkit-box", overflow: "hidden", fontSize: 11, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: 0.1, textShadow: "0 1px 3px rgba(0,0,0,.6)", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>{title}</div>
        </div>
      )}
    </div>
  );
}

function ExperienceThumbnail({ experience, media }) {
  const imageUrl = getMediaUrl(getExperienceMedia(experience, media));
  const [imgOk, setImgOk] = React.useState(!!imageUrl);

  React.useEffect(() => setImgOk(!!imageUrl), [imageUrl]);

  return (
    <span aria-hidden="true" style={{ display: "grid", width: 24, height: 24, flexShrink: 0, overflow: "hidden", placeItems: "center", borderRadius: 6, background: "rgba(99,65,141,.28)", color: C.lavender }}>
      {imgOk && imageUrl
        ? <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setImgOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <Film size={12} />}
    </span>
  );
}

function Header({ icon, title, sub, onBack }) {
  const { dir, t } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      {onBack && (
        <button aria-label={t("common.back")} onClick={onBack} style={btnGhost}>
          <ChevronRight size={18} style={{ transform: dir === "rtl" ? "none" : "rotate(180deg)" }} />
        </button>
      )}
      <div style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(182,24,108,.2)", color: C.lavender }}>{icon}</div>
      <div>
        <div dir="auto" style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{sub}</div>
      </div>
    </div>
  );
}

export function CinemaPicker({ cinemas, selected, onSelect, onBack }) {
  const { t, dir } = useI18n();
  const [query, setQuery] = React.useState("");
  const key = query.trim().toLowerCase();
  const visible = cinemas.filter((cinema) => !key || cinema.name.toLowerCase().includes(key));
  return (
    <div>
      <Header icon={<MapPin size={16} />} title={t("cinema.title")} sub={t("cinema.count", { count: cinemas.length })} onBack={onBack} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", padding: "9px 12px", marginBottom: 12 }}>
        <Search size={15} color="rgba(255,255,255,.45)" />
        <input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("cinema.search")} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "#fff", fontSize: 13, textAlign: "start" }} />
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {visible.map((cinema) => (
          <button key={cinema.id} onClick={() => onSelect(cinema)} style={{ ...rowBtn, padding: "11px 13px", borderColor: selected?.id === cinema.id ? C.magenta : "rgba(255,255,255,.12)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <MapPin size={15} color={selected?.id === cinema.id ? C.magenta : C.lavender} />
              <span dir="auto" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "#fff" }}>{cinema.name.replace(/^VOX\s*[—-]\s*/, "")}</span>
            </span>
            {selected?.id === cinema.id ? <Check size={15} color={C.green} /> : <ChevronRight size={16} color="rgba(255,255,255,.35)" style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />}
          </button>
        ))}
        {!visible.length && <div style={{ padding: 18, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.45)" }}>{t("cinema.none")}</div>}
      </div>
    </div>
  );
}

export function MovieGrid({ movies, cinemaName, scheduleDate, onSelect }) {
  const { t } = useI18n();
  return (
    <div>
      <Header icon={<Film size={16} />} title={t("movies.title")} sub={<span><bdi dir="auto">{cinemaName}</bdi> · <span dir="ltr">{scheduleDate}</span></span>} />
      <div style={{ display: "grid", maxWidth: "100%", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
        {movies.map((m) => (
          <button key={m.id} onClick={() => onSelect(m)} style={{ ...btnReset, width: "100%", minWidth: 0, textAlign: "start" }}>
            <Poster tint={m.tint} title={m.title} posterUrl={m.posterUrl} />
            <div dir="auto" style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.15 }}>{m.title}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,.5)" }}>
              <span style={{ background: "rgba(182,24,108,.25)", color: C.lavender, borderRadius: 3, padding: "0 4px", marginInlineEnd: 6 }}>{m.rating}</span>
              {(m.genres || [m.genre]).slice(0, 2).join(" · ")}{m.runtime ? ` · ${t("showtimes.minutes", { count: m.runtime })}` : m.language ? ` · ${m.language}` : ""}
            </div>
            <div dir="auto" style={{ marginTop: 5, fontSize: 10, lineHeight: 1.35, color: "rgba(255,255,255,.42)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.synopsis}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Showtimes({ movie, sessions, onSelect, onBack }) {
  const { t, dir } = useI18n();
  const expColor = (e) => (["IMAX", "MAX"].includes(e) ? "#C79A4B" : e === "GOLD" ? "#D9A94B" : e === "KIDS" ? C.green : C.lavender);
  return (
    <div>
      <Header icon={<Clock size={16} />} title={movie.title} sub={`${movie.rating} · ${movie.runtime ? t("showtimes.minutes", { count: movie.runtime }) : "—"} · ${t("showtimes.select")}`} onBack={onBack} />
      <div style={{ marginBottom: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.18)", padding: "11px 12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
          {(movie.genres || [movie.genre]).filter(Boolean).map((genre) => <span key={genre} style={{ borderRadius: 999, background: "rgba(99,65,141,.28)", color: C.lavender, padding: "2px 7px", fontSize: 10 }}>{genre}</span>)}
          {movie.language && <span style={{ borderRadius: 999, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.6)", padding: "2px 7px", fontSize: 10 }}>{movie.language}</span>}
        </div>
        <p dir="auto" style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,.58)" }}>{movie.synopsis}</p>
      </div>
      <div style={{ display: "flex", width: "100%", maxWidth: "100%", minWidth: 0, gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 72, maxWidth: "22%", flexShrink: 0 }}><Poster tint={movie.tint} title={movie.title} posterUrl={movie.posterUrl} /></div>
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s) => (
            <button key={s.sessionId} onClick={() => onSelect(s)} style={{ ...rowBtn, minWidth: 0, gap: 8 }}>
              <div style={{ display: "flex", minWidth: 0, flex: 1, alignItems: "center", gap: 8, overflow: "hidden" }}>
                <div dir="ltr" style={{ flexShrink: 0, fontSize: 24, fontWeight: 700, color: "#fff" }}>{s.time}</div>
                <ExperienceThumbnail experience={s.exp} media={s.experienceMedia || s.media} />
                <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                  <div dir="ltr" title={s.exp} style={{ overflow: "hidden", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: expColor(s.exp), textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.exp}</div>
                  <div dir="ltr" title={s.screen} style={{ overflow: "hidden", fontSize: 11, color: "rgba(255,255,255,.5)", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.screen}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", whiteSpace: "nowrap" }}>{t("showtimes.seats", { count: s.seatsAvailable })}</span>
                <ChevronRight size={18} color="rgba(255,255,255,.4)" style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SeatMap({ movie, session, plan, selected, onToggle, onConfirm, onBack }) {
  const { t, formatCurrency } = useI18n();
  const price = (p) => (p ? 63 : 42);
  const total = selected.reduce((sum, id) => {
    const seat = plan.flatMap((r) => r.seats).find((s) => s.id === id);
    return sum + (seat ? price(seat.premium) : 0);
  }, 0);
  return (
    <div>
      <Header icon={<Armchair size={16} />} title={<span><bdi dir="auto">{movie.title}</bdi> · <span dir="ltr">{session.time}</span></span>} sub={<span><span dir="ltr">{session.exp} · {session.screen}</span> · {t("seats.tap")}</span>} onBack={onBack} />
      <div dir="ltr" style={{ maxWidth: 420, margin: "0 auto 24px" }}>
        <div style={{ height: 6, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${C.lavender}, transparent)`, boxShadow: "0 0 24px 4px rgba(228,220,240,.35)" }} />
        <div style={{ marginTop: 4, textAlign: "center", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>{t("seats.screen")}</div>
      </div>
      <div dir="ltr" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {plan.map((r) => (
          <div key={r.row} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "clamp(2px, .8vw, 4px)" }}>
            <span style={{ width: 14, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.4)" }}>{r.row}</span>
            {r.seats.map((s, i) => {
              const isSel = selected.includes(s.id);
              const sold = s.status !== 0;
              return (
                <React.Fragment key={s.id}>
                  {i === 6 && <span style={{ width: 12 }} />}
                  <button disabled={sold} onClick={() => onToggle(s)} aria-pressed={isSel} aria-label={sold ? t("seats.soldLabel", { seat: s.id }) : t("seats.availableLabel", { seat: s.id, tier: s.premium ? t("seats.premiumWord") : t("seats.standardWord") })} title={s.id}
                    style={{
                      height: "clamp(18px, 5.2vw, 22px)", width: "clamp(18px, 5.2vw, 22px)", borderRadius: 5, border: "none", padding: 0, fontSize: 8, fontWeight: 700,
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
        <Legend swatch="rgba(228,220,240,.14)" label={t("seats.standard")} />
        <Legend swatch="rgba(199,154,75,.25)" label={t("seats.premium")} />
        <Legend swatch={C.magenta} label={t("seats.selected")} />
        <Legend swatch="rgba(255,255,255,.06)" label={t("seats.sold")} />
      </div>
      <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)", padding: "12px 16px" }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{selected.length ? <>{t("seats.countLabel", { count: selected.length })} <span dir="ltr">{selected.join(", ")}</span></> : t("seats.none")}</div>
          <div dir="ltr" style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{formatCurrency(total, "AED")}</div>
        </div>
        <button disabled={!selected.length} onClick={() => onConfirm(selected, total)}
          style={{ borderRadius: 8, border: "none", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: C.magenta, opacity: selected.length ? 1 : 0.3, cursor: selected.length ? "pointer" : "not-allowed" }}>
          {t("seats.confirm")}
        </button>
      </div>
    </div>
  );
}

export function BookingCard({ booking, onCancel, cancelled }) {
  const { t, formatCurrency } = useI18n();
  const isCancelled = cancelled ?? booking.cancelled;
  const [confirmingCancellation, setConfirmingCancellation] = React.useState(false);
  React.useEffect(() => setConfirmingCancellation(false), [booking.ref, isCancelled]);
  return (
    <div>
      <Header icon={<Ticket size={16} />} title={isCancelled ? t("booking.cancelled") : t("booking.confirmed")} sub={isCancelled ? t("booking.refundStarted") : t("booking.ready")} />
      <div style={{ maxWidth: 420, margin: "0 auto", overflow: "hidden", borderRadius: 16, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(160deg, rgba(99,65,141,.35), rgba(30,23,40,.6))" }}>
        <div style={{ display: "flex", gap: 16, padding: 20 }}>
          <Poster tint={booking.tint || [C.purple, C.magenta]} small />
          <div style={{ flex: 1 }}>
            <div dir="auto" style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{booking.movieTitle}</div>
            <div dir="ltr" style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{booking.screen} · {booking.showtime}</div>
          </div>
        </div>
        <div style={{ borderTop: "1px dashed rgba(255,255,255,.15)", padding: "12px 20px" }}>
          <Row k={t("booking.seats")} v={<span dir="ltr">{(Array.isArray(booking.seats) ? booking.seats : [booking.seats].filter(Boolean)).join(", ")}</span>} />
          <Row k={t("booking.ref")} v={<span dir="ltr" style={{ fontFamily: "monospace", color: C.lavender }}>{booking.ref}</span>} />
          <Row k={t("booking.total")} v={<span dir="ltr">{formatCurrency(booking.total ?? booking.refundAmount, booking.currency || "AED")}</span>} />
        </div>
        <BookingQRCode booking={{ ...booking, cancelled: isCancelled }} />
        {!isCancelled && confirmingCancellation ? (
          <div role="group" aria-label={t("booking.cancelConfirmationLabel")} style={{ borderTop: "1px solid rgba(255,255,255,.12)", padding: 14 }}>
            <p style={{ margin: 0, color: "rgba(255,255,255,.72)", fontSize: 12, lineHeight: 1.5 }}>
              {t("booking.cancelQuestion", { ref: booking.ref, amount: formatCurrency(booking.total ?? booking.refundAmount, booking.currency || "AED") })}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setConfirmingCancellation(false)} style={{ border: "1px solid rgba(255,255,255,.14)", borderRadius: 8, background: "transparent", padding: "8px 12px", color: "rgba(255,255,255,.72)", cursor: "pointer" }}>{t("common.back")}</button>
              <button type="button" onClick={onCancel} style={{ border: 0, borderRadius: 8, background: C.magenta, padding: "8px 12px", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t("booking.confirmCancel")}</button>
            </div>
          </div>
        ) : !isCancelled ? (
          <button type="button" onClick={() => setConfirmingCancellation(true)} style={{ ...cardFootBtn, color: "rgba(255,255,255,.7)" }}>
            <RotateCcw size={14} /> {t("booking.cancelRefund")}
          </button>
        ) : (
          <div style={{ ...cardFootBtn, color: C.green, cursor: "default" }}>
            <Check size={14} /> {t("booking.refundAmount", { amount: formatCurrency(booking.total ?? booking.refundAmount, booking.currency || "AED") })}
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
const rowBtn = { display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.03)", padding: "12px 16px", textAlign: "start", cursor: "pointer" };
const cardFootBtn = { display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,.12)", padding: "12px 0", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" };
