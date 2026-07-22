const clean = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/\s+/g, " ")
  .replace(/[.!?,،؟]+$/gu, "")
  .trim();

const ENGLISH_EDIT_COUNTS = Object.freeze({
  a: 1,
  an: 1,
  another: 1,
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
});

const ARABIC_EDIT_COUNTS = Object.freeze({
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  ثلاثة: 3,
  ثلاث: 3,
  أربعة: 4,
  اربعة: 4,
  خمسة: 5,
  خمس: 5,
});

const normalizeBaselineSeats = (seats = []) => [...new Set((seats || [])
  .map((seat) => String(seat || "").trim().toUpperCase().replace(/\s+/g, ""))
  .filter((seat) => /^[A-Z]\d{1,2}$/.test(seat)))];

const explicitSeatLabels = (value) => [...new Set([...String(value || "").matchAll(/\b([a-z])\s*(\d{1,2})\b/giu)]
  .map((match) => `${match[1].toUpperCase()}${Number(match[2])}`))];

const normalizedSeatLabel = (row, number) => `${String(row || "").toUpperCase()}${Number(number)}`;

const editCount = (value, fallback = 1) => {
  const token = String(value || "").trim().toLowerCase();
  const parsed = Number(token);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return ENGLISH_EDIT_COUNTS[token] || ARABIC_EDIT_COUNTS[token] || fallback;
};

/**
 * Classifies a seat-edit request made while checkout is retained.
 *
 * `baselineSeats` deliberately travels with the operation. Returning to the
 * seat map is an asynchronous UI transition, so relying on whichever seat
 * state happens to be visible on the next transcript can turn "add E3" into a
 * replacement of E1 and E2. Consumers should retain this object until the
 * requested edit is either applied or explicitly abandoned.
 */
export function resolveCheckoutSeatEditTurn(value, { currentSeats = [] } = {}) {
  const text = clean(value);
  const baselineSeats = normalizeBaselineSeats(currentSeats);
  const explicitSeats = explicitSeatLabels(text);
  if (!text) return Object.freeze({ requested: false, operation: null, amount: null, targetCount: null, baselineSeats, explicitSeats });

  const englishSwap = text.match(/\b(?:replace|change)\s+(?:(?:my|the)\s+)?(?:seat\s+)?([a-z])\s*(\d{1,2})\s+(?:with|for|to)\s+(?:(?:my|the)\s+)?(?:seat\s+)?([a-z])\s*(\d{1,2})\b/iu)
    || text.match(/\bswap\s+(?:(?:my|the)\s+)?(?:seat\s+)?([a-z])\s*(\d{1,2})\s+(?:with|for|to|and)\s+(?:(?:my|the)\s+)?(?:seat\s+)?([a-z])\s*(\d{1,2})\b/iu)
    || text.match(/(?:استبدل|غي(?:ّ)?ر|بدل)\s+(?:المقعد\s+)?([a-z])\s*(\d{1,2})\s+(?:ب|بـ|إلى|الى|مع)\s+(?:المقعد\s+)?([a-z])\s*(\d{1,2})/iu);
  if (englishSwap) {
    const sourceSeats = [normalizedSeatLabel(englishSwap[1], englishSwap[2])];
    const targetSeats = [normalizedSeatLabel(englishSwap[3], englishSwap[4])];
    return Object.freeze({
      requested: true,
      operation: "swap",
      amount: null,
      targetCount: baselineSeats.length,
      baselineSeats,
      explicitSeats,
      sourceSeats,
      targetSeats,
    });
  }

  const add = text.match(/\b(?:add|include)\s+(?:(a|an|another|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+)?(?:more|extra|additional|other|new)?\s*seats?\b/iu)
    || text.match(/\b(?:select|choose|pick)\s+(a|an|another|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:more|extra|additional|other|new)\s+seats?\b/iu)
    || text.match(/\b(?:i\s+(?:want|need|would\s+like)|give\s+me)\s+(a|an|another|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:more|extra|additional)\s+seats?\b/iu)
    || text.match(/\b(?:i\s+(?:want|need|would\s+like)|give\s+me)\s+(another)\s+seats?\b/iu)
    || text.match(/\b(?:add|include)\s+(?:seat\s+)?[a-z]\s*\d{1,2}\b/iu);
  if (add) {
    const newSeatCount = explicitSeats.filter((seat) => !baselineSeats.includes(seat)).length;
    const amount = newSeatCount || editCount(add[1], 1);
    return Object.freeze({
      requested: true,
      operation: "add",
      amount,
      targetCount: baselineSeats.length + amount,
      baselineSeats,
      explicitSeats,
    });
  }

  const arabicAdd = text.match(/(?:أضف|اضف|إضافة|اضافة|زد)\s+(?:(واحد|واحدة|اثنان|اثنين|ثلاثة|ثلاث|أربعة|اربعة|خمسة|خمس|\d+)\s+)?مقعد(?:ا|اً)?(?:\s+(?:آخر|اخر|إضافي|اضافي))?/iu)
    || text.match(/(?:أضف|اضف|إضافة|اضافة)\s+(?:المقعد\s+)?[a-z]\s*\d{1,2}/iu);
  if (arabicAdd) {
    const newSeatCount = explicitSeats.filter((seat) => !baselineSeats.includes(seat)).length;
    const amount = newSeatCount || editCount(arabicAdd[1], 1);
    return Object.freeze({
      requested: true,
      operation: "add",
      amount,
      targetCount: baselineSeats.length + amount,
      baselineSeats,
      explicitSeats,
    });
  }

  const remove = text.match(/\b(?:remove|delete|drop|deselect)\s+(?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+)?(?:of\s+the\s+)?seats?\b/iu)
    || text.match(/\b(?:i\s+(?:want|need|would\s+like))\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:fewer|less)\s+seats?\b/iu)
    || text.match(/\b(?:remove|delete|drop|deselect)\s+(?:seat\s+)?[a-z]\s*\d{1,2}\b/iu);
  if (remove) {
    const existingSeatCount = explicitSeats.filter((seat) => baselineSeats.includes(seat)).length;
    const amount = existingSeatCount || editCount(remove[1], 1);
    return Object.freeze({
      requested: true,
      operation: "remove",
      amount,
      targetCount: Math.max(0, baselineSeats.length - amount),
      baselineSeats,
      explicitSeats,
    });
  }


  const arabicRemove = text.match(/(?:احذف|إحذف|حذف|أزل|ازل|أنقص|انقص)\s+(?:(واحد|واحدة|اثنان|اثنين|ثلاثة|ثلاث|أربعة|اربعة|خمسة|خمس|\d+)\s+)?مقعد(?:ا|اً)?/iu)
    || text.match(/(?:احذف|إحذف|حذف|أزل|ازل)\s+(?:المقعد\s+)?[a-z]\s*\d{1,2}/iu);
  if (arabicRemove) {
    const existingSeatCount = explicitSeats.filter((seat) => baselineSeats.includes(seat)).length;
    const amount = existingSeatCount || editCount(arabicRemove[1], 1);
    return Object.freeze({
      requested: true,
      operation: "remove",
      amount,
      targetCount: Math.max(0, baselineSeats.length - amount),
      baselineSeats,
      explicitSeats,
    });
  }

  const englishReplacement = /\b(?:replace|swap|change|update)(?:\s+(?:my|the))?\s*(?:seats?)?(?:\s+(?:with|to|for))?\s+(?:seat\s+)?[a-z]\s*\d{1,2}\b/iu.test(text);
  const arabicReplacement = /(?:استبدل|استبدال|بدل|غيّر|غير|تغيير)(?:\s+(?:المقاعد|مقاعدي|المقعد))?(?:\s+(?:ب|إلى|الى))?\s*(?:المقعد\s+)?[a-z]\s*\d{1,2}/iu.test(text);
  if ((englishReplacement || arabicReplacement) && explicitSeats.length) {
    return Object.freeze({
      requested: true,
      operation: "replace",
      amount: null,
      targetCount: explicitSeats.length,
      baselineSeats,
      explicitSeats,
    });
  }

  const requested = isCheckoutSeatEditTurnLegacy(text);
  return Object.freeze({
    requested,
    operation: requested ? "replace" : null,
    amount: null,
    targetCount: null,
    baselineSeats,
    explicitSeats,
  });
}

