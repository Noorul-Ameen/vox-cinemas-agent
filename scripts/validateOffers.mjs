import assert from "node:assert/strict";
import { getOfferMedia } from "../src/mediaData.js";
import { OFFER_META, OFFERS } from "../src/offers/offersData.js";
import { ELIGIBILITY, normalizeExperience, resolveOffer, resolveOfferForBankAndCard, searchOffers } from "../src/offers/offerResolver.js";

assert.equal(OFFERS.length, 19, "knowledge base must contain all 19 offers");
assert.equal(new Set(OFFERS.map((offer) => offer.id)).size, 19, "offer IDs must be unique");
assert.equal(OFFER_META.capturedDate, "2026-06-23");
assert.equal(OFFER_META.verifiedDate, "2026-07-08");
assert.match(OFFER_META.disclaimer.en, /guidance only/i);
assert.match(OFFER_META.disclaimer.en, /cannot be redeemed/i);

for (const offer of OFFERS) {
  assert.ok(offer.bank.en && offer.bank.ar, `${offer.id}: bilingual bank name`);
  assert.ok(offer.headline.en && offer.headline.ar, `${offer.id}: bilingual headline`);
  assert.ok(offer.summary.en && offer.summary.ar, `${offer.id}: bilingual summary`);
  assert.ok(offer.aliases.length, `${offer.id}: bank aliases`);
  assert.ok(offer.profiles.length, `${offer.id}: card profiles`);
  assert.equal(offer.sourceUrl, OFFER_META.sourceUrl, `${offer.id}: source URL`);
  assert.equal(offer.verifiedDate, OFFER_META.verifiedDate, `${offer.id}: verification date`);
  for (const profile of offer.profiles) {
    assert.ok(profile.aliases.length, `${offer.id}/${profile.id}: card aliases`);
    assert.ok(profile.eligibility.experiences.length, `${offer.id}/${profile.id}: structured experiences`);
  }
}

const expectStatus = (query, context, expected, expectedOffer) => {
  const result = resolveOffer(query, context);
  assert.equal(result.status, expected, `${query}: ${result.reason}`);
  if (expectedOffer) assert.equal(result.offer?.id, expectedOffer, `${query}: wrong offer resolved`);
  return result;
};

