import { answerForOfferTopic } from "./offerFacts.js";
import { resolveOffer } from "./offerResolver.js";

const CANCELLATION_OR_REFUND = /\b(?:cancel|cancellation|refund|refundable|void)\b|(?:إلغاء|الغاء|ألغي|الغي|استرداد|استرجاع)/iu;
const ENGLISH_OFFER_INTENT = /\b(?:offer|offers|deal|deals|discount|discounts|promotion|promotions|eligible|eligibility|qualify|qualifies|qualified|redeem|redemption|card|cards)\b/i;
const ARABIC_OFFER_INTENT = /(?:عرض|عروض|خصم|خصومات|تخفيض|ترويج|مؤهل|مؤهلة|الأهلية|اهلية|أهلية|بطاق|استفادة|استخدام)/u;

const TOPIC_PATTERNS = Object.freeze([
  ["cards", /\b(?:card|cards|eligible card|which cards?|qualif(?:y|ies|ied))\b|(?:بطاق|البطاقات|المؤهلة)/iu],
  ["experiences", /\b(?:experience|experiences|format|formats|imax|4dx|gold|kids|theatre|premier)\b|(?:تجربة|تجارب|صيغة|صيغ|آيماكس|فور دي إكس)/iu],
  ["limits", /\b(?:limit|limits|monthly|per month|minimum spend|spend requirement|requirements?)\b|(?:حد|حدود|شهري|شهرية|الحد الأدنى|الحد الادنى|إنفاق|انفاق|متطلبات)/iu],
  ["redemption", /\b(?:redeem|redemption|claim|apply|how (?:can|do) i use|use (?:the|this) offer)\b|(?:كيفية الاستخدام|كيف أستخدم|كيف استخدم|الاستفادة|تفعيل العرض)/iu],
  ["exclusions", /\b(?:exclude|excluded|exclusion|exclusions|not included|restrictions?)\b|(?:استثناء|استثناءات|مستثنى|غير مشمول|قيود)/iu],
  ["terms", /\b(?:terms|conditions|terms and conditions)\b|(?:شروط|الأحكام|احكام)/iu],
]);

export function classifyOfferDetailTopic(query = "") {
  const text = String(query);
  return TOPIC_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || "summary";
}
export function resolveLocalOfferTextTurn(query, { locale = "en" } = {}) {
  const text = String(query || "").trim();
  if (!text || CANCELLATION_OR_REFUND.test(text)) return null;
  if (!ENGLISH_OFFER_INTENT.test(text) && !ARABIC_OFFER_INTENT.test(text)) return null;

  const result = resolveOffer(text, {});
  if (!result?.offer) return null;

  const responseLocale = locale === "ar" || /\p{Script=Arabic}/u.test(text) ? "ar" : "en";
  const detailTopic = classifyOfferDetailTopic(text);

  return {
    offerId: result.offer.id,
    profileId: result.cardProfile?.id || null,
    bankName: result.offer.bank.en,
    cardName: result.cardProfile?.name?.en || "",
    detailTopic,
    answer: answerForOfferTopic(result.offer, result.cardProfile, responseLocale, detailTopic),
  };
}
