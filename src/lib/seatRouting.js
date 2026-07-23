const ENGLISH_NUMBERS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
});

const ARABIC_NUMBERS = Object.freeze({
  "واحد": 1,
  "واحدة": 1,
  "اثنان": 2,
  "اثنين": 2,
  "اتنين": 2,
  "ثلاثة": 3,
  "ثلاث": 3,
  "أربعة": 4,
  "اربعة": 4,
  "خمس": 5,
  "خمسة": 5,
  "ست": 6,
  "ستة": 6,
  "سبع": 7,
  "سبعة": 7,
  "ثمان": 8,
  "ثمانية": 8,
  "تسع": 9,
  "تسعة": 9,
  "عشر": 10,
  "عشرة": 10,
  "احدعشر": 11,
  "احدعشرة": 11,
  "اثناعشر": 12,
  "اثناعشرة": 12,
});

const CONFIRM_SEATS_EN = /\b(?:these|those|selected|chosen)\s+(?:are\s+)?(?:the\s+)?seats?\b|\b(?:confirm|continue|proceed|done|book)\b.{0,24}\bseats?\b|\bseats?\s+(?:are\s+)?(?:fine|good|correct)\b/;
const CONFIRM_SEATS_AR = /(?:هذه|هذي|تلك)(?:\s+هي)?\s+المقاعد|(?:اكد|أكد|تاكيد|تأكيد|اعتمد|احجز)\s+(?:هذه\s+|هذي\s+)?المقاعد|المقاعد\s+(?:مناسبة|صحيحة|تمام)/;
const SHORT_CONFIRM_SEATS_EN = /^(?:yes|yeah|yep|confirm|continue|proceed|done|ok|okay)(?:\s+please)?$/;
const SHORT_CONFIRM_SEATS_AR = /^(?:نعم|ايوه|أيوه|اكد|أكد|تاكيد|تأكيد|استمر|تابع|متابعة|تم|موافق)(?:\s+(?:من فضلك|لو سمحت))?$/;
const AVAILABILITY_QUESTION = /\b(?:is|are)\b.{0,24}\b(?:available|free|taken|sold)\b|\b(?:available|free)\s*\?|(?:هل|متاح|متوفر|محجوز)/;

