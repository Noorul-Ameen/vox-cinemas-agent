import React from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, History, RotateCcw, Ticket, X } from "lucide-react";
import { C } from "../theme.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { isCurrentBooking } from "../lib/cancellationRouting.js";

export default function BookingHistory({ bookings = [], onSelect, onBack, onCancel, onRequestCancel, filter = "all" }) {
  const { t, dir, formatCurrency, formatDate } = useI18n();
  const cancelBooking = onCancel || onRequestCancel;
  const activeOnly = filter === "active";
  const visibleBookings = activeOnly ? bookings.filter((booking) => isCurrentBooking(booking)) : bookings;
  const sorted = [...visibleBookings].sort((a, b) => {
    const right = Date.parse(b.createdAt || "") || 0;
    const left = Date.parse(a.createdAt || "") || 0;
    return right - left;
  });

  return (
    <section aria-labelledby="booking-history-title" style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label={t("common.back")} style={iconButton}>
            {dir === "rtl" ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
        <span aria-hidden="true" style={{ display: "grid", width: 34, height: 34, placeItems: "center", borderRadius: 9, background: "rgba(182,24,108,.20)", color: C.lavender }}><History size={17} /></span>
        <div style={{ minWidth: 0 }}>
          <h2 id="booking-history-title" style={{ margin: 0, color: "#fff", fontSize: 16, lineHeight: 1.2 }}>{t(activeOnly ? "history.activeTitle" : "history.title")}</h2>
          <div style={{ marginTop: 2, color: "rgba(255,255,255,.48)", fontSize: 10 }}>{t(activeOnly ? "history.activeSubtitle" : "history.subtitle")}</div>
        </div>
      </header>

      {!sorted.length ? (
        <div role="status" style={{ display: "flex", minHeight: 190, flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(255,255,255,.14)", borderRadius: 14, padding: 24, textAlign: "center", color: "rgba(255,255,255,.5)" }}>
          <Ticket size={28} color={C.lavender} />
          <p style={{ maxWidth: 250, margin: "12px 0 0", fontSize: 12, lineHeight: 1.5 }}>{t(activeOnly ? "history.activeEmpty" : "history.empty")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {sorted.map((booking) => {
            const cancelled = Boolean(booking.cancelled);
            const current = isCurrentBooking(booking);
            const muted = cancelled || !current;
            const isDemo = booking.verified !== true
              || booking.demo === true
              || booking.paymentStatus === "simulated_not_charged"
              || booking.bookingStatus === "confirmed_demo";
            const isDemoCancellation = cancelled && (isDemo || booking.refundStatus === "not_processed_demo");
            const storedPerformanceDate = booking.performanceDate || booking.sourceDate || booking.date;
            const performanceDate = storedPerformanceDate ? formatDate(storedPerformanceDate) : t("booking.unknownDate");
            const cinemaName = booking.cinemaName || t("booking.unknownCinema");
            const statusLabel = isDemoCancellation
              ? t("history.cancelledLocal")
              : cancelled
                ? t("history.cancelled")
                : !current
                  ? t("history.past")
                : isDemo
                  ? t("history.demo")
                  : t("history.active");
            const bookingLabel = booking.movieTitle || booking.ref;
            return (
              <div key={booking.ref} role="group" aria-label={bookingLabel} style={{ width: "100%", overflow: "hidden", borderRadius: 13, border: `1px solid ${muted ? "rgba(255,255,255,.10)" : "rgba(87,199,154,.25)"}`, background: "rgba(255,255,255,.035)" }}>
                <button type="button" onClick={() => onSelect?.(booking)} aria-label={`${t("history.open")}: ${bookingLabel} · ${booking.ref}`} style={{ display: "flex", width: "100%", alignItems: "flex-start", gap: 11, border: 0, background: "transparent", padding: "12px 13px", color: "inherit", textAlign: "start", cursor: "pointer" }}>
                  <span aria-hidden="true" style={{ display: "grid", width: 32, height: 32, flexShrink: 0, placeItems: "center", borderRadius: 9, background: muted ? "rgba(255,255,255,.06)" : "rgba(87,199,154,.12)", color: muted ? "rgba(255,255,255,.45)" : C.green }}>{cancelled ? <X size={15} /> : current ? <Check size={15} /> : <CalendarDays size={15} />}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span dir={booking.movieTitle ? "auto" : "ltr"} style={{ display: "block", overflow: "hidden", color: "#fff", fontSize: 13, fontWeight: 800, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.movieTitle || booking.ref}</span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: "3px 7px", marginTop: 4, color: "rgba(255,255,255,.48)", fontSize: 10 }}>
                      <span dir="ltr" style={{ fontFamily: "monospace", color: C.lavender }}>{booking.ref}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><CalendarDays size={10} />{performanceDate}</span>
                      {booking.showtime && <span dir="ltr">{booking.showtime}</span>}
                      {booking.seats?.length > 0 && <span dir="ltr">{booking.seats.join(", ")}</span>}
                    </span>
                    <span dir="auto" style={{ display: "block", overflow: "hidden", marginTop: 4, color: "rgba(255,255,255,.56)", fontSize: 10, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cinemaName}</span>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 7 }}>
                      <span style={{ borderRadius: 999, background: muted ? "rgba(255,255,255,.07)" : "rgba(87,199,154,.13)", padding: "3px 7px", color: muted ? "rgba(255,255,255,.55)" : C.green, fontSize: 9, fontWeight: 800 }}>{statusLabel}</span>
                      <span dir="ltr" style={{ color: "rgba(255,255,255,.68)", fontSize: 11, fontWeight: 700 }}>{formatCurrency(booking.total ?? booking.refundAmount, booking.currency || "AED")}</span>
                    </span>
                  </span>
                  {dir === "rtl" ? <ChevronLeft size={16} color="rgba(255,255,255,.35)" /> : <ChevronRight size={16} color="rgba(255,255,255,.35)" />}
                </button>
                {current && cancelBooking && (
                  <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,.08)", padding: "7px 9px" }}>
                    <button type="button" onClick={() => cancelBooking(booking)} aria-label={`${t("history.cancel")}: ${bookingLabel} · ${booking.ref}`} style={{ display: "inline-flex", minHeight: 34, alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, background: "rgba(182,24,108,.10)", padding: "7px 10px", color: "rgba(255,255,255,.78)", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                      <RotateCcw size={12} /> {t("history.cancel")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const iconButton = { display: "grid", width: 32, height: 32, flexShrink: 0, placeItems: "center", border: 0, borderRadius: 8, outlineOffset: 2, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.65)", cursor: "pointer" };
