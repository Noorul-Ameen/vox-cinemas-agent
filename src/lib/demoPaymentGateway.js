export const DEMO_CARD_NUMBERS = Object.freeze({
  eligible: "4111111111111111",
  notEligible: "5555555555554444",
});

export const DEMO_CARD_OFFER_PERCENT = 20;
export const DEMO_WALLET_BALANCE = 500;
export const DEMO_SHARE_POINTS = 5000;
export const DEMO_SHARE_POINTS_PER_AED = 10;

const EPSILON = 0.011;

function finiteAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function roundDemoMoney(value) {
  return Math.round((finiteAmount(value) + Number.EPSILON) * 100) / 100;
}

function clampMoney(value, minimum, maximum) {
  return roundDemoMoney(Math.min(Math.max(finiteAmount(value), minimum), maximum));
}

export function normalizeDemoCardNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 16);
}

export function formatDemoCardNumber(value) {
  return normalizeDemoCardNumber(value).replace(/(.{4})/g, "$1 ").trim();
}

export function maskDemoCardNumber(value) {
  const normalized = normalizeDemoCardNumber(value);
  return normalized.length === 16 ? `**** **** **** ${normalized.slice(-4)}` : "";
}

export function validateDemoCardOffer(value) {
  const normalized = normalizeDemoCardNumber(value);
  const known = Object.values(DEMO_CARD_NUMBERS).includes(normalized);
  const eligible = normalized === DEMO_CARD_NUMBERS.eligible;
  return {
    valid: known,
    eligible,
    status: !known ? "unrecognized" : eligible ? "eligible" : "not_eligible",
    last4: known ? normalized.slice(-4) : "",
    discountPercent: eligible ? DEMO_CARD_OFFER_PERCENT : 0,
  };
}

export function validateDemoWallet(amount) {
  const requested = roundDemoMoney(Math.max(0, finiteAmount(amount)));
  const applied = clampMoney(requested, 0, DEMO_WALLET_BALANCE);
  return {
    valid: requested <= DEMO_WALLET_BALANCE,
    eligible: requested <= DEMO_WALLET_BALANCE,
    status: requested <= DEMO_WALLET_BALANCE ? "eligible" : "insufficient",
    balance: DEMO_WALLET_BALANCE,
    requested,
    applied,
    remaining: roundDemoMoney(DEMO_WALLET_BALANCE - applied),
    shortfall: roundDemoMoney(Math.max(0, requested - DEMO_WALLET_BALANCE)),
  };
}

export function validateDemoSharePoints(amount) {
  const requestedAed = roundDemoMoney(Math.max(0, finiteAmount(amount)));
  const pointsRequired = Math.round(requestedAed * DEMO_SHARE_POINTS_PER_AED);
  const appliedPoints = Math.min(pointsRequired, DEMO_SHARE_POINTS);
  return {
    valid: pointsRequired <= DEMO_SHARE_POINTS,
    eligible: pointsRequired <= DEMO_SHARE_POINTS,
    status: pointsRequired <= DEMO_SHARE_POINTS ? "eligible" : "insufficient",
    points: DEMO_SHARE_POINTS,
    pointsRequired,
    appliedPoints,
    appliedAed: roundDemoMoney(appliedPoints / DEMO_SHARE_POINTS_PER_AED),
    remainingPoints: DEMO_SHARE_POINTS - appliedPoints,
    shortfallPoints: Math.max(0, pointsRequired - DEMO_SHARE_POINTS),
  };
}

