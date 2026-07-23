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
export const CANCELLATION_TARGET_SELECTION_PURPOSE = "cancellation_target_selection";
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

const bookingCreatedAtTimestamp = (booking) => {
  const timestamp = Date.parse(booking?.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export function sortBookingsForDisplay(bookings) {
  return (Array.isArray(bookings) ? bookings : [])
    .map((booking, originalIndex) => ({ booking, originalIndex }))
    .sort((left, right) => (
      bookingCreatedAtTimestamp(right.booking) - bookingCreatedAtTimestamp(left.booking)
      || left.originalIndex - right.originalIndex
    ))
    .map(({ booking }) => booking);
}

const ACTIVE_HISTORY_EN = /\b(?:current|active|upcoming)\s+(?:booking|bookings|reservation|reservations|tickets?)\b|\bmy\s+(?:current|active|upcoming)\s+(?:booking|bookings|reservation|reservations|tickets?)\b/;
const ACTIVE_HISTORY_AR = /(?:حجوزاتي|حجوزات(?:ي)?|حجزي|الحجوزات|الحجز)\s+(?:الحاليه|الحالي|النشطه|النشط|القادمه|القادم)/;
const GENERIC_HISTORY_EN = /\b(?:show|open|find|view|list)\s+(?:(?:me|my)\s+)?(?:booking|bookings|booking history|purchase history|reservations?|tickets?)\b|\b(?:my|past|previous)\s+(?:bookings?|booking history|reservations?|tickets?)\b|\bbooking history\b|\bdo\s+i\s+have\s+(?:any\s+)?(?:bookings?|reservations?|tickets?)\b|\bwhat\s+(?:bookings?|reservations?|tickets?)\s+do\s+i\s+have\b|\bwhat\s+are\s+my\s+(?:bookings?|reservations?|tickets?)\b|\bare\s+there\s+any\s+(?:bookings?|reservations?|tickets?)\b/;
const CANCELLABLE_HISTORY_EN = /\bdo\s+i\s+have\s+(?:any\s+)?(?:bookings?|reservations?|tickets?)\s+(?:that\s+i\s+can|to)\s+(?:cancel|refund|void)\b|\b(?:show|list|view)\s+(?:me\s+)?(?:the\s+)?(?:bookings?|reservations?|tickets?)\s+(?:that\s+)?i\s+can\s+(?:cancel|refund|void)\b|\b(?:which|what)\s+(?:bookings?|reservations?|tickets?)\s+can\s+i\s+(?:cancel|refund|void)\b|\bcancellable\s+(?:bookings?|reservations?|tickets?)\b/;
const GENERIC_HISTORY_AR = /(?:اعرض|افتح|طلع|ورني|اظهر).{0,30}(?:حجوزاتي|حجزي|سجل الحجوزات|سجل المشتريات|الحجوزات)|(?:حجوزاتي|سجل الحجوزات)/;

const NATURAL_HISTORY_AR = /هل\s+(?:لدي|عندي)\s+(?:اي\s+)?(?:حجوزات|حجز|تذاكر)|ما\s+(?:هي\s+)?(?:حجوزاتي|حجوزات|تذاكري)|(?:اعرض|اظهر|افتح|ورني).{0,30}(?:تذاكري|التذاكر)/u;
const CANCELLABLE_HISTORY_AR = /هل\s+(?:لدي|عندي)\s+(?:اي\s+)?(?:حجوزات|حجز|تذاكر).{0,25}(?:يمكنني|اقدر)\s+(?:الغاؤها|الغاها|الغيها)|(?:اعرض|اظهر|افتح|ورني).{0,25}(?:حجوزات|تذاكر).{0,25}(?:يمكنني|اقدر)\s+(?:الغاؤها|الغاها|الغيها)|ما\s+(?:هي\s+)?(?:الحجوزات|حجوزاتي|التذاكر).{0,25}(?:يمكنني|اقدر)\s+(?:الغاؤها|الغاها|الغيها)/u;
const TARGETED_HISTORY_SELECTION_EN = /\b(?:open|view|select|choose|pick|show)\s+(?:the\s+)?booking\s+(?!history\b)(?:reference\s+|ref\s+)?[\p{L}\p{N}]/u;

const POLICY_EN = /\b(?:policy|rules?|deadline|eligible|eligibility|possible)\b|\b(?:can|could|may|should)\s+i\s+(?:please\s+)?(?:cancel|refund|void)\b|\b(?:am\s+i|would\s+i\s+be)\s+able\s+to\s+(?:cancel|refund|void)\b|\b(?:how|what|when|where|why)\b.{0,45}\b(?:cancel|refund|void)\b/;
const POLICY_AR = /(?:سياسه|شروط|موعد|اهليه|كيف).{0,35}(?:الغاء|الغي|استرداد|استرجاع)|(?:هل|اقدر|يمكنني).{0,20}(?:الغاء|الغي)\s+(?:ال)?(?:حجز|تذكره)(?:\s|$)/;
const DIRECT_EN = /\b(?:please\s+)?(?:cancel|refund|void)\s+(?:(?:my|the|this|a|an|one)\s+)?(?:(?:current|active|upcoming)\s+)?(?:booking|reservation|tickets?)\b|\b(?:please\s+)?(?:cancel|refund|void)\s+(?:my|the)\s+.{1,80}\s+(?:booking|reservation|tickets?)\b|\b(?:i|we)\s+(?:want|need|would like)\s+to\s+(?:cancel|refund|void)\b|\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:cancel|refund|void)\b.{0,50}\b(?:my|our|this|the|a|an|one)\s+(?:(?:current|active|upcoming)\s+)?(?:booking|reservation|tickets?)\b|\b(?:cancel|refund|void)\b.{0,40}\b(?:booking\s+(?:reference|ref)|wl[a-z0-9-]+)\b/;
const IMPLIED_TARGET_DIRECT_EN = /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:cancel|refund|void)\s+[\p{L}\p{N}]|\b(?:id|wed)\s+like\s+to\s+(?:cancel|refund|void)\s+[\p{L}\p{N}]|\bi\s+(?:want|need)\s+(?:a|the)?\s*refund\s+(?:for\s+)?[\p{L}\p{N}]|\bi\s+no\s+longer\s+want\s+.{1,80}\b(?:booking|reservation|tickets?)\b/u;
const TARGETED_DIRECT_EN = /^(?:please\s+)?(?:cancel|refund|void)\s+.{1,120}$/;
const NEGATED_DIRECT_EN = /\b(?:do\s+not|dont|never|no\s+longer)\b.{0,30}\b(?:cancel|refund|void)\b/;
const NEGATED_DIRECT_AR = /(?:^|\s)(?:لا\s+(?:(?:(?:اريدك?|ابي|ابغي|ابغى|عايز|بدي)\s+(?:ان\s+)?)|(?:تقم\s+ب?)?)|ما\s+(?:اريد|ابي|ابغي|ابغى|عايز|بدي)\s+(?:ان\s+)?)ب?(?:الغي|الغ|الغاء|تلغي|ترجع|تسترد|استرد|استرجع)(?=\s|$)/u;
const DIRECT_AR = /(?:الغي|الغ|الغاء|لغي|رجع|استرد|استرجع).{0,40}(?:حجزي|حجز|الحجز|تذكرتي|تذاكري|تذاكر|التذاكر)|(?:ابي|ابغي|ابغى|عايز|بدي|اريد).{0,25}(?:الغي|الغ|الغاء|استرد|استرجع)|(?:هل\s+)?(?:يمكنك|تقدر|تستطيع|ممكن).{0,20}(?:تلغي|الغاء|ترجع|تسترد).{0,30}(?:حجزي|حجز|الحجز|تذكرتي|تذاكري|تذاكر|التذاكر)/;
const IMPLIED_TARGET_DIRECT_AR = /^(?:ممكن\s+)?(?:الغي|الغ|لغي|تلغي|رجع|استرد|استرجع)\s+(?:(?:حجزي|حجز|الحجز|تذكرتي|تذاكري|تذاكر|التذاكر)\s+)?[\p{L}\p{N}]/u;
const CONTEXTUAL_EN = /^(?:please\s+)?(?:cancel|refund|void)(?:\s+(?:it|this|that))?$/;
const CONTEXTUAL_AR = /^(?:الغي|الغه|الغيه|الغيها|الغاءه|لغه|رجعه|استرده|نعم\s+الغي(?:ه|ها)?)$/;

