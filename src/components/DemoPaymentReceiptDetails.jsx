import React from "react";

function ReceiptRow({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 5, fontSize: 13 }}>
      <span style={{ flexShrink: 0, color: "#6f6876" }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere", textAlign: "end", fontWeight: 600 }}>{children}</span>
    </div>
  );
}

export default function DemoPaymentReceiptDetails({ booking, locale, formatCurrency }) {
  const ar = String(locale || "").startsWith("ar");
  const payment = booking?.demoPayment;
  if (payment?.status !== "processed") return null;
  const copy = ar ? {
    title: "إيصال الدفع",
    ready: "تمت معالجة الدفع بنجاح.",
    original: "الإجمالي الأصلي",
    offer: "عرض البطاقة",
    share: "النقاط المستخدمة",
    shareValue: "قيمة النقاط بالدرهم",
    wallet: "محفظة VOX المستخدمة",
    card: "البطاقة المستخدمة",
    transaction: "مرجع المعاملة",
  } : {
    title: "Payment receipt",
    ready: "Payment processed successfully.",
    original: "Original total",
    offer: "Card offer",
    share: "Points redeemed",
    shareValue: "Equivalent AED discount",
    wallet: "VOX Wallet used",
    card: "Card used",
    transaction: "Transaction reference",
  };
  const money = (value) => formatCurrency(value, booking.currency || "AED");
  const points = (value) => `${Math.max(0, Number(value) || 0).toLocaleString(ar ? "ar-AE" : "en-AE")} ${ar ? "نقطة" : "points"}`;
  const offer = payment.offer;
  const language = ar ? "ar" : "en";
  const offerLabel = offer
    ? [offer.bank?.[language] || offer.bank?.en, offer.headline?.[language] || offer.headline?.en].filter(Boolean).join(" - ")
    : "";
  return (
    <React.Fragment>
      <div style={{ margin: "5px 0 10px", padding: "9px 10px", border: "1px solid #b8dcd8", borderRadius: 10, background: "#eaf8f6" }}>
        <strong>{copy.title}</strong>
        <div style={{ marginTop: 2, color: "#6f6876", fontSize: 11 }}>{copy.ready}</div>
      </div>
      <ReceiptRow label={copy.original}><span dir="ltr">{money(booking.originalTotal ?? payment.amounts?.originalTotal)}</span></ReceiptRow>
      {offerLabel ? <ReceiptRow label={copy.offer}><bdi dir="auto">{offerLabel}</bdi></ReceiptRow> : null}
      <ReceiptRow label={copy.share}><span dir="ltr">{points(payment.sharePointsUsed)}</span></ReceiptRow>
      <ReceiptRow label={copy.shareValue}><span dir="ltr">-{money(payment.amounts?.shareAed)}</span></ReceiptRow>
      <ReceiptRow label={copy.wallet}><span dir="ltr">{money(payment.amounts?.walletAed)}</span></ReceiptRow>
      <ReceiptRow label={copy.card}><span dir="ltr">{money(payment.amounts?.cardAed)}{payment.cardLast4 ? ` (**** ${payment.cardLast4})` : ""}</span></ReceiptRow>
      <ReceiptRow label={copy.transaction}><span dir="ltr" style={{ fontFamily: "monospace", color: "#00766f" }}>{payment.transactionRef}</span></ReceiptRow>
    </React.Fragment>
  );
}
