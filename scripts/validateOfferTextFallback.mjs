import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { classifyOfferDetailTopic, resolveLocalOfferTextTurn } from "../src/offers/offerTextFallback.js";
import { normalizeOfferText, resolveOfferForBankAndCard, searchOffers } from "../src/offers/offerResolver.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const app = await readFile(resolve(root, "src/App.jsx"), "utf8");

function expectTurn(query, expected, options = {}) {
  const turn = resolveLocalOfferTextTurn(query, options);
  assert.ok(turn, `Expected a local offer turn for: ${query}`);
  assert.equal(turn.offerId, expected.offerId, `Unexpected offer for: ${query}`);
  assert.equal(turn.detailTopic, expected.detailTopic, `Unexpected detail topic for: ${query}`);
  assert.ok(turn.answer.trim(), `Expected a local answer for: ${query}`);
  assert.doesNotMatch(turn.answer, /[\u2013\u2014]/u, `Answer contains prohibited dash punctuation for: ${query}`);
  assert.doesNotMatch(turn.answer, /(?:undefined|null|\[object Object\])/i, `Answer contains an unresolved value for: ${query}`);
  return turn;
}

expectTurn("Tell me the FAB offer", { offerId: "fab-share", detailTopic: "summary" });
expectTurn("Which ENBD cards qualify?", { offerId: "emirates-nbd", detailTopic: "cards" });
expectTurn("ما هو عرض بنك أبوظبي الأول؟", { offerId: "fab-share", detailTopic: "summary" }, { locale: "ar" });
expectTurn("ما البطاقات المؤهلة من بنك الإمارات دبي الوطني؟", { offerId: "emirates-nbd", detailTopic: "cards" }, { locale: "ar" });

assert.equal(classifyOfferDetailTopic("Which experiences work with the FAB offer?"), "experiences");
assert.equal(classifyOfferDetailTopic("What is the monthly limit for the ENBD offer?"), "limits");
assert.equal(classifyOfferDetailTopic("How do I redeem the HSBC offer?"), "redemption");
assert.equal(classifyOfferDetailTopic("What is excluded from the Citi offer?"), "exclusions");
assert.equal(classifyOfferDetailTopic("Show the terms for the Mashreq offer"), "terms");

assert.equal(resolveLocalOfferTextTurn("How do bank offers work?"), null, "Generic offer FAQs must stay on the approved FAQ path");
assert.equal(resolveLocalOfferTextTurn("Which cards qualify?"), null, "A bank or uniquely resolved card is required");
assert.equal(resolveLocalOfferTextTurn("Cancel my FAB booking"), null, "Cancellation must retain routing priority");
assert.equal(resolveLocalOfferTextTurn("Can I get a refund for my ENBD booking?"), null, "Refund requests must retain routing priority");

const unpublished = expectTurn("Tell me the SIB offer", { offerId: "sharjah-islamic-bank", detailTopic: "summary" });
assert.match(unpublished.answer, /does not publish|checkout/i, "Unpublished offer details must be represented truthfully");

assert.equal(normalizeOfferText(null), "", "Missing offer fields must stay empty during normalization");
const cleanFabContext = resolveOfferForBankAndCard("FAB", "FAB SHARE Credit Card", {
  experience: null,
  format: null,
  seatType: null,
  isMember: true,
  channel: "web",
});
assert.equal(cleanFabContext.status, "card_required", "A missing experience must request context instead of being rejected");
assert.match(cleanFabContext.reason, /select a showtime experience/i, "The resolver must ask for the missing experience");

for (const [query, expectedIds] of [
  ["Sharjah Islamic Bank", ["sharjah-islamic-bank"]],
  ["FAB", ["fab-share"]],
  ["Citibank", ["citibank"]],
  ["Emirates NBD", ["emirates-nbd"]],
  ["HSBC", ["hsbc"]],
]) {
  assert.deepEqual(searchOffers(query).map(({ id }) => id), expectedIds, `${query} must not include weak issuer matches`);
}
const adcbSearch = searchOffers("ADCB").map(({ id }) => id);
assert.ok(adcbSearch.includes("adcb"), "ADCB must resolve to its primary offer");
assert.ok(adcbSearch.every((id) => ["adcb", "adcb-touchpoints"].includes(id)), "ADCB may only include the related TouchPoints offer");
assert.ok(searchOffers("Visa Infinite").length > 1, "Generic card-tier searches must remain broad");
assert.ok(searchOffers("buy one get one free").length > 1, "Generic benefit searches must remain broad");

const sendTextStart = app.indexOf("const sendText = useCallback");
const sendTextEnd = app.indexOf("const sendUiTurn", sendTextStart);
assert.ok(sendTextStart >= 0 && sendTextEnd > sendTextStart, "Typed send route was not found");
const sendText = app.slice(sendTextStart, sendTextEnd);
const cancellationIndex = sendText.indexOf("const directCancellation");
const fallbackIndex = sendText.indexOf("const localOfferTurn");
const dismissIndex = sendText.indexOf("dismissStaleTransactionalView", fallbackIndex);
const transportIndex = sendText.indexOf("await startTextSession", fallbackIndex);
assert.ok(cancellationIndex >= 0 && cancellationIndex < fallbackIndex, "Cancellation must be classified before the offer fallback");
assert.ok(fallbackIndex >= 0 && fallbackIndex < dismissIndex, "Offer fallback must run before stale transactional views are dismissed");
assert.ok(dismissIndex < transportIndex, "The general text transport path must remain after the local fallback");
assert.match(sendText, /localOfferTurn\s*&&\s*!isConnected/, "Fallback must be limited to unavailable transport");
assert.match(sendText, /clientTools\.show_offers\(\{/, "Fallback must open the existing rich offer panel");
assert.match(sendText, /say\("agent", localAnswer\)/, "Fallback must publish the local detail answer");
assert.match(sendText, /!cancellationFlowRef\.current/, "An active cancellation flow must block the offer fallback");

const voiceStart = app.indexOf("const startVoiceSession");
const voiceEnd = app.indexOf("const endVoiceSession", voiceStart);
assert.ok(voiceStart >= 0 && voiceEnd > voiceStart, "Voice startup route was not found");
const voiceStartup = app.slice(voiceStart, voiceEnd);
assert.doesNotMatch(voiceStartup, /resolveLocalOfferTextTurn|localOfferTurn/, "The local typed fallback must not alter voice startup");

const showOffersStart = app.indexOf("show_offers: async");
const showOffersEnd = app.indexOf("handover_to_agent:", showOffersStart);
assert.ok(showOffersStart >= 0 && showOffersEnd > showOffersStart, "show_offers client tool was not found");
const showOffers = app.slice(showOffersStart, showOffersEnd);
assert.match(showOffers, /const origin = current\.view === "offers" \? offersReturnRef\.current/, "Offer origin must preserve the return stage");
assert.match(showOffers, /if \(current\.view !== "offers"\) offersReturnRef\.current = current;/, "Offer panel must capture the current return stage");
assert.ok(showOffers.indexOf("offersReturnRef.current = current") < showOffers.indexOf('showStage({ view: "offers"'), "Return stage must be saved before the offer panel opens");

console.log("Offer text fallback validation passed.");