export function calculateDemoOfferAdjustment({ offer = null, amount, ticketCount = 1 } = {}) {
  const originalTotal = roundDemoMoney(Math.max(0, finiteAmount(amount)));
  const tickets = Math.max(1, Math.floor(finiteAmount(ticketCount) || 1));
  if (!offer) {
    return {
      valid: true,
      reason: "no_offer",
      benefit: "none",
      discount: 0,
      payableTotal: originalTotal,
    };
  }

  let valid = true;
  let reason = "offer_applied";
  let discount = 0;
  if (offer.benefit === "bogo") {
    if (tickets < 2) {
      valid = false;
      reason = "offer_requires_two_tickets";
    } else {
      discount = (originalTotal / tickets) * Math.floor(tickets / 2);
    }
  } else if (offer.benefit === "half_price") {
    discount = originalTotal * 0.5;
  } else if (offer.benefit === "mixed") {
    discount = tickets >= 2
      ? (originalTotal / tickets) * Math.floor(tickets / 2)
      : originalTotal * 0.3;
  } else if (offer.benefit === "points_payment") {
    reason = "points_payment_offer";
  } else {
    valid = false;
    reason = "unsupported_offer";
  }

  const safeDiscount = roundDemoMoney(Math.min(originalTotal, Math.max(0, discount)));
  return {
    valid,
    reason,
    benefit: offer.benefit || "unknown",
    discount: safeDiscount,
    payableTotal: roundDemoMoney(originalTotal - safeDiscount),
  };
}

export function createDemoPaymentPlan({
  amount,
  ticketCount = 1,
  offer = null,
  cardNumber = "",
  shareAed = 0,
  walletAed = 0,
} = {}) {
  const originalTotal = roundDemoMoney(finiteAmount(amount));
  if (originalTotal <= 0) {
    return { valid: false, reason: "invalid_amount", simulated: true };
  }

  const offerAdjustment = calculateDemoOfferAdjustment({ offer, amount: originalTotal, ticketCount });
  const payableTotal = offerAdjustment.payableTotal;
  const requestedShareAed = Math.floor(Math.max(0, finiteAmount(shareAed)) * DEMO_SHARE_POINTS_PER_AED) / DEMO_SHARE_POINTS_PER_AED;
  const appliedShareAed = clampMoney(requestedShareAed, 0, Math.min(payableTotal, DEMO_SHARE_POINTS / DEMO_SHARE_POINTS_PER_AED));
  const afterShare = roundDemoMoney(payableTotal - appliedShareAed);
  const appliedWalletAed = clampMoney(walletAed, 0, Math.min(afterShare, DEMO_WALLET_BALANCE));
  const cardAed = roundDemoMoney(Math.max(0, payableTotal - appliedShareAed - appliedWalletAed));
  const cardValidation = validateDemoCardOffer(cardNumber);

  let valid = offerAdjustment.valid;
  let reason = offerAdjustment.valid ? "ready" : offerAdjustment.reason;
  if (valid && offer && !cardValidation.eligible) {
    valid = false;
    reason = cardValidation.valid ? "offer_card_not_eligible" : "offer_card_required";
  } else if (valid && cardAed > 0 && !cardValidation.valid) {
    valid = false;
    reason = "card_required";
  }

  const fundingTotal = roundDemoMoney(appliedShareAed + appliedWalletAed + cardAed);
  if (valid && Math.abs(fundingTotal - payableTotal) > EPSILON) {
    valid = false;
    reason = "funding_mismatch";
  }

  const sharePointsUsed = Math.round(appliedShareAed * DEMO_SHARE_POINTS_PER_AED);
  return {
    valid,
    reason,
    simulated: true,
    offer: offer
      ? {
          id: String(offer.id || ""),
          benefit: String(offer.benefit || ""),
          bank: offer.bank || null,
          headline: offer.headline || null,
        }
      : null,
    offerResult: offerAdjustment.reason,
    cardValidation,
    cardLast4: cardValidation.last4,
    amounts: {
      originalTotal,
      offerDiscount: offerAdjustment.discount,
      payableTotal,
      shareAed: appliedShareAed,
      walletAed: appliedWalletAed,
      cardAed,
    },
    sharePointsUsed,
    sharePointsRemaining: DEMO_SHARE_POINTS - sharePointsUsed,
    walletRemaining: roundDemoMoney(DEMO_WALLET_BALANCE - appliedWalletAed),
  };
}