expectStatus("FAB", { experience: "Regular 2D" }, ELIGIBILITY.CARD_REQUIRED, "fab-share");
expectStatus("FAB SHARE card", { experience: "Regular 2D", cinemaName: "City Centre Mirdif" }, ELIGIBILITY.ELIGIBLE, "fab-share");
expectStatus("FAB SHARE card", { experience: "IMAX 2D" }, ELIGIBILITY.INELIGIBLE, "fab-share");
expectStatus("HSBC Platinum", { experience: "GOLD 2D" }, ELIGIBILITY.INELIGIBLE, "hsbc");
expectStatus("HSBC Black", { experience: "THEATRE 2D", cinemaName: "Mall of the Emirates" }, ELIGIBILITY.INELIGIBLE, "hsbc");
expectStatus("HSBC Black", { experience: "THEATRE 2D", cinemaName: "Yas Mall" }, ELIGIBILITY.ELIGIBLE, "hsbc");
expectStatus("RAK Bank Air Arabia Platinum", { experience: "4DX" }, ELIGIBILITY.INELIGIBLE, "rakbank");
expectStatus("NBF Visa", { experience: "MAX 2D", monthlySpend: 1000 }, ELIGIBILITY.INELIGIBLE, "nbf");
expectStatus("ENBD Visa Infinite", { experience: "4DX" }, ELIGIBILITY.ELIGIBLE, "emirates-nbd");
expectStatus("Citi Life Platinum", { experience: "IMAX 2D", ticketCount: 1 }, ELIGIBILITY.INELIGIBLE, "citibank");
expectStatus("Citi Life Platinum", { experience: "Standard 2D", ticketCount: 1 }, ELIGIBILITY.ELIGIBLE, "citibank");
expectStatus("Arab Bank Signature VIP", { experience: "THEATRE", cinemaName: "Mall of the Emirates" }, ELIGIBILITY.INELIGIBLE, "arab-bank");
const fullEnbd = resolveOfferForBankAndCard("Emirates NBD", "Visa Infinite", { experience: "4DX" });
assert.equal(fullEnbd.status, ELIGIBILITY.ELIGIBLE);
assert.match(fullEnbd.advisory, /membership/i, "unknown membership must remain an explicit condition");
assert.equal(resolveOfferForBankAndCard("ADCB", "TouchPoints Visa Infinite", { experience: "STANDARD", seatType: "REGULAR", format: "2D" }).offer?.id, "adcb");
assert.equal(resolveOfferForBankAndCard("ADCB", "TouchPoints Platinum", { experience: "MAX", format: "2D" }).offer?.id, "adcb");
assert.equal(resolveOfferForBankAndCard("FAB", "FAB SHARE card", { experience: "STANDARD" }).status, ELIGIBILITY.CARD_REQUIRED, "missing 2D/3D detail must stay conditional");
assert.equal(resolveOfferForBankAndCard("FAB", "FAB SHARE card", { experience: "PRIVATE CINEMA" }).status, ELIGIBILITY.INELIGIBLE);
assert.equal(resolveOfferForBankAndCard("Aafaq", "Platinum Credit Card", { experience: "KIDS 3D", ticketCount: 2 }).status, ELIGIBILITY.ELIGIBLE);
assert.equal(resolveOfferForBankAndCard("Citi", "Life Infinite", { experience: "STANDARD 2D", ticketCount: 1 }).status, ELIGIBILITY.INELIGIBLE, "Citi BOGO needs two tickets");
assert.equal(resolveOfferForBankAndCard("Citi", "Premier", { experience: "STANDARD 2D", ticketCount: 1 }).status, ELIGIBILITY.ELIGIBLE, "Citi 30% has no two-ticket minimum");
assert.equal(resolveOfferForBankAndCard("Citi", "Life Infinite", { experience: "MAX 2D", cinemaName: "City Centre Deira", seatType: "Balcony", ticketCount: 2 }).status, ELIGIBILITY.INELIGIBLE);
assert.equal(resolveOfferForBankAndCard("CBD", "Visa Infinite Metal", { experience: "IMAX", seatType: "Sapphire" }).status, ELIGIBILITY.INELIGIBLE);

const experienceMappings = {
  "4DX": "4DX", "Couch - 2 Seater": "COUCH", GOLD: "GOLD", IMAX: "IMAX", KIDS: "KIDS", MAX: "MAX",
  ONYX: "ONYX", PREMIER: "PREMIER", PREMIUM: "PREMIUM", "PRIVATE CINEMA": "PRIVATE_CINEMA",
  STANDARD: "STANDARD", THEATRE: "THEATRE", "THEATRE PODS IN IMAX": "THEATRE_PODS",
};
for (const [source, expected] of Object.entries(experienceMappings)) assert.equal(normalizeExperience(source), expected, source);

const cbdConflict = expectStatus("CBD Visa Infinite Metal", { experience: "4DX" }, ELIGIBILITY.ELIGIBLE, "cbd");
assert.match(cbdConflict.advisory, /conflict/i, "CBD 4DX conflict must be disclosed");

expectStatus("ADCB TouchPoints", { experience: "IMAX 3D", isMember: false, orderTotal: 30 }, ELIGIBILITY.ELIGIBLE, "adcb-touchpoints");
expectStatus("ADCB TouchPoints", { experience: "Standard 2D", isMember: false, orderTotal: 10 }, ELIGIBILITY.INELIGIBLE, "adcb-touchpoints");

assert.equal(searchOffers("RAK bak")[0]?.id, "rakbank", "fuzzy bank search");
assert.equal(searchOffers("cashbak plus")[0]?.id, "liv", "fuzzy card search");
assert.equal(getOfferMedia(OFFERS.find((offer) => offer.id === "arab-bank-signature"))?.code, "ARABBIN7", "Arab Bank Signature must use its own official artwork");
assert.equal(getOfferMedia(OFFERS.find((offer) => offer.id === "arab-bank"))?.code, "ARAB", "plain Arab Bank must not inherit Signature artwork");

console.log(`Validated ${OFFERS.length} VOX UAE offers, ${OFFERS.reduce((sum, offer) => sum + offer.profiles.length, 0)} card profiles, and tri-state eligibility scenarios.`);