function isCheckoutSeatEditTurnLegacy(value) {
  const text = clean(value);
  if (!text) return false;

  const backToSeats = /^(?:(?:please\s+)?(?:go|take\s+me|come|move)\s+back|(?:please\s+)?(?:return|back))\s+(?:back\s+)?to\s+(?:the\s+)?(?:seat\s*map|seats?)$/iu;
  const shortBack = /^(?:(?:please\s+)?(?:go\s+)?back|ارجع|أرجع|العودة|عد)(?:\s+(?:إلى|الى|ل)\s*(?:المقاعد|خريطة\s+المقاعد))?$/iu;
  if (backToSeats.test(text) || shortBack.test(text)) return true;

  const englishEdit = /^(?:(?:i\s+(?:want|need|would\s+like)\s+to|can\s+i|could\s+i|would\s+you|can\s+you|please)\s+)?(?:edit|change|modify|update|add|remove)(?:\s+(?:one|a|another|\d+)\s+more)?\s+(?:my\s+|the\s+)?(?:seat|seats|seat\s*map)(?:\s+to\s+[a-z]\d+(?:\s*(?:,|and)\s*[a-z]\d+)*)?$/iu;
  const englishSeatLabelEdit = /^(?:(?:please\s+)?(?:add|remove|change|replace|swap)\s+)(?:seat\s+)?[a-z]\d+(?:\s*(?:,|and|with|to)\s*(?:seat\s+)?[a-z]\d+)*$/iu;
  if (englishEdit.test(text) || englishSeatLabelEdit.test(text)) return true;

  return /^(?:(?:أريد|اريد|أحتاج|احتاج|هل\s+يمكنني|هل\s+تستطيع|من\s+فضلك)\s+)?(?:تعديل|تغيير|غيّر|غير|إضافة|اضافة|أضف|اضف|حذف|احذف)\s+(?:المقاعد|مقعد|المقعد)(?:\s+[a-z]\d+)?$/iu.test(text);
}

export function isCheckoutSeatEditTurn(value) {
  return resolveCheckoutSeatEditTurn(value).requested;
}

export function createCheckoutTargetSeatEdit(targetCount, parsedEdit, currentSeats = []) {
  const baselineSeats = normalizeBaselineSeats(currentSeats);
  const explicitSeats = [...(parsedEdit?.explicitSeats || [])];
  const operation = explicitSeats.length === targetCount
    ? "replace"
    : targetCount > baselineSeats.length
      ? "add"
      : targetCount < baselineSeats.length
        ? "remove"
        : "replace";
  return Object.freeze({
    requested: true,
    operation,
    amount: Math.abs(targetCount - baselineSeats.length) || null,
    targetCount,
    baselineSeats,
    explicitSeats,
  });
}
