const normalizeText = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\u064b-\u065f\u0670]/g, "")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/[’'`]/g, "")
  .replace(/[^\p{L}\p{N}+#-]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const refKey = (value) => String(value || "").trim().toUpperCase();
const DUBAI_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dubaiClockParts = (value) => Object.fromEntries(
  DUBAI_CLOCK.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
);

const performanceDateKey = (value) => {
  const direct = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = dubaiClockParts(parsed);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function isCurrentBooking(booking, { now = new Date() } = {}) {
  if (!booking || booking.cancelled) return false;
  const status = normalizeText(booking.bookingStatus || booking.status || "");
  if (/\b(?:cancelled|canceled|refunded|voided|expired|failed)\b/.test(status)) return false;

  const dateKey = performanceDateKey(booking.performanceDate || booking.sourceDate || booking.date);
  if (!dateKey) return true;
  const clock = dubaiClockParts(now);
  const todayKey = `${clock.year}-${clock.month}-${clock.day}`;
  if (dateKey !== todayKey) return dateKey > todayKey;

  const time = String(booking.showtime || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!time) return true;
  const performanceMinutes = Number(time[1]) * 60 + Number(time[2]);
  const nowMinutes = Number(clock.hour) * 60 + Number(clock.minute);
  return performanceMinutes >= nowMinutes;
}

const ACTIVE_HISTORY_EN = /\b(?:current|active|upcoming)\s+(?:booking|bookings|reservation|reservations|tickets?)\b|\bmy\s+(?:current|active|upcoming)\s+(?:booking|bookings|reservation|reservations|tickets?)\b/;
const ACTIVE_HISTORY_AR = /(?:حجوزاتي|حجوزات(?:ي)?|حجزي|الحجوزات|الحجز)\s+(?:الحاليه|الحالي|النشطه|النشط|القادمه|القادم)/;
const GENERIC_HISTORY_EN = /\b(?:show|open|find|view|list)\s+(?:(?:me|my)\s+)?(?:booking|bookings|booking history|purchase history|reservations?)\b|\b(?:my|past|previous)\s+(?:bookings?|booking history|reservations?)\b|\bbooking history\b/;
const GENERIC_HISTORY_AR = /(?:اعرض|افتح|طلع|ورني|اظهر).{0,30}(?:حجوزاتي|حجزي|سجل الحجوزات|سجل المشتريات|الحجوزات)|(?:حجوزاتي|سجل الحجوزات)/;

const POLICY_EN = /\b(?:policy|rules?|deadline|eligible|eligibility|possible)\b|\b(?:can|could)\s+i\s+(?:cancel|refund|void)\s+(?:a|any)\s+(?:booking|reservation|tickets?)\b|\bhow\s+(?:do|does|can)\b.{0,35}\b(?:cancel|refund|void)\b/;
const POLICY_AR = /(?:سياسه|شروط|موعد|اهليه|كيف).{0,35}(?:الغاء|الغي|استرداد|استرجاع)|(?:هل|اقدر|يمكنني).{0,20}(?:الغاء|الغي)\s+(?:ال)?(?:حجز|تذكره)(?:\s|$)/;
const DIRECT_EN = /\b(?:please\s+)?(?:cancel|refund|void)\s+(?:(?:my|the|this)\s+)?(?:(?:current|active|upcoming)\s+)?(?:booking|reservation|tickets?)\b|\b(?:i|we)\s+(?:want|need|would like)\s+to\s+(?:cancel|refund|void)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:cancel|refund|void)\b.{0,50}\b(?:my|our|this|the)\s+(?:(?:current|active|upcoming)\s+)?(?:booking|reservation|tickets?)\b|\b(?:cancel|refund|void)\b.{0,40}\b(?:booking\s+(?:reference|ref)|wl[a-z0-9-]+)\b/;
const DIRECT_AR = /(?:الغي|الغي|الغاء|لغي|رجع|استرد|استرجع).{0,40}(?:حجزي|الحجز|تذكرتي|تذاكري|التذاكر)|(?:ابي|ابغي|ابغى|عايز|بدي|اريد).{0,25}(?:الغي|الغاء|استرد|استرجع)|(?:هل\s+)?(?:يمكنك|تقدر|تستطيع).{0,20}(?:تلغي|الغاء|ترجع|تسترد).{0,30}(?:حجزي|الحجز|تذكرتي|تذاكري|التذاكر)/;
const CONTEXTUAL_EN = /^(?:please\s+)?(?:cancel|refund|void)(?:\s+(?:it|this|that))?$/;
const CONTEXTUAL_AR = /^(?:الغي|الغه|الغيه|الغيها|الغاءه|لغه|رجعه|استرده|نعم\s+الغي(?:ه|ها)?)$/;

export function classifyBookingHistoryRequest(text) {
  const query = normalizeText(text);
  if (!query) return Object.freeze({ requested: false, activeOnly: false });
  if (/\b(?:cancel|refund|void)\b|(?:الغي|الغاء|لغي|استرد|استرجع)/.test(query)) {
    return Object.freeze({ requested: false, activeOnly: false });
  }
  const activeOnly = ACTIVE_HISTORY_EN.test(query) || ACTIVE_HISTORY_AR.test(query);
  const requested = activeOnly || GENERIC_HISTORY_EN.test(query) || GENERIC_HISTORY_AR.test(query);
  return Object.freeze({ requested, activeOnly });
}

export function isDirectCancellationRequest(text, { hasBookingContext = false } = {}) {
  const query = normalizeText(text);
  if (!query) return false;
  if (POLICY_EN.test(query) || POLICY_AR.test(query)) return false;
  if (DIRECT_EN.test(query) || DIRECT_AR.test(query)) return true;
  return Boolean(hasBookingContext && (CONTEXTUAL_EN.test(query) || CONTEXTUAL_AR.test(query)));
}

function matchExplicitReference(text, bookings) {
  const query = normalizeText(text);
  if (!query) return null;
  const known = bookings.find((booking) => {
    const ref = normalizeText(booking?.ref);
    return ref && ` ${query} `.includes(` ${ref} `);
  });
  if (known?.ref) return String(known.ref).trim();
  return String(text || "").match(/\bWL[A-Z0-9][A-Z0-9-]{2,}\b/i)?.[0] || null;
}

export function resolveCancellationTarget({
  requestedRef = "",
  text = "",
  visibleBooking = null,
  storedBookings = [],
  now = new Date(),
} = {}) {
  const bookings = Array.isArray(storedBookings) ? storedBookings.filter(Boolean) : [];
  const explicitRef = String(requestedRef || matchExplicitReference(text, bookings) || "").trim();
  if (explicitRef) {
    const explicitBooking = bookings.find((booking) => refKey(booking?.ref) === refKey(explicitRef)) || null;
    return Object.freeze({
      bookingRef: explicitBooking?.ref || explicitRef,
      booking: explicitBooking,
      source: requestedRef ? "requested_ref" : "spoken_ref",
      reason: explicitBooking?.cancelled
        ? "already_cancelled"
        : explicitBooking && !isCurrentBooking(explicitBooking, { now })
          ? "not_current_booking"
          : null,
      candidates: [explicitBooking?.ref || explicitRef],
    });
  }

  if (visibleBooking?.ref) {
    return Object.freeze({
      bookingRef: visibleBooking.ref,
      booking: visibleBooking,
      source: "visible_booking",
      reason: visibleBooking.cancelled
        ? "already_cancelled"
        : !isCurrentBooking(visibleBooking, { now })
          ? "not_current_booking"
          : null,
      candidates: [visibleBooking.ref],
    });
  }

  const active = bookings.filter((booking) => booking?.ref && isCurrentBooking(booking, { now }));
  if (active.length === 1) {
    return Object.freeze({
      bookingRef: active[0].ref,
      booking: active[0],
      source: "sole_active_booking",
      reason: null,
      candidates: [active[0].ref],
    });
  }
  return Object.freeze({
    bookingRef: null,
    booking: null,
    source: null,
    reason: active.length > 1 ? "multiple_active_bookings" : "no_active_booking",
    candidates: active.map((booking) => booking.ref),
  });
}

export function bookingHistoryAgentContext(bookings) {
  const safe = (Array.isArray(bookings) ? bookings : []).map((booking) => ({
    bookingRef: String(booking?.ref || ""),
    status: booking?.cancelled ? "cancelled" : booking?.bookingStatus || "active",
    movie: String(booking?.movieTitle || ""),
    performanceDate: booking?.performanceDate || booking?.sourceDate || booking?.date || null,
  }));
  return `Visible on-device booking summaries: ${JSON.stringify(safe)}. These are device records, not provider confirmations.`;
}