export function classifyBookingHistoryRequest(text) {
  const query = normalizeText(text);
  if (!query) return Object.freeze({ requested: false, activeOnly: false });
  if (TARGETED_HISTORY_SELECTION_EN.test(query)) return Object.freeze({ requested: false, activeOnly: false });
  if (CANCELLABLE_HISTORY_EN.test(query) || CANCELLABLE_HISTORY_AR.test(query)) {
    return Object.freeze({ requested: true, activeOnly: true });
  }
  if (/\bcancellation\b/.test(query)) return Object.freeze({ requested: false, activeOnly: false });
  if (/\b(?:cancel|refund|void)\b|(?:الغي|الغاء|لغي|استرد|استرجع)/.test(query)) {
    return Object.freeze({ requested: false, activeOnly: false });
  }
  const activeOnly = ACTIVE_HISTORY_EN.test(query) || ACTIVE_HISTORY_AR.test(query);
  const requested = activeOnly || GENERIC_HISTORY_EN.test(query) || GENERIC_HISTORY_AR.test(query) || NATURAL_HISTORY_AR.test(query);
  return Object.freeze({ requested, activeOnly });
}

export function isDirectCancellationRequest(text, { hasBookingContext = false } = {}) {
  const query = normalizeText(text);
  if (!query) return false;
  if (POLICY_EN.test(query) || POLICY_AR.test(query)) return false;
  if (NEGATED_DIRECT_EN.test(query) || NEGATED_DIRECT_AR.test(query)) return false;
  if (DIRECT_EN.test(query) || IMPLIED_TARGET_DIRECT_EN.test(query) || DIRECT_AR.test(query) || IMPLIED_TARGET_DIRECT_AR.test(query)) return true;
  if (TARGETED_DIRECT_EN.test(query) && !CONTEXTUAL_EN.test(query)) return true;
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

const bookingTitle = (booking) => String(booking?.movieTitle || booking?.movie || "").trim();

const SPOKEN_NUMBER_TOKENS = Object.freeze({
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
});

const normalizeCancellationSelector = (value) => normalizeText(value)
  .replace(/\band\b/g, " ")
  .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => SPOKEN_NUMBER_TOKENS[word] || word)
  .replace(/^(?:please\s+)?(?:select|choose|pick|cancel)\s+(?:(?:the|my)\s+)?(?:(?:booking|reservation|tickets?)\s+)?(?:for\s+)?/, "")
  .replace(/^the\s+/, "")
  .replace(/\s+(?:booking|reservation|tickets?)$/, "")
  .replace(/\s+/g, " ")
  .trim();