const normalizeDigits = (value) => String(value || "")
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const speechTokens = (value) => normalizeDigits(value)
  .normalize("NFKC")
  .replace(/[\u064b-\u065f\u0670]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((token) => {
    const lower = token.toLowerCase();
    return String(ENGLISH_NUMBERS[lower] || ARABIC_NUMBERS[token] || token);
  });

export function normalizeSeatIds(value, availableSeatIds = []) {
  const available = new Set((availableSeatIds || []).map((seat) => String(seat || "").toUpperCase()).filter(Boolean));
  const normalized = speechTokens(Array.isArray(value) ? value.join(" ") : value).join(" ").toUpperCase();
  const seats = [];
  for (const match of normalized.matchAll(/\b([A-Z])\s*(\d{1,2})\b/g)) {
    const seat = `${match[1]}${Number(match[2])}`;
    if ((!available.size || available.has(seat)) && !seats.includes(seat)) seats.push(seat);
  }
  return seats;
}

const normalizeSeatEditContext = (seatEdit, currentSeats = [], availableSeatIds = []) => {
  const available = new Set((availableSeatIds || []).map((seat) => String(seat || "").toUpperCase()).filter(Boolean));
  const operation = ["add", "remove", "replace", "swap"].includes(seatEdit?.operation) ? seatEdit.operation : "replace";
  const normalizedCurrent = normalizeSeatIds(currentSeats).filter((seat) => !available.size || available.has(seat));
  const baselineSeats = normalizeSeatIds(seatEdit?.baselineSeats || [])
    .filter((seat) => !available.size || available.has(seat));
  const amount = Number.isInteger(seatEdit?.amount) && seatEdit.amount > 0 ? seatEdit.amount : null;
  const targetCount = Number.isInteger(seatEdit?.targetCount) && seatEdit.targetCount >= 0
    ? seatEdit.targetCount
    : operation === "add" && amount
      ? (baselineSeats.length || normalizedCurrent.length) + amount
      : operation === "remove" && amount
        ? Math.max(0, (baselineSeats.length || normalizedCurrent.length) - amount)
        : null;
  const sourceSeats = normalizeSeatIds(seatEdit?.sourceSeats || []);
  const targetSeats = normalizeSeatIds(seatEdit?.targetSeats || []);
  return Object.freeze({
    operation,
    amount,
    targetCount,
    baselineSeats,
    currentSeats: normalizedCurrent,
    sourceSeats,
    targetSeats,
  });
};

const explicitSeatEditOperation = (text) => {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  if (/\b(?:add|include)\b|(?:أضف|اضف|إضافة|اضافة|زد)/u.test(normalized)) return "add";
  if (/\b(?:remove|delete|drop|deselect)\b|(?:احذف|إحذف|حذف|أزل|ازل|أنقص|انقص)/u.test(normalized)) return "remove";
  if (/\b(?:replace|swap|change|confirm)\b|(?:استبدل|بدل|غيّر|غير|أكد|اكد)/u.test(normalized)) return "replace";
  if (/\b(?:select|choose|use)\b|(?:اختر|استخدم)/u.test(normalized)) return "select";
  return null;
};

const seatRow = (seat) => String(seat || "").match(/^([A-Z])\d{1,2}$/)?.[1] || null;

const resolveConstrainedAsrSeat = (value, { available, edit }) => {
  const normalized = speechTokens(value).join(" ");
  const match = normalized.match(/^(?:any|annie)\s+(\d{1,2})$/i);
  if (!match) return Object.freeze({ matched: false, seat: null, reason: null });

  // "Any three" can be an ASR rendering of "E three", but it can also mean
  // any three seats. Resolve it only for a one-seat relative edit in a single
  // established row. Every other case stays local and asks for a seat label.
  const workingSeats = edit.currentSeats.length ? edit.currentSeats : edit.baselineSeats;
  const rows = [...new Set(workingSeats.map(seatRow).filter(Boolean))];
  const remaining = edit.targetCount == null ? edit.amount : edit.targetCount - workingSeats.length;
  const safeSingleAdd = edit.operation === "add" && remaining === 1 && rows.length === 1;
  const candidate = safeSingleAdd ? `${rows[0]}${Number(match[1])}` : null;
  if (candidate && available.has(candidate) && !workingSeats.includes(candidate)) {
    return Object.freeze({ matched: true, seat: candidate, reason: null });
  }
  return Object.freeze({ matched: true, seat: null, reason: "ambiguous_spoken_seat" });
};

/**
 * Resolves the next seat-shaped turn after checkout has returned to the seat
 * map for an edit. Relative edits merge with or remove from the retained
 * checkout seats. An explicit full selection remains a replacement.
 */
export function resolveSeatEditSelectionTurn(text, { availableSeatIds = [], currentSeats = [], seatEdit = null } = {}) {
  const normalizedText = normalizeDigits(text).normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670]/g, "");
  const availabilityQuestion = AVAILABILITY_QUESTION.test(normalizedText);
  const available = new Set((availableSeatIds || []).map((seat) => String(seat || "").toUpperCase()).filter(Boolean));
  const edit = normalizeSeatEditContext(seatEdit, currentSeats, availableSeatIds);
  const recognizedSeats = normalizeSeatIds(text);
  const explicitSeats = recognizedSeats.filter((seat) => available.has(seat));
  const invalidSeats = recognizedSeats.filter((seat) => !available.has(seat));
  const asrSeat = explicitSeats.length || invalidSeats.length
    ? Object.freeze({ matched: false, seat: null, reason: null })
    : resolveConstrainedAsrSeat(text, { available, edit });
  const interpretedSeats = asrSeat.seat ? [asrSeat.seat] : explicitSeats;
  const textOperation = explicitSeatEditOperation(text);
  const retainedRelativeOperation = ["add", "remove", "swap"].includes(edit.operation);
  const fullReplacement = edit.operation !== "swap" && (
    textOperation === "replace"
    || (!textOperation && interpretedSeats.length > 1 && !retainedRelativeOperation)
  );
  const operation = edit.operation === "swap"
    ? "swap"
    : fullReplacement
      ? "replace"
      : textOperation === "select"
        ? edit.operation
        : (textOperation || edit.operation);
  const workingSeats = edit.currentSeats.length ? edit.currentSeats : edit.baselineSeats;
  const requested = !availabilityQuestion && Boolean(
    recognizedSeats.length
    || asrSeat.matched
    || textOperation,
  );

  if (!requested) {
    return Object.freeze({
      requested: false,
      operation,
      explicitSeats,
      invalidSeats,
      seats: [],
      baselineSeats: edit.baselineSeats,
      targetCount: edit.targetCount,
      targetMet: false,
      interpretedAsr: false,
      reason: null,
    });
  }
  if (asrSeat.reason) {
    return Object.freeze({
      requested: true,
      operation,
      explicitSeats: [],
      invalidSeats: [],
      seats: [],
      baselineSeats: edit.baselineSeats,
      targetCount: edit.targetCount,
      targetMet: false,
      interpretedAsr: false,
      reason: asrSeat.reason,
    });
  }
  if (invalidSeats.length) {
    return Object.freeze({
      requested: true,
      operation,
      explicitSeats,
      invalidSeats,
      seats: [],
      baselineSeats: edit.baselineSeats,
      targetCount: edit.targetCount,
      targetMet: false,
      interpretedAsr: Boolean(asrSeat.seat),
      reason: "invalid_or_unavailable_seats",
    });
  }
  if (!interpretedSeats.length) {
    return Object.freeze({
      requested: true,
      operation,
      explicitSeats,
      invalidSeats: [],
      seats: [],
      baselineSeats: edit.baselineSeats,
      targetCount: edit.targetCount,
      targetMet: false,
      interpretedAsr: false,
      reason: "seat_label_required",
    });
  }

  const swapSources = edit.sourceSeats.length ? edit.sourceSeats : interpretedSeats.slice(0, 1);
  const swapTargets = edit.targetSeats.length ? edit.targetSeats : interpretedSeats.slice(1);
  const rejectedEdit = (reason, rejectedSeats) => Object.freeze({
    requested: true,
    operation,
    explicitSeats: interpretedSeats,
    invalidSeats: [...new Set(rejectedSeats)],
    seats: [],
    proposedSeats: [...workingSeats],
    baselineSeats: edit.baselineSeats,
    targetCount: workingSeats.length,
    targetMet: false,
    interpretedAsr: Boolean(asrSeat.seat),
    reason,
  });
  if (operation === "add") {
    const alreadySelected = interpretedSeats.filter((seat) => workingSeats.includes(seat));
    if (alreadySelected.length) return rejectedEdit("seat_already_selected", alreadySelected);
  }
  if (operation === "remove") {
    const notSelected = interpretedSeats.filter((seat) => !workingSeats.includes(seat));
    if (notSelected.length) return rejectedEdit("seat_not_selected", notSelected);
  }
  if (operation === "swap") {
    if (!swapSources.length || !swapTargets.length) {
      return rejectedEdit("swap_source_or_target_required", [...swapSources, ...swapTargets]);
    }
    const unselectedSources = swapSources.filter((seat) => !workingSeats.includes(seat));
    if (unselectedSources.length) return rejectedEdit("swap_source_not_selected", unselectedSources);
    const selectedTargets = swapTargets.filter((seat) => workingSeats.includes(seat));
    if (selectedTargets.length) return rejectedEdit("swap_target_already_selected", selectedTargets);
  }
  const seats = operation === "add"
    ? [...new Set([...workingSeats, ...interpretedSeats])]
    : operation === "remove"
      ? workingSeats.filter((seat) => !interpretedSeats.includes(seat))
      : operation === "swap"
        ? [...new Set([...workingSeats.filter((seat) => !swapSources.includes(seat)), ...swapTargets])]
        : interpretedSeats;
  const targetMet = edit.targetCount == null || seats.length === edit.targetCount;
  return Object.freeze({
    requested: true,
    operation,
    explicitSeats: interpretedSeats,
    invalidSeats: [],
    seats: targetMet ? seats : [],
    proposedSeats: seats,
    baselineSeats: edit.baselineSeats,
    targetCount: edit.targetCount,
    targetMet,
    interpretedAsr: Boolean(asrSeat.seat),
    reason: targetMet ? null : "seat_edit_target_not_met",
  });
}

