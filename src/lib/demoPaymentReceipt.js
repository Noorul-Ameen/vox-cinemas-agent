export function sanitizeDemoPaymentReceipt(payment, expectedTotal) {
  const source = payment?.amounts || {};
  const amounts = {
    originalTotal: Number(source.originalTotal),
    offerDiscount: Number(source.offerDiscount),
    payableTotal: Number(source.payableTotal),
    shareAed: Number(source.shareAed),
    walletAed: Number(source.walletAed),
    cardAed: Number(source.cardAed),
  };
  const values = Object.values(amounts);
  const funded = amounts.shareAed + amounts.walletAed + amounts.cardAed;
  const valid = payment?.simulated === true
    && payment?.status === "processed"
    && /^TXN-[A-Z0-9-]+$/.test(String(payment?.transactionRef || ""))
    && values.every(Number.isFinite)
    && Math.abs(amounts.originalTotal - Number(expectedTotal)) < 0.011
    && amounts.originalTotal > 0
    && values.slice(1).every((value) => value >= 0)
    && Math.abs(amounts.payableTotal + amounts.offerDiscount - amounts.originalTotal) < 0.011
    && Math.abs(funded - amounts.payableTotal) < 0.011;
  if (!valid) return null;
  return {
    status: "processed",
    simulated: true,
    transactionRef: String(payment.transactionRef),
    processedAt: String(payment.processedAt || new Date().toISOString()),
    offer: payment.offer || null,
    offerResult: String(payment.offerResult || ""),
    cardLast4: String(payment.cardLast4 || "").slice(-4),
    amounts,
    sharePointsUsed: Math.max(0, Number(payment.sharePointsUsed) || 0),
    sharePointsRemaining: Math.max(0, Number(payment.sharePointsRemaining) || 0),
    walletRemaining: Math.max(0, Number(payment.walletRemaining) || 0),
  };
}
