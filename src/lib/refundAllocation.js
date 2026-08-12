const SHARE_POINTS_PER_AED = 10;

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function roundMoney(value) {
  return Math.round((finiteNonNegative(value) + Number.EPSILON) * 100) / 100;
}

function normalizeAllocation(value, currency = "AED") {
  const sharePoints = Math.max(0, Math.floor(finiteNonNegative(value?.sharePoints)));
  const shareAed = roundMoney(value?.shareAed ?? (sharePoints / SHARE_POINTS_PER_AED));
  const voxWalletAed = roundMoney(value?.voxWalletAed);
  return Object.freeze({
    voxWalletAed,
    sharePoints,
    shareAed,
    totalAed: roundMoney(voxWalletAed + shareAed),
    currency: String(value?.currency || currency || "AED").toUpperCase(),
    paymentMethod: String(value?.paymentMethod || ""),
    status: String(value?.status || "calculated"),
  });
}

export function deriveRefundAllocation(booking = {}, override = null) {
  if (override && typeof override === "object") return normalizeAllocation(override, booking.currency);
  if (booking.refundAllocation && typeof booking.refundAllocation === "object") {
    return normalizeAllocation(booking.refundAllocation, booking.currency);
  }

  const payment = booking.demoPayment && typeof booking.demoPayment === "object" ? booking.demoPayment : null;
  const amounts = payment?.amounts && typeof payment.amounts === "object" ? payment.amounts : {};
  const sharePoints = Math.max(0, Math.floor(finiteNonNegative(payment?.sharePointsUsed)));
  const shareAed = roundMoney(amounts.shareAed || (sharePoints / SHARE_POINTS_PER_AED));
  const hasExternalTotal = Number.isFinite(Number(amounts.externalAed));
  const externalAed = hasExternalTotal
    ? roundMoney(amounts.externalAed)
    : roundMoney(
        finiteNonNegative(amounts.cardAed)
        + finiteNonNegative(amounts.applePayAed)
        + finiteNonNegative(amounts.samsungPayAed),
      );
  const walletPaidAed = roundMoney(amounts.walletAed);
  const hasReceiptBreakdown = Boolean(payment?.status === "processed")
    || sharePoints > 0
    || shareAed > 0
    || walletPaidAed > 0
    || externalAed > 0;
  const fallbackTotal = finiteNonNegative(booking.refundAmount ?? booking.total);
  const voxWalletAed = hasReceiptBreakdown
    ? roundMoney(walletPaidAed + externalAed)
    : roundMoney(Math.max(0, fallbackTotal - shareAed));

  return normalizeAllocation({
    voxWalletAed,
    sharePoints,
    shareAed,
    currency: booking.currency || "AED",
    paymentMethod: payment?.paymentMethod || (externalAed > 0 ? "card" : "balances"),
  }, booking.currency);
}

export function refundRouteLabel(allocation) {
  const safe = normalizeAllocation(allocation);
  if (safe.sharePoints > 0 && safe.voxWalletAed > 0) return "VOX Wallet + SHARE account";
  if (safe.sharePoints > 0) return "SHARE account";
  return "VOX Wallet";
}

export function formatRefundImpact(allocation, locale = "en") {
  const safe = normalizeAllocation(allocation);
  const ar = String(locale || "").startsWith("ar");
  const money = new Intl.NumberFormat(ar ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: safe.currency,
    minimumFractionDigits: 2,
  }).format(safe.voxWalletAed);
  const points = safe.sharePoints.toLocaleString(ar ? "ar-AE" : "en-AE");
  if (ar) {
    if (safe.sharePoints > 0 && safe.voxWalletAed > 0) return `سيتم رد ${money} إلى محفظة VOX وإعادة ${points} نقطة SHARE إلى حساب SHARE.`;
    if (safe.sharePoints > 0) return `ستتم إعادة ${points} نقطة SHARE إلى حساب SHARE.`;
    return `سيتم رد ${money} إلى محفظة VOX.`;
  }
  if (safe.sharePoints > 0 && safe.voxWalletAed > 0) return `${money} will be refunded to VOX Wallet and ${points} SHARE points will be returned to the SHARE account.`;
  if (safe.sharePoints > 0) return `${points} SHARE points will be returned to the SHARE account.`;
  return `${money} will be refunded to VOX Wallet.`;
}
