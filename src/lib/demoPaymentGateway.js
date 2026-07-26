export const DEMO_CARD_NUMBERS = Object.freeze({
  eligible: "4111111111111111",
  notEligible: "5555555555554444",
});

export const DEMO_CARD_OFFER_PERCENT = 20;
export const DEMO_WALLET_BALANCE = 500;
export const DEMO_SHARE_POINTS = 5000;
export const DEMO_SHARE_POINTS_PER_AED = 10;

function safeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function normalizeDemoCardNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 16);
}

export function formatDemoCardNumber(value) {
  return normalizeDemoCardNumber(value).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function maskDemoCardNumber(value) {
  const digits = normalizeDemoCardNumber(value);
  return digits.length === 16 ? `**** **** **** ${digits.slice(-4)}` : "**** **** **** ****";
}

export function validateDemoCardOffer(value) {
  const cardNumber = normalizeDemoCardNumber(value);
  const last4 = cardNumber.slice(-4);

  if (cardNumber === DEMO_CARD_NUMBERS.eligible) {
    return {
      method: "card",
      status: "eligible",
      eligible: true,
      last4,
      discountPercent: DEMO_CARD_OFFER_PERCENT,
    };
  }

  if (cardNumber === DEMO_CARD_NUMBERS.notEligible) {
    return {
      method: "card",
      status: "not_eligible",
      eligible: false,
      last4,
      discountPercent: 0,
    };
  }

  return {
    method: "card",
    status: cardNumber.length === 16 ? "unrecognized" : "incomplete",
    eligible: false,
    last4,
    discountPercent: 0,
  };
}

export function validateDemoWallet(amount) {
  const normalizedAmount = safeAmount(amount);
  const eligible = normalizedAmount > 0 && normalizedAmount <= DEMO_WALLET_BALANCE;
  return {
    method: "wallet",
    status: eligible ? "eligible" : normalizedAmount > 0 ? "insufficient" : "invalid_amount",
    eligible,
    amount: normalizedAmount,
    balance: DEMO_WALLET_BALANCE,
  };
}

export function validateDemoSharePoints(amount) {
  const normalizedAmount = safeAmount(amount);
  const pointsRequired = Math.ceil(normalizedAmount * DEMO_SHARE_POINTS_PER_AED);
  const eligible = normalizedAmount > 0 && pointsRequired <= DEMO_SHARE_POINTS;
  return {
    method: "share",
    status: eligible ? "eligible" : normalizedAmount > 0 ? "insufficient" : "invalid_amount",
    eligible,
    amount: normalizedAmount,
    pointsAvailable: DEMO_SHARE_POINTS,
    pointsRequired,
    pointsPerAed: DEMO_SHARE_POINTS_PER_AED,
  };
}