export function resolveSeatToolInput(value, { availableSeatIds = [], currentSeats = [] } = {}) {
  const provided = Array.isArray(value)
    ? value.some((seat) => String(seat ?? "").trim())
    : value != null && Boolean(String(value).trim());
  const available = new Set((availableSeatIds || []).map((seat) => String(seat || "").toUpperCase()).filter(Boolean));
  const recognized = normalizeSeatIds(value);
  const parsed = recognized.filter((seat) => available.has(seat));
  const invalidSeats = recognized.filter((seat) => !available.has(seat));
  const selectedCurrentSeats = normalizeSeatIds(currentSeats).filter((seat) => available.has(seat));
  return Object.freeze({
    provided,
    seats: parsed.length || provided ? parsed : selectedCurrentSeats,
    invalidSeats,
  });
}

export function resolveSeatSelectionTurn(text, { availableSeatIds = [], currentSeats = [] } = {}) {
  const normalizedText = normalizeDigits(text).normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670]/g, "");
  const shortConfirmationText = normalizedText.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const available = new Set((availableSeatIds || []).map((seat) => String(seat || "").toUpperCase()).filter(Boolean));
  const recognizedSeats = normalizeSeatIds(text);
  const explicitSeats = recognizedSeats.filter((seat) => available.has(seat));
  const invalidSeats = recognizedSeats.filter((seat) => !available.has(seat));
  const normalizedCurrentSeats = normalizeSeatIds(currentSeats).filter((seat) => available.has(seat));
  const shortConfirmation = Boolean(normalizedCurrentSeats.length)
    && (SHORT_CONFIRM_SEATS_EN.test(shortConfirmationText) || SHORT_CONFIRM_SEATS_AR.test(shortConfirmationText));
  const confirmation = CONFIRM_SEATS_EN.test(normalizedText) || CONFIRM_SEATS_AR.test(normalizedText) || shortConfirmation;
  const availabilityQuestion = AVAILABILITY_QUESTION.test(normalizedText);
  const selected = explicitSeats.length
    ? explicitSeats
    : confirmation
      ? normalizedCurrentSeats
      : [];
  return Object.freeze({
    requested: Boolean((recognizedSeats.length && !availabilityQuestion) || confirmation),
    confirmation,
    explicitSeats,
    invalidSeats,
    seats: selected,
    reason: invalidSeats.length ? "invalid_or_unavailable_seats" : confirmation && !selected.length ? "no_selected_seats" : null,
  });
}

export const SEAT_TOOL_AUTHORIZATION_TTL_MS = 15_000;

const seatAuthorizationKey = (seats = []) => [...new Set((seats || [])
  .map((seat) => String(seat || "").trim().toUpperCase())
  .filter(Boolean))]
  .sort()
  .join(",");

export function createSeatToolAuthorization({ seats = [], sessionEpoch, stageRevision, planContext, now = Date.now() } = {}) {
  const seatKey = seatAuthorizationKey(seats);
  if (!seatKey) return null;
  return Object.freeze({
    seatKey,
    sessionEpoch,
    stageRevision,
    planContext: planContext == null ? null : String(planContext),
    expiresAt: now + SEAT_TOOL_AUTHORIZATION_TTL_MS,
  });
}

export function matchesSeatToolAuthorization(authorization, { seats = [], sessionEpoch, stageRevision, planContext, now = Date.now() } = {}) {
  if (!authorization || authorization.expiresAt < now) return false;
  return authorization.seatKey === seatAuthorizationKey(seats)
    && authorization.sessionEpoch === sessionEpoch
    && authorization.stageRevision === stageRevision
    && authorization.planContext === (planContext == null ? null : String(planContext));
}
