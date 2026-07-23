import {
  classifyBookingHistoryRequest,
  isDirectCancellationRequest,
} from "../lib/cancellationRouting.js";

export function normalizeFaqText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ڤ/g, "ف")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRIVATE_EVENT_HINT = /\b(?:private|group|birthday|corporate|event|screening)\b|(?:عرض خاص|حجز مجموعة|حفلة عيد ميلاد|فعالية شركة|سينما كاملة)/;
const CANCELLATION_POLICY_HINT = /\b(?:can|could|how|when|where|policy|rules?|deadline|eligible|eligibility|possible)\b.{0,55}\b(?:cancel|refund|exchange)\b|\b(?:refund|cancellation)\s+(?:policy|rules?|deadline|eligibility)\b|(?:كيف|هل|سياسه|سياسة|شروط|متى|موعد|اقدر|أقدر|يمكن).{0,45}(?:الغاء|إلغاء|الغي|ألغي|استرداد|استرجاع)|(?:شروط|سياسه|سياسة|موعد).{0,30}(?:الاسترداد|الاسترجاع|الالغاء|الإلغاء)/;
const CANCELLATION_REQUEST_TO_ASSISTANT_HINT = /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:cancel|refund|void)\b.{0,40}\b(?:my|our|this|the)\s+(?:booking|reservation|tickets?)\b|(?:هل\s+)?(?:يمكنك|تقدر|تستطيع)\s+(?:ان\s+)?(?:تلغي|الغاء|ترجع|تسترد).{0,30}(?:حجزي|الحجز|تذكرتي|تذاكري|التذاكر)/;
const CANCELLATION_ACTION_HINT = /\b(?:please\s+)?(?:cancel|refund|void)\s+(?:(?:my|the|this)\s+)?(?:booking|reservation|tickets?)\b|\b(?:i|we)\s+(?:want|need|would like)\s+to\s+(?:cancel|refund|void)\b|\b(?:cancel|refund|void)\b.{0,40}\b(?:booking\s+(?:reference|ref)|wl[a-z0-9]+)\b|(?:الغي|ألغي|لغي|الغاء|إلغاء|رجع|استرد|استرجع).{0,35}(?:حجزي|الحجز|تذكرتي|تذاكري|التذاكر)|(?:ابي|أبي|ابغي|أبغي|ابغى|أبغى|عايز|بدي).{0,25}(?:الغي|ألغي|استرد|استرجع)/;
const BOOKING_HISTORY_ACTION_HINT = /\b(?:show|open|find|view)\s+(?:(?:me|my)\s+)?(?:booking|bookings|booking history|purchase history)\b|(?:اعرض|أعرض|افتح|أفتح|طلع|ورني).{0,30}(?:حجوزاتي|حجزي|سجل الحجوزات|سجل المشتريات)/;
const BOOKING_ACTION_HINT = /\b(?:book|reserve|buy|get)\b.{0,45}\b(?:tickets?|seats?|showtimes?|movie|film)\b|\b(?:i|we)\s+(?:want|need|would like)\s+(?:to\s+)?(?:book|reserve)\b|\b(?:show|find)\b.{0,28}\b(?:movies?|films?|showtimes?)\b|\b(?:one|two|three|four|\d+)\s+(?:tickets?|seats?)\b|(?:ابي|أبي|ابغي|أبغي|ابغى|أبغى|عايز|بدي|اريد|أريد).{0,30}(?:احجز|أحجز|حجز|تذكره|تذكرة|تذكرتين|مقعد)|(?:احجز|أحجز|احجزي|حجز لي).{0,30}(?:فيلم|تذكره|تذكرة|مقعد|عرض)/;
const PROGRAMMING_DISCOVERY_HINT = /\b(?:what(?:s| is)?|which\s+movies?|which\s+films?)\b.{0,32}\b(?:showing|playing|on)\b|\b(?:showing|playing)\b.{0,40}\b(?:today|tonight|tomorrow|cinema|movies?|films?)\b|(?:\u0645\u0627\u0630\u0627|\u0645\u0627|\u0648\u0634|\u0627\u064a\u0634).{0,28}(?:\u064a\u0639\u0631\u0636|\u0627\u0644\u0627\u0641\u0644\u0627\u0645|\u0627\u0644\u0639\u0631\u0648\u0636)/;
const FAQ_QUESTION_FORM = /[?\u061f]\s*$|^(?:can|could|do(?:es)?|is|are|what|which|when|where|why|how|tell\s+me|explain)\b|^(?:\u0647\u0644|\u0645\u0627(?:\u0630\u0627)?|\u0645\u062a\u0649|\u0627\u064a\u0646|\u0623\u064a\u0646|\u0643\u064a\u0641|\u0648\u0634|\u0627\u064a\u0634)\s/u;
const FAQ_SUBJECT_HINT = /\b(?:parking|offers?|deals?|discounts?|policy|rules?|terms?|accessibility|wheelchair|food|snacks?|drinks?|refunds?|age\s+rating|opening\s+hours?|support)\b|(?:\u0645\u0648\u0627\u0642\u0641|\u0639\u0631\u0648\u0636|\u062e\u0635\u0645|\u0633\u064a\u0627\u0633\u0629|\u0634\u0631\u0648\u0637|\u0627\u0633\u062a\u0631\u062f\u0627\u062f)/u;
const RECORD_SELECTOR_HINT = /\b(?:first|second|third|last)\s+(?:booking|one)\b|\bbooking\s+(?:reference|ref)\b|(?:\u0627\u0644\u062d\u062c\u0632\s+\u0627\u0644\u0627\u0648\u0644|\u0627\u0644\u062d\u062c\u0632\s+\u0627\u0644\u062b\u0627\u0646\u064a|\u0631\u0642\u0645\s+\u0627\u0644\u062d\u062c\u0632)/u;

export function isGenuineFaqQuestion(queryText, { matches = [] } = {}) {
  if (!Array.isArray(matches) || matches.length === 0) return false;
  const raw = String(queryText || "").normalize("NFKC").toLowerCase().trim();
  const query = normalizeFaqText(raw);
  if (!query) return false;
  const hasFaqSubject = FAQ_SUBJECT_HINT.test(query);
  if (RECORD_SELECTOR_HINT.test(query) && !hasFaqSubject) return false;
  return hasFaqSubject || FAQ_QUESTION_FORM.test(raw);
}

export function classifyFaqActionIntent(queryText) {
  const query = normalizeFaqText(queryText);
  if (!query || PRIVATE_EVENT_HINT.test(query)) return null;
  if (PROGRAMMING_DISCOVERY_HINT.test(query)) return "booking";
  if (isDirectCancellationRequest(queryText)) return "cancellation";
  if (CANCELLATION_REQUEST_TO_ASSISTANT_HINT.test(query)) return "cancellation";
  if (!CANCELLATION_POLICY_HINT.test(query) && CANCELLATION_ACTION_HINT.test(query)) return "cancellation";
  if (classifyBookingHistoryRequest(queryText).requested) return "booking_history";
  if (BOOKING_HISTORY_ACTION_HINT.test(query)) return "booking_history";
  if (BOOKING_ACTION_HINT.test(query)) return "booking";
  return null;
}