const leavesCancellationTargetSelection = (query) => NEGATED_DIRECT_AR.test(query)
  || /^(?:(?:go\s+)?back|never\s*mind|stop|keep\s+(?:it|them|the\s+booking)|do\s+not\s+cancel|dont\s+cancel|start\s+over|new\s+conversation|show|find|browse|book|watch|what|how|why|when|where|which)(?:\s|$)/.test(query)
  || /^(?:ارجع|رجوع|تراجع|لا\s+تلغ|لا\s+تلغي|ابدأ\s+من\s+جديد|محادثة\s+جديدة|اعرض|أعرض|اظهر|أظهر|ابحث|احجز|ماذا|ما|كيف|لماذا|متى|اين|أين)(?:\s|$)/u.test(query);

const BOOKING_INFORMATION_QUESTION = /\b(?:tell\s+me|explain)\b.{0,30}\babout\b|\b(?:about|synopsis|plot|rating|rated|runtime|duration|cast|actor|director|genre|language|review)\b|(?:اخبرني|اشرح).{0,30}(?:عن)|(?:نبذه|قصه|تقييم|مده|طاقم|ممثل|مخرج|نوع|لغه)/u;

export async function resolveCancellationContinuation({
  text = "",
  stage = null,
  storedBookings = [],
  now = new Date(),
  bypassForFaq = false,
} = {}) {
  const candidateRefs = [...new Set(
    (Array.isArray(stage?.candidateRefs) ? stage.candidateRefs : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  )];
  const active = stage?.view === "history"
    && stage?.purpose === CANCELLATION_TARGET_SELECTION_PURPOSE
    && candidateRefs.length > 0;
  if (!active) {
    return Object.freeze({
      handled: false,
      bookingRef: null,
      reason: "inactive",
      candidates: [],
    });
  }
  if (bypassForFaq) {
    return Object.freeze({
      handled: false,
      bookingRef: null,
      reason: "faq_question",
      candidates: [...candidateRefs],
    });
  }

  const bookings = Array.isArray(storedBookings) ? storedBookings.filter(Boolean) : [];
  const displayed = candidateRefs
    .map((candidateRef) => bookings.find((booking) => refKey(booking?.ref) === refKey(candidateRef)))
    .filter(Boolean);
  const query = normalizeText(text);
  const queryTokens = new Set(query.split(" ").filter(Boolean));
  const referenceMatches = displayed.filter((booking) => {
    const normalizedRef = normalizeText(booking?.ref);
    return normalizedRef && (query === normalizedRef || queryTokens.has(normalizedRef));
  });
  if (referenceMatches.length === 1) {
    return Object.freeze({
      handled: true,
      bookingRef: referenceMatches[0].ref,
      reason: "matched_reference",
      candidates: [referenceMatches[0].ref],
    });
  }

  const selector = normalizeCancellationSelector(query);
  const titleMatches = selector
    ? displayed.filter((booking) => normalizeCancellationSelector(bookingTitle(booking)) === selector)
    : [];
  if (titleMatches.length === 1) {
    return Object.freeze({
      handled: true,
      bookingRef: titleMatches[0].ref,
      reason: "matched_unique_title",
      candidates: [titleMatches[0].ref],
    });
  }
  if (titleMatches.length > 1) {
    return Object.freeze({
      handled: true,
      bookingRef: null,
      reason: "ambiguous_movie_title",
      candidates: titleMatches.map((booking) => booking.ref),
    });
  }

  const { resolveConversationalCancellation } = await import("./conversationalCancellationResolver.js");
  const naturalSelection = resolveConversationalCancellation({
    text,
    bookings: displayed,
    displayedBookingRefs: candidateRefs,
    now,
  });
  if (naturalSelection.status === "unique" && naturalSelection.bookingRef && naturalSelection.matchedBy.length) {
    return Object.freeze({
      handled: true,
      bookingRef: naturalSelection.bookingRef,
      reason: "matched_conversational_selector",
      candidates: [naturalSelection.bookingRef],
    });
  }
  if (naturalSelection.status === "ambiguous" && naturalSelection.matchedBy.length) {
    return Object.freeze({
      handled: true,
      bookingRef: null,
      reason: "ambiguous_conversational_selector",
      candidates: [...naturalSelection.candidateRefs],
    });
  }

  if (leavesCancellationTargetSelection(query)) {
    return Object.freeze({
      handled: false,
      bookingRef: null,
      reason: "explicit_context_change",
      candidates: displayed.map((booking) => booking.ref),
    });
  }

  return Object.freeze({
    handled: true,
    bookingRef: null,
    reason: displayed.length ? "no_displayed_candidate_match" : "displayed_candidates_unavailable",
    candidates: displayed.map((booking) => booking.ref),
  });
}

export async function resolveHistoryContinuation({
  text = "",
  stage = null,
  storedBookings = [],
  now = new Date(),
  bypassForFaq = false,
} = {}) {
  const stageRefs = [...new Set(
    (Array.isArray(stage?.bookings) ? stage.bookings : [])
      .map((booking) => String(booking?.ref || "").trim())
      .filter(Boolean),
  )];
  const fallbackBookings = stage?.view === "history" && !stageRefs.length
    ? (Array.isArray(storedBookings) ? storedBookings : [])
      .filter((booking) => stage?.historyFilter !== "active" || isCurrentBooking(booking, { now }))
    : [];
  const displayedRefs = stageRefs.length
    ? stageRefs
    : [...new Set(fallbackBookings.map((booking) => String(booking?.ref || "").trim()).filter(Boolean))];
  const active = stage?.view === "history"
    && stage?.purpose !== CANCELLATION_TARGET_SELECTION_PURPOSE
    && displayedRefs.length > 0;
  if (!active) {
    return Object.freeze({ handled: false, bookingRef: null, reason: "inactive", candidates: [] });
  }
  if (bypassForFaq) {
    return Object.freeze({ handled: false, bookingRef: null, reason: "faq_question", candidates: displayedRefs });
  }

  const query = normalizeText(text);
  if (!query || isDirectCancellationRequest(text, { hasBookingContext: true })) {
    return Object.freeze({ handled: false, bookingRef: null, reason: "other_intent", candidates: displayedRefs });
  }

  const displayedKeys = new Set(displayedRefs.map(refKey));
  const displayed = (Array.isArray(storedBookings) ? storedBookings : [])
    .filter((booking) => displayedKeys.has(refKey(booking?.ref)));
  const { resolveConversationalCancellation } = await import("./conversationalCancellationResolver.js");
  const selection = resolveConversationalCancellation({
    text,
    bookings: displayed,
    displayedBookingRefs: displayedRefs,
    now,
    ignoreLifecycle: true,
  });
  const explicitBookingSelector = selection.matchedBy.some((criterion) => ["reference", "ordinal"].includes(criterion))
    || /\b(?:booking|reservation)\b|(?:الحجز|حجز|الحجوزات)/u.test(query);
  if (BOOKING_INFORMATION_QUESTION.test(query) && !explicitBookingSelector) {
    return Object.freeze({ handled: false, bookingRef: null, reason: "movie_information", candidates: displayedRefs });
  }
  if (selection.status === "unique" && selection.bookingRef && selection.matchedBy.length) {
    return Object.freeze({
      handled: true,
      bookingRef: selection.bookingRef,
      reason: "matched_history_booking",
      candidates: [selection.bookingRef],
    });
  }
  if (selection.status === "ambiguous" && selection.matchedBy.length) {
    return Object.freeze({
      handled: true,
      bookingRef: null,
      reason: "ambiguous_history_booking",
      candidates: [...selection.candidateRefs],
      differentiators: [...selection.differentiators],
    });
  }
  const shortSelector = query.split(/\s+/).filter(Boolean).length <= 10 && !leavesCancellationTargetSelection(query);
  return Object.freeze({
    handled: shortSelector || selection.matchedBy.length > 0,
    bookingRef: null,
    reason: selection.reason || "no_displayed_booking_match",
    candidates: displayedRefs,
  });
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

  const titleSelector = normalizeCancellationSelector(text);
  const titleMatches = titleSelector
    ? bookings.filter((booking) => normalizeCancellationSelector(bookingTitle(booking)) === titleSelector)
    : [];
  const currentTitleMatches = titleMatches.filter((booking) => isCurrentBooking(booking, { now }));
  if (currentTitleMatches.length === 1 || (currentTitleMatches.length === 0 && titleMatches.length === 1)) {
    const titleBooking = currentTitleMatches[0] || titleMatches[0];
    return Object.freeze({
      bookingRef: titleBooking.ref,
      booking: titleBooking,
      source: "spoken_title",
      reason: titleBooking.cancelled
        ? "already_cancelled"
        : !isCurrentBooking(titleBooking, { now })
          ? "not_current_booking"
          : null,
      candidates: [titleBooking.ref],
    });
  }
  if (currentTitleMatches.length > 1) {
    return Object.freeze({
      bookingRef: null,
      booking: null,
      source: "spoken_title",
      reason: "multiple_active_bookings",
      candidates: currentTitleMatches.map((booking) => booking.ref),
    });
  }
  if (titleMatches.length > 1) {
    return Object.freeze({
      bookingRef: null,
      booking: null,
      source: "spoken_title",
      reason: "no_active_booking",
      candidates: [],
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
  const safe = sortBookingsForDisplay(bookings).map((booking, index) => ({
    listPosition: index + 1,
    bookingRef: String(booking?.ref || ""),
    status: booking?.cancelled ? "cancelled" : booking?.bookingStatus || booking?.status || "active",
    movie: String(booking?.movieTitle || ""),
    performanceDate: booking?.performanceDate || booking?.sourceDate || booking?.date || null,
    showtime: booking?.showtime || null,
    cinema: booking?.cinemaName || booking?.cinema?.name || (typeof booking?.cinema === "string" ? booking.cinema : null),
  }));
  return `Visible on-device booking summaries: ${JSON.stringify(safe)}. These are device records, not provider confirmations.`;
}
