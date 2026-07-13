import assert from "node:assert/strict";
import { VOX_FAQ_ENTRIES, buildFaqContextForQuery, resolveFaqOne, resolveFaqQuery, serializeFaqContext } from "../src/knowledge/index.js";

const CASES = [
  ["opening hours", "en", "cinema-locations-hours"],
  ["كيف أستخدم التذكرة الإلكترونية", "ar", "tickets-and-etickets"],
  ["where is imax available", "en", "experience-availability"],
  ["هل توجد ماكس في هذه السينما", "ar", "experience-availability"],
  ["outside food", "en", "food-and-drinks"],
  ["عرض البنك", "ar", "bank-and-card-offers"],
  ["wheelchair spaces", "en", "wheelchair-accessibility"],
  ["هل يطلبون الهوية", "ar", "movie-age-ratings"],
  ["4dx height", "en", "experience-age-and-safety"],
  ["cancel my booking", "en", "cancellation-and-refunds"],
  ["سجل المشتريات", "ar", "booking-management"],
  ["forgot password", "en", "vox-account"],
  ["رصيد ڤوكس", "ar", "vox-credit-wallet"],
  ["share points", "en", "share-loyalty"],
  ["phone number", "en", "customer-support"],
  ["حجز مجموعة", "ar", "group-and-private-bookings"],
];

for (const [query, locale, expectedId] of CASES) {
  const result = resolveFaqOne(query, { locale });
  assert.ok(result, `expected a result for ${query}`);
  assert.equal(result.id, expectedId, `${query}: wrong FAQ result`);
  assert.equal(result.locale, locale, `${query}: response locale must follow active locale`);
}

const mixed = resolveFaqOne("أحتاج wheelchair spaces", { locale: "en" });
assert.equal(mixed.id, "wheelchair-accessibility", "mixed-language queries should still resolve deterministically");
assert.equal(mixed.locale, "en", "query script must not switch the active response locale");
assert.match(mixed.answer, /^VOX cinemas have/i, "answer must remain in the explicitly supplied locale");

assert.equal(resolveFaqOne("weather forecast tomorrow", { locale: "en" }), null, "unrelated queries must not produce FAQ answers");

const first = resolveFaqQuery("refund credit wallet", { locale: "en", limit: 4 });
const second = resolveFaqQuery("refund credit wallet", { locale: "en", limit: 4 });
assert.deepEqual(
  first.map(({ id, score }) => ({ id, score })),
  second.map(({ id, score }) => ({ id, score })),
  "resolver order and scores must be deterministic",
);

const hours = resolveFaqOne("what time do you open", { locale: "en" });
assert.equal(hours.dataMode, "api");
assert.equal(hours.needsLiveData, true);
const missingLive = serializeFaqContext([hours], { locale: "en", maxChars: 4000 });
assert.match(missingLive, /Live result: NOT SUPPLIED/);
assert.match(missingLive, /https:\/\/uae\.voxcinemas\.com\/faq/);
assert.match(missingLive, /never invent a current value/i);

const withLive = serializeFaqContext([hours], {
  locale: "en",
  maxChars: 4000,
  liveData: { "cinema-locations-hours": { firstSession: "13:45", cinema: "Selected cinema" } },
});
assert.match(withLive, /"cinema":"Selected cinema","firstSession":"13:45"/, "live data must serialize in stable key order");

const built = buildFaqContextForQuery("customer care phone number", { locale: "ar", limit: 1 });
assert.equal(built.matches[0].id, "customer-support");
assert.match(built.context, /Reply language: Arabic/);
assert.match(built.context, /600 599 905/);

const capped = serializeFaqContext(resolveFaqQuery("refund", { locale: "en", limit: 3 }), { locale: "en", maxChars: 700 });
assert.ok(capped.length <= 700, "serializer must honor maxChars");

const fullCatalog = serializeFaqContext(VOX_FAQ_ENTRIES, { locale: "ar", maxChars: 14_000 });
assert.doesNotMatch(fullCatalog, /\[object Object\]/, "raw catalog entries must serialize their localized answer text");
assert.match(fullCatalog, /Approved answer \(ar\): [\u0600-\u06ff]/, "the voice catalog must contain Arabic answers when Arabic is active");

console.log(`FAQ resolver tests passed: ${CASES.length} bilingual intent cases plus determinism and serialization checks.`);
