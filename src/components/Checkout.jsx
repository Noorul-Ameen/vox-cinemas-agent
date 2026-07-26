import { lazy, Suspense, useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";

const DemoPaymentGateway = lazy(() => import("./DemoPaymentGateway.jsx"));

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function safeMoneyFormatter(dir, currency) {
  const locale = dir === "rtl" ? "ar-AE" : "en-AE";
  return (value) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "AED",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function Checkout({
  order = {},
  checkoutId,
  dir: requestedDir,
  onBack,
  onEditSeats,
  onCancel,
  onComplete,
  onReviewStateChange,
}) {
  const i18n = useI18n();
  const dir = requestedDir || i18n.dir || "ltr";
  const ar = dir === "rtl";
  const currency = order.currency || "AED";
  const fallbackMoney = safeMoneyFormatter(dir, currency);
  const money = (value) => typeof i18n.formatCurrency === "function"
    ? i18n.formatCurrency(value, currency)
    : fallbackMoney(value);
  const seatCount = Array.isArray(order.seats) ? order.seats.length : Number(order.ticketCount) || 0;
  const [status, setStatus] = useState("ready");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  const copy = ar ? {
    eyebrow: "إتمام الدفع",
    title: "مراجعة إتمام الحجز",
    subtitle: "اختر العرض وطريقة تقسيم المبلغ. ستظهر لك مراجعة نهائية قبل معالجة الدفع.",
    tickets: "التذاكر",
    seats: "المقاعد",
    total: "إجمالي الطلب",
    back: "تعديل المقاعد",
    loading: "جار تحميل خيارات الدفع...",
    processing: "جار معالجة الدفع",
    processingHelp: "جار التحقق من العرض وتقسيم المبلغ وإنشاء الإيصال.",
    approved: "تمت معالجة الدفع",
    approvedHelp: "تم إنشاء إيصال الدفع بنجاح.",
    failed: "تعذر إكمال معالجة الدفع. راجع التفاصيل وحاول مرة أخرى.",
  } : {
    eyebrow: "Checkout",
    title: "Checkout review",
    subtitle: "Choose an offer and funding split. You will see a final review before payment processing.",
    tickets: "Tickets",
    seats: "Seats",
    total: "Order total",
    back: "Edit seats",
    loading: "Loading payment options...",
    processing: "Processing payment",
    processingHelp: "Validating the offer, split funding, and receipt details.",
    approved: "Payment processed",
    approvedHelp: "The payment receipt was created successfully.",
    failed: "Payment processing could not be completed. Review the details and try again.",
  };

  useEffect(() => () => onReviewStateChange?.(false), [onReviewStateChange]);

  const processPayment = async (plan) => {
    if (!plan?.valid || plan?.simulated !== true || status !== "ready") return;
    setError("");
    setStatus("processing");
    onReviewStateChange?.(true);
    const nextReceipt = {
      ...plan,
      status: "processed",
      simulated: true,
      transactionRef: `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      processedAt: new Date().toISOString(),
    };
    try {
      await pause(800);
      setReceipt(nextReceipt);
      setStatus("complete");
      await pause(550);
      const accepted = await onComplete?.({ checkoutId: checkoutId || order.checkoutId, payment: nextReceipt });
      if (accepted === false) throw new Error("The payment receipt was rejected.");
    } catch {
      setError(copy.failed);
      setStatus("ready");
      setReceipt(null);
    } finally {
      onReviewStateChange?.(false);
    }
  };

  if (status === "processing" || status === "complete") {
    return (
      <section className="checkout" dir={dir} aria-labelledby="checkout-heading" data-testid="dummy-payment-processing" style={{ display: "grid", placeItems: "center", minHeight: 420, padding: 24, textAlign: "center" }}>
        <div style={{ display: "grid", gap: 12, justifyItems: "center", maxWidth: 470 }}>
          <div aria-hidden="true" style={{ width: 54, height: 54, borderRadius: "50%", border: "5px solid #f2d6d7", borderTopColor: "#e11b22", animation: status === "processing" ? "spin 900ms linear infinite" : "none" }} />
          <p style={{ margin: 0, color: "#e11b22", fontSize: 12, fontWeight: 850, letterSpacing: ".08em", textTransform: "uppercase" }}>{copy.eyebrow}</p>
          <h2 id="checkout-heading" style={{ margin: 0 }}>{status === "processing" ? copy.processing : copy.approved}</h2>
          <p style={{ margin: 0, color: "#6f6876", lineHeight: 1.55 }}>{status === "processing" ? copy.processingHelp : copy.approvedHelp}</p>
          {receipt?.amounts ? <strong>{money(receipt.amounts.payableTotal)}</strong> : null}
          {receipt?.transactionRef ? <code>{receipt.transactionRef}</code> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="checkout" dir={dir} aria-labelledby="checkout-heading" data-testid="checkout" style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "grid", gap: 7 }}>
        <p style={{ margin: 0, color: "#e11b22", fontSize: 12, fontWeight: 850, letterSpacing: ".08em", textTransform: "uppercase" }}>{copy.eyebrow}</p>
        <h2 id="checkout-heading" style={{ margin: 0 }}>{copy.title}</h2>
        <p style={{ margin: 0, color: "#6f6876", lineHeight: 1.55 }}>{copy.subtitle}</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, padding: 14, borderRadius: 16, background: "#f7f4f1" }}>
        <div><small>{copy.tickets}</small><strong style={{ display: "block" }}>{ar ? `${seatCount} مقاعد` : `${seatCount} seats`}</strong></div>
        <div><small>{copy.seats}</small><strong style={{ display: "block" }}>{Array.isArray(order.seats) ? order.seats.join(", ") : order.seats || "-"}</strong></div>
        <div><small>{copy.total}</small><strong style={{ display: "block" }}>{money(order.total)}</strong></div>
      </div>

      {error ? <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p> : null}
      <Suspense fallback={<p>{copy.loading}</p>}>
        <DemoPaymentGateway
          amount={order.total}
          ticketCount={seatCount || 1}
          currency={currency}
          dir={dir}
          formatCurrency={money}
          onProcess={processPayment}
        />
      </Suspense>

      <button type="button" onClick={onCancel || onEditSeats || onBack} style={{ justifySelf: "start", border: 0, background: "transparent", color: "#17151d", font: "inherit", fontWeight: 800, padding: "8px 0", cursor: "pointer" }}>
        {copy.back}
      </button>
    </section>
  );
}
