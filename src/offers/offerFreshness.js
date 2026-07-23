import { OFFER_META } from "./offersData.js";

export const OFFER_KNOWLEDGE_MAX_AGE_DAYS = 30;

export const OFFER_KNOWLEDGE_STATUS = Object.freeze({
  FRESH: "fresh",
  STALE: "stale",
  INVALID: "invalid",
});

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UAE_TIME_ZONE = "Asia/Dubai";

function strictDate(value) {
  const isoDate = String(value || "").trim();
  if (!ISO_DATE.test(isoDate)) return null;
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === isoDate
    ? { timestamp, isoDate }
    : null;
}

function referenceDate(value) {
  if (typeof value === "string") return strictDate(value);
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: UAE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueFor = (type) => parts.find((item) => item.type === type)?.value || "";
  return strictDate(`${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`);
}

function addCalendarDays(parts, days) {
  return new Date(parts.timestamp + (days * DAY_MS)).toISOString().slice(0, 10);
}

function guidanceFor({ verifiedDate, maxAgeDays, sourceUrl, status }) {
  const invalid = status === OFFER_KNOWLEDGE_STATUS.INVALID;
  return Object.freeze({
    en: invalid
      ? `The bank-offer verification date is unavailable or invalid. Check the official current terms at ${sourceUrl} and verify the card in the official VOX website or app checkout.`
      : `Bank-offer details were last verified on ${verifiedDate} and are more than ${maxAgeDays} days old. Check the official current terms at ${sourceUrl} and verify the card in the official VOX website or app checkout.`,
    ar: invalid
      ? `تاريخ التحقق من عروض البنوك غير متوفر أو غير صالح. راجع الشروط الرسمية الحالية على ${sourceUrl} وتحقق من البطاقة في صفحة الدفع الرسمية في موقع VOX أو تطبيقه.`
      : `تم التحقق من تفاصيل عروض البنوك آخر مرة بتاريخ ${verifiedDate} وقد مضى عليها أكثر من ${maxAgeDays} يوماً. راجع الشروط الرسمية الحالية على ${sourceUrl} وتحقق من البطاقة في صفحة الدفع الرسمية في موقع VOX أو تطبيقه.`,
  });
}

export function getOfferKnowledgeStatus({
  asOf = new Date(),
  verifiedDate = OFFER_META.verifiedDate,
  maxAgeDays = OFFER_KNOWLEDGE_MAX_AGE_DAYS,
  sourceUrl = OFFER_META.sourceUrl,
} = {}) {
  const verified = strictDate(verifiedDate);
  const reference = referenceDate(asOf);
  const validMaxAge = Number.isInteger(maxAgeDays) && maxAgeDays >= 0;
  const ageDays = verified && reference
    ? Math.floor((reference.timestamp - verified.timestamp) / DAY_MS)
    : null;
  const validDates = Boolean(verified && reference && validMaxAge && ageDays >= 0);
  const status = !validDates
    ? OFFER_KNOWLEDGE_STATUS.INVALID
    : ageDays <= maxAgeDays
      ? OFFER_KNOWLEDGE_STATUS.FRESH
      : OFFER_KNOWLEDGE_STATUS.STALE;
  const isFresh = status === OFFER_KNOWLEDGE_STATUS.FRESH;
  const result = {
    status,
    isFresh,
    isStale: !isFresh,
    verifiedDate: verified?.isoDate || String(verifiedDate || ""),
    asOfDate: reference?.isoDate || "",
    ageDays,
    maxAgeDays: validMaxAge ? maxAgeDays : OFFER_KNOWLEDGE_MAX_AGE_DAYS,
    validThrough: verified && validMaxAge ? addCalendarDays(verified, maxAgeDays) : "",
    sourceUrl,
  };
  return Object.freeze({
    ...result,
    guidance: isFresh ? null : guidanceFor(result),
  });
}
