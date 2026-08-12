export const DEMO_CARD_NUMBERS = Object.freeze({
  eligible: "4111111111111111",
  notEligible: "5555555555554444",
});

export const DEMO_CARD_OFFER_PERCENT = 20;
export const DEMO_WALLET_BALANCE = 30;
export const DEMO_SHARE_POINTS = 200;
export const DEMO_SHARE_AED_VALUE = 20;
export const DEMO_SHARE_POINTS_PER_AED = DEMO_SHARE_POINTS / DEMO_SHARE_AED_VALUE;

export const PAYMENT_METHODS = Object.freeze({
  samsungPay: "samsung_pay",
  applePay: "apple_pay",
  card: "card",
  balances: "balances",
});

export function normalizeDemoPaymentMethod(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.values(PAYMENT_METHODS).includes(normalized) ? normalized : "";
}

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

export function validateDemoCvv(value) {
  const normalized = String(value || "").replace(/\D/g, "").slice(0, 3);
  return {
    valid: /^\d{3}$/.test(normalized),
    status: !normalized ? "required" : normalized.length === 3 ? "valid" : "invalid",
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

export function validateDemoSharePoints(points) {
  const requestedPoints = Math.max(0, finiteAmount(points));
  const wholePoints = Number.isInteger(requestedPoints);
  const appliedPoints = Math.min(Math.floor(requestedPoints), DEMO_SHARE_POINTS);
  const withinBalance = requestedPoints <= DEMO_SHARE_POINTS;
  return {
    valid: wholePoints && withinBalance,
    eligible: wholePoints && withinBalance,
    status: !wholePoints ? "invalid" : withinBalance ? "eligible" : "insufficient",
    points: DEMO_SHARE_POINTS,
    pointsRequired: requestedPoints,
    pointsRequested: requestedPoints,
    appliedPoints,
    appliedAed: roundDemoMoney(appliedPoints / DEMO_SHARE_POINTS_PER_AED),
    remainingPoints: DEMO_SHARE_POINTS - appliedPoints,
    shortfallPoints: Math.max(0, requestedPoints - DEMO_SHARE_POINTS),
  };
}

export function calculateDemoOfferAdjustment({ offer = null, amount, ticketCount = 1 } = {}) {
  const originalTotal = roundDemoMoney(Math.max(0, finiteAmount(amount)));
  const tickets = Math.max(1, Math.floor(finiteAmount(ticketCount) || 1));
  const unitTicketAmount = roundDemoMoney(originalTotal / tickets);
  if (!offer) {
    return {
      valid: true,
      reason: "no_offer",
      benefit: "none",
      discount: 0,
      payableTotal: originalTotal,
      offerTicketCount: 0,
      fullPriceTicketCount: tickets,
      fullPriceAmount: originalTotal,
    };
  }

  let valid = true;
  let reason = "offer_applied";
  let discount = 0;
  let offerTicketCount = 0;
  let fullPriceTicketCount = tickets;
  if (offer.benefit === "bogo") {
    if (tickets < 2) {
      valid = false;
      reason = "offer_requires_two_tickets";
    } else {
      const pairs = Math.floor(tickets / 2);
      discount = unitTicketAmount * pairs;
      offerTicketCount = pairs * 2;
      fullPriceTicketCount = tickets - offerTicketCount;
    }
  } else if (offer.benefit === "half_price") {
    discount = originalTotal * 0.5;
    offerTicketCount = tickets;
    fullPriceTicketCount = 0;
  } else if (offer.benefit === "mixed") {
    if (tickets >= 2) {
      const pairs = Math.floor(tickets / 2);
      discount = unitTicketAmount * pairs;
      offerTicketCount = pairs * 2;
      fullPriceTicketCount = tickets - offerTicketCount;
    } else {
      discount = originalTotal * 0.3;
      offerTicketCount = 1;
      fullPriceTicketCount = 0;
    }
  } else if (offer.benefit === "points_payment") {
    reason = "points_payment_offer";
    offerTicketCount = tickets;
    fullPriceTicketCount = 0;
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
    offerTicketCount,
    fullPriceTicketCount,
    fullPriceAmount: roundDemoMoney(unitTicketAmount * fullPriceTicketCount),
  };
}

export function createDemoPaymentPlan({
  amount,
  ticketCount = 1,
  offer = null,
  cardNumber = "",
  cvv = "",
  paymentMethod = "",
  sharePoints = null,
  shareAed = 0,
  walletAed = 0,
} = {}) {
  const originalTotal = roundDemoMoney(finiteAmount(amount));
  if (originalTotal <= 0) {
    return { valid: false, reason: "invalid_amount", simulated: true };
  }

  const normalizedPaymentMethod = normalizeDemoPaymentMethod(paymentMethod)
    || (normalizeDemoCardNumber(cardNumber) ? PAYMENT_METHODS.card : "");
  const offerAdjustment = calculateDemoOfferAdjustment({ offer, amount: originalTotal, ticketCount });
  const payableTotal = offerAdjustment.payableTotal;
  const requestedSharePoints = sharePoints == null
    ? Math.floor(Math.max(0, finiteAmount(shareAed)) * DEMO_SHARE_POINTS_PER_AED)
    : Math.max(0, finiteAmount(sharePoints));
  const shareValidation = validateDemoSharePoints(requestedSharePoints);
  const requestedWalletAed = Math.max(0, finiteAmount(walletAed));
  const requestedStoredValueAed = roundDemoMoney(shareValidation.appliedAed + requestedWalletAed);
  const storedValueLimitAed = offer
    ? Math.min(payableTotal, offerAdjustment.fullPriceAmount)
    : payableTotal;
  const maximumSharePointsForPayable = Math.floor((storedValueLimitAed * DEMO_SHARE_POINTS_PER_AED) + EPSILON);
  const appliedSharePoints = Math.min(shareValidation.appliedPoints, maximumSharePointsForPayable);
  const appliedShareAed = roundDemoMoney(appliedSharePoints / DEMO_SHARE_POINTS_PER_AED);
  const afterShare = roundDemoMoney(payableTotal - appliedShareAed);
  const remainingStoredValueLimitAed = roundDemoMoney(Math.max(0, storedValueLimitAed - appliedShareAed));
  const appliedWalletAed = clampMoney(walletAed, 0, Math.min(afterShare, remainingStoredValueLimitAed, DEMO_WALLET_BALANCE));
  const externalAed = roundDemoMoney(Math.max(0, payableTotal - appliedShareAed - appliedWalletAed));
  const cardValidation = validateDemoCardOffer(cardNumber);
  const cvvValidation = validateDemoCvv(cvv);
  const paymentMethodRequired = Boolean(offer || externalAed > 0);
  const cardRequired = paymentMethodRequired && normalizedPaymentMethod === PAYMENT_METHODS.card;
  const cvvRequired = Boolean(cardRequired && cardValidation.valid);

  let valid = offerAdjustment.valid;
  let reason = offerAdjustment.valid ? "ready" : offerAdjustment.reason;
  if (valid && !shareValidation.valid) {
    valid = false;
    reason = shareValidation.status === "insufficient"
      ? "share_points_exceed_balance"
      : "share_points_invalid";
  } else if (valid && offer && requestedStoredValueAed > EPSILON && offerAdjustment.fullPriceTicketCount < 1) {
    valid = false;
    reason = "offer_balances_require_full_price_ticket";
  } else if (valid && offer && requestedStoredValueAed - storedValueLimitAed > EPSILON) {
    valid = false;
    reason = "offer_balances_exceed_full_price_amount";
  } else if (valid && paymentMethodRequired && !normalizedPaymentMethod) {
    valid = false;
    reason = "payment_method_required";
  } else if (valid && offer && normalizedPaymentMethod !== PAYMENT_METHODS.card) {
    valid = false;
    reason = "offer_requires_card_payment";
  } else if (valid && offer && !cardValidation.eligible) {
    valid = false;
    reason = cardValidation.valid ? "offer_card_not_eligible" : "offer_card_required";
  } else if (valid && cardRequired && !cardValidation.valid) {
    valid = false;
    reason = "card_required";
  } else if (valid && cvvRequired && !cvvValidation.valid) {
    valid = false;
    reason = cvvValidation.status === "required" ? "cvv_required" : "cvv_invalid";
  }

  const fundingTotal = roundDemoMoney(appliedShareAed + appliedWalletAed + externalAed);
  if (valid && Math.abs(fundingTotal - payableTotal) > EPSILON) {
    valid = false;
    reason = "funding_mismatch";
  }

  const sharePointsUsed = appliedSharePoints;
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
    paymentMethod: paymentMethodRequired ? normalizedPaymentMethod : PAYMENT_METHODS.balances,
    cardValidation,
    cvvValidation,
    cardLast4: cardRequired ? cardValidation.last4 : "",
    requirements: {
      paymentMethod: paymentMethodRequired,
      card: cardRequired,
      cvv: cvvRequired,
    },
    storedValuePolicy: {
      offerTicketCount: offerAdjustment.offerTicketCount,
      fullPriceTicketCount: offerAdjustment.fullPriceTicketCount,
      limitAed: storedValueLimitAed,
      requestedAed: requestedStoredValueAed,
    },
    shareValidation,
    amounts: {
      originalTotal,
      offerDiscount: offerAdjustment.discount,
      payableTotal,
      shareAed: appliedShareAed,
      remainingAfterPointsAed: afterShare,
      walletAed: appliedWalletAed,
      externalAed,
      cardAed: normalizedPaymentMethod === PAYMENT_METHODS.card ? externalAed : 0,
      applePayAed: normalizedPaymentMethod === PAYMENT_METHODS.applePay ? externalAed : 0,
      samsungPayAed: normalizedPaymentMethod === PAYMENT_METHODS.samsungPay ? externalAed : 0,
    },
    sharePointsUsed,
    sharePointsRemaining: DEMO_SHARE_POINTS - sharePointsUsed,
    walletRemaining: roundDemoMoney(DEMO_WALLET_BALANCE - appliedWalletAed),
  };
}
