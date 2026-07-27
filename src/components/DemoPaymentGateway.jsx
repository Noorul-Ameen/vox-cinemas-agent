import { useMemo, useState } from "react";
import { OFFERS } from "../offers/offersData.js";
import {
  DEMO_CARD_NUMBERS,
  DEMO_SHARE_POINTS,
  DEMO_SHARE_POINTS_PER_AED,
  DEMO_WALLET_BALANCE,
  createDemoPaymentPlan,
  maskDemoCardNumber,
} from "../lib/demoPaymentGateway.js";

const palette = {
  ink: "#102a3a",
  muted: "#536873",
  line: "#c9d9dc",
  paper: "#ffffff",
  wash: "#f1f7f7",
  accent: "#00766f",
  accentSoft: "#eaf8f6",
  good: "#147a55",
  bad: "#b42318",
  gold: "#8a6500",
};

const styles = {
  shell: { display: "grid", gap: 16, color: palette.ink },
  notice: { border: "1px solid #b8dcd8", background: palette.accentSoft, borderRadius: 14, padding: "12px 14px", color: "#174d50", fontSize: 13, lineHeight: 1.55 },
  section: { display: "grid", gap: 10, border: `1px solid ${palette.line}`, background: palette.paper, borderRadius: 16, padding: 14, boxShadow: "0 8px 24px rgba(16, 42, 58, 0.05)" },
  title: { margin: 0, fontSize: 16, fontWeight: 800 },
  help: { margin: 0, color: palette.muted, fontSize: 12, lineHeight: 1.5 },
  label: { display: "grid", gap: 7, fontSize: 13, fontWeight: 750 },
  select: { width: "100%", minHeight: 44, border: `1px solid ${palette.line}`, borderRadius: 10, background: palette.paper, color: palette.ink, padding: "0 11px", font: "inherit" },
  input: { width: "100%", minHeight: 44, boxSizing: "border-box", border: `1px solid ${palette.line}`, borderRadius: 10, background: palette.paper, color: palette.ink, padding: "0 12px", font: "inherit" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 },
  testCard: { display: "grid", gap: 5, textAlign: "start", border: `1px solid ${palette.line}`, borderRadius: 13, background: palette.wash, padding: 12, cursor: "pointer", color: palette.ink, transition: "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease" },
  number: { fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 13, letterSpacing: ".03em" },
  badgeGood: { width: "fit-content", color: palette.good, fontSize: 11, fontWeight: 800 },
  badgeBad: { width: "fit-content", color: palette.bad, fontSize: 11, fontWeight: 800 },
  offer: { borderInlineStart: `4px solid ${palette.gold}`, background: "#fffaf0", borderRadius: 10, padding: "10px 12px", display: "grid", gap: 3 },
  toggleRow: { display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 750 },
  amountGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "end" },
  amountBadge: { minWidth: 105, borderRadius: 10, background: palette.wash, padding: "11px 12px", fontSize: 12, color: palette.muted },
  error: { margin: 0, color: palette.bad, fontSize: 12, lineHeight: 1.45 },
  success: { margin: 0, color: palette.good, fontSize: 12, lineHeight: 1.45 },
  totals: { display: "grid", gap: 8, borderRadius: 14, background: palette.wash, padding: 14 },
  row: { display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13 },
  strongRow: { display: "flex", justifyContent: "space-between", gap: 16, borderTop: `1px solid ${palette.line}`, paddingTop: 10, fontSize: 15, fontWeight: 850 },
  actions: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" },
  primary: { minHeight: 44, border: 0, borderRadius: 999, background: palette.accent, color: "white", padding: "0 20px", font: "inherit", fontWeight: 850, cursor: "pointer", boxShadow: "0 8px 18px rgba(0, 118, 111, 0.2)" },
  secondary: { minHeight: 44, border: `1px solid ${palette.line}`, borderRadius: 999, background: palette.paper, color: palette.ink, padding: "0 18px", font: "inherit", fontWeight: 800, cursor: "pointer" },
};

function localValue(value, language) {
  if (!value || typeof value !== "object") return String(value || "");
  return value[language] || value.en || value.ar || "";
}

export default function DemoPaymentGateway({
  amount,
  ticketCount = 1,
  currency = "AED",
  dir = "ltr",
  formatCurrency,
  onProcess,
}) {
  const language = dir === "rtl" ? "ar" : "en";
  const ar = language === "ar";
  const [phase, setPhase] = useState("configure");
  const [offerId, setOfferId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [useShare, setUseShare] = useState(true);
  const [sharePoints, setSharePoints] = useState(String(DEMO_SHARE_POINTS));
  const [useWallet, setUseWallet] = useState(true);
  const [walletAed, setWalletAed] = useState(String(DEMO_WALLET_BALANCE));

  const copy = ar ? {
    notice: "دفع آمن. اختر العرض وطريقة تقسيم المبلغ ثم راجع التفاصيل قبل المعالجة.",
    configure: "إعداد الدفع",
    offer: "عرض البطاقة",
    noOffer: "بدون عرض بطاقة",
    offerHelp: "اختر أي عرض منشور للتحقق من الأهلية وقيمة الخصم.",
    cards: "بطاقات الدفع المتاحة",
    eligibleCard: "مؤهلة لكل العروض المختارة",
    ineligibleCard: "غير مؤهلة لأي عرض مختار",
    useCard: "استخدام هذه البطاقة",
    selectedCard: "البطاقة المحددة",
    combined: "الدفع المدمج",
    combinedHelp: "استخدم نقاط SHARE ومحفظة VOX معاً، وادفع أي مبلغ متبقٍ بالبطاقة المحددة. يمكنك إلغاء أي مصدر دفع قبل المراجعة.",
    share: "استخدام نقاط SHARE",
    shareAvailable: `رصيد SHARE المتاح: ${DEMO_SHARE_POINTS.toLocaleString("ar-AE")} نقاط`,
    shareAmount: "نقاط SHARE المراد استخدامها",
    sharePointUnit: "نقطة",
    shareBalanceExceeded: `رصيدك المتاح ${DEMO_SHARE_POINTS.toLocaleString("ar-AE")} نقاط SHARE. أدخل ${DEMO_SHARE_POINTS.toLocaleString("ar-AE")} نقاط أو أقل.`,
    shareWholePoints: "أدخل عدداً صحيحاً من نقاط SHARE.",
    wallet: "استخدام محفظة VOX",
    walletAvailable: `رصيد المحفظة ${DEMO_WALLET_BALANCE} د.إ`,
    walletAmount: "قيمة المحفظة بالدرهم",
    cardRemainder: "المتبقي على البطاقة",
    review: "مراجعة الدفع",
    final: "ملخص الدفع النهائي",
    original: "الإجمالي الأصلي",
    discount: "خصم العرض",
    payable: "الإجمالي بعد العرض",
    shareUsed: "SHARE",
    walletUsed: "محفظة VOX",
    cardUsed: "البطاقة",
    change: "تعديل الدفع",
    process: "معالجة الدفع",
    ready: "خطة الدفع جاهزة للمراجعة.",
    invalidAmount: "تعذر إنشاء خطة لهذا المبلغ.",
    twoTickets: "يتطلب عرض اشتر تذكرة واحصل على أخرى تذكرتين على الأقل.",
    offerCardRequired: "اختر البطاقة المؤهلة لتطبيق العرض المحدد.",
    notEligible: "هذه البطاقة غير مؤهلة للعرض المحدد.",
    cardRequired: "اختر إحدى البطاقتين لدفع المبلغ المتبقي.",
    unsupported: "لا يمكن تطبيق هذا العرض.",
    reviewHelp: "راجع جميع التفاصيل قبل معالجة الدفع.",
  } : {
    notice: "Secure checkout. Choose an offer and funding split, then review the details before processing.",
    configure: "Configure payment",
    offer: "Card offer",
    noOffer: "No card offer",
    offerHelp: "Choose any published offer to validate eligibility and adjustment.",
    cards: "Available payment cards",
    eligibleCard: "Eligible for every selected offer",
    ineligibleCard: "Not eligible for any selected offer",
    useCard: "Use this card",
    selectedCard: "Selected card",
    combined: "Combined payment",
    combinedHelp: "Use SHARE points and VOX Wallet together, then pay any remaining amount with the selected card. Either balance can be declined before review.",
    share: "Use SHARE points",
    shareAvailable: `Available SHARE balance: ${DEMO_SHARE_POINTS.toLocaleString("en-AE")} points`,
    shareAmount: "SHARE points to redeem",
    sharePointUnit: "points",
    shareBalanceExceeded: `You have ${DEMO_SHARE_POINTS.toLocaleString("en-AE")} SHARE points available. Enter ${DEMO_SHARE_POINTS.toLocaleString("en-AE")} points or fewer.`,
    shareWholePoints: "Enter a whole number of SHARE points.",
    wallet: "Use VOX Wallet",
    walletAvailable: `Wallet balance AED ${DEMO_WALLET_BALANCE}`,
    walletAmount: "Wallet value in AED",
    cardRemainder: "Card remainder",
    review: "Review payment",
    final: "Final payment summary",
    original: "Original total",
    discount: "Offer discount",
    payable: "Total after offer",
    shareUsed: "SHARE points",
    walletUsed: "VOX Wallet",
    cardUsed: "Card",
    change: "Change payment",
    process: "Process payment",
    ready: "The payment plan is ready to review.",
    invalidAmount: "A payment plan cannot be created for this amount.",
    twoTickets: "This buy-one-get-one offer requires at least two tickets.",
    offerCardRequired: "Choose the eligible card to apply the selected offer.",
    notEligible: "This card is not eligible for the selected offer.",
    cardRequired: "Choose either available card for the remaining card balance.",
    unsupported: "This offer cannot be applied.",
    reviewHelp: "Review all details before processing the payment.",
  };

  const selectedOffer = useMemo(
    () => OFFERS.find((offer) => offer.id === offerId) || null,
    [offerId],
  );
  const plan = useMemo(() => createDemoPaymentPlan({
    amount,
    ticketCount,
    offer: selectedOffer,
    cardNumber,
    sharePoints: useShare ? sharePoints : 0,
    walletAed: useWallet ? walletAed : 0,
  }), [amount, ticketCount, selectedOffer, cardNumber, useShare, sharePoints, useWallet, walletAed]);

  const money = (value) => {
    if (typeof formatCurrency === "function") return formatCurrency(value, currency);
    return new Intl.NumberFormat(ar ? "ar-AE" : "en-AE", { style: "currency", currency }).format(Number(value) || 0);
  };
  const reason = {
    invalid_amount: copy.invalidAmount,
    offer_requires_two_tickets: copy.twoTickets,
    offer_card_required: copy.offerCardRequired,
    offer_card_not_eligible: copy.notEligible,
    card_required: copy.cardRequired,
    share_points_exceed_balance: copy.shareBalanceExceeded,
    share_points_invalid: copy.shareWholePoints,
    unsupported_offer: copy.unsupported,
    funding_mismatch: copy.unsupported,
  }[plan.reason] || "";
  const cardOfferErrorShown = Boolean(cardNumber && selectedOffer && !plan.cardValidation?.eligible);
  const shareValidationErrorShown = Boolean(useShare && plan.shareValidation && !plan.shareValidation.valid);
  const selectedOfferLabel = selectedOffer
    ? `${localValue(selectedOffer.bank, language)} - ${localValue(selectedOffer.headline, language)}`
    : copy.noOffer;
  const points = (value) => `${Math.max(0, Number(value) || 0).toLocaleString(ar ? "ar-AE" : "en-AE")} ${copy.sharePointUnit}`;

  if (phase === "review") {
    return (
      <section style={styles.shell} dir={dir} data-testid="dummy-payment-review">
        <div style={styles.notice}>{copy.notice}</div>
        <div style={styles.section}>
          <h3 style={styles.title}>{copy.final}</h3>
          <div style={styles.offer}>
            <strong>{selectedOfferLabel}</strong>
            {selectedOffer ? <span style={styles.help}>{localValue(selectedOffer.summary, language)}</span> : null}
          </div>
          <div style={styles.totals}>
            <div style={styles.row}><span>{copy.original}</span><strong>{money(plan.amounts.originalTotal)}</strong></div>
            <div style={styles.row}><span>{copy.discount}</span><strong>-{money(plan.amounts.offerDiscount)}</strong></div>
            <div style={styles.strongRow}><span>{copy.payable}</span><span>{money(plan.amounts.payableTotal)}</span></div>
            <div style={styles.row}><span>{copy.shareUsed}</span><strong>{points(plan.sharePointsUsed)}</strong></div>
            <div style={styles.row}><span>{copy.walletUsed}</span><strong>{money(plan.amounts.walletAed)}</strong></div>
            <div style={styles.row}><span>{copy.cardUsed}{plan.cardLast4 ? ` •••• ${plan.cardLast4}` : ""}</span><strong>{money(plan.amounts.cardAed)}</strong></div>
          </div>
          <p style={styles.help}>{copy.reviewHelp}</p>
          <div style={styles.actions}>
            <button type="button" style={styles.secondary} onClick={() => setPhase("configure")}>{copy.change}</button>
            <button type="button" style={styles.primary} data-testid="process-dummy-payment" onClick={() => onProcess?.(plan)}>{copy.process}</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.shell} dir={dir} data-testid="dummy-payment-gateway">
      <div style={styles.notice}>{copy.notice}</div>
      <div style={styles.section}>
        <h3 style={styles.title}>{copy.configure}</h3>
        <label style={styles.label}>
          <span>{copy.offer}</span>
          <select
            style={styles.select}
            value={offerId}
            aria-label={copy.offer}
            onChange={(event) => setOfferId(event.target.value)}
          >
            <option value="">{copy.noOffer}</option>
            {OFFERS.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {localValue(offer.bank, language)} - {localValue(offer.headline, language)}
              </option>
            ))}
          </select>
        </label>
        <p style={styles.help}>{copy.offerHelp}</p>
        {selectedOffer ? (
          <div style={styles.offer} data-testid="selected-offer-summary">
            <strong>{selectedOfferLabel}</strong>
            <span style={styles.help}>{localValue(selectedOffer.summary, language)}</span>
          </div>
        ) : null}
      </div>

      <div
        style={{ ...styles.section, borderColor: "#9bcfc9", background: palette.accentSoft }}
        data-testid="combined-payment-options"
      >
        <h3 style={styles.title}>{copy.combined}</h3>
        <p style={styles.help}>{copy.combinedHelp}</p>
        <label style={styles.toggleRow}>
          <input type="checkbox" checked={useShare} onChange={(event) => setUseShare(event.target.checked)} />
          <span>{copy.share}</span>
        </label>
        <p style={styles.help}>{copy.shareAvailable}</p>
        {useShare ? (
          <div style={styles.amountGrid}>
            <label style={styles.label}>
              <span>{copy.shareAmount}</span>
              <input
                style={styles.input}
                type="number"
                min="0"
                max={DEMO_SHARE_POINTS}
                step="1"
                value={sharePoints}
                aria-label={copy.shareAmount}
                aria-invalid={shareValidationErrorShown}
                onChange={(event) => setSharePoints(event.target.value)}
              />
            </label>
            <span style={styles.amountBadge}>{copy.shareAvailable}</span>
          </div>
        ) : null}
        {shareValidationErrorShown ? <p style={styles.error} role="alert">{reason}</p> : null}
        <label style={styles.toggleRow}>
          <input type="checkbox" checked={useWallet} onChange={(event) => setUseWallet(event.target.checked)} />
          <span>{copy.wallet}</span>
        </label>
        <p style={styles.help}>{copy.walletAvailable}</p>
        {useWallet ? (
          <label style={styles.label}>
            <span>{copy.walletAmount}</span>
            <input
              style={styles.input}
              type="number"
              min="0"
              max={DEMO_WALLET_BALANCE}
              step="0.01"
              value={walletAed}
              aria-label={copy.walletAmount}
              onChange={(event) => setWalletAed(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      <div style={styles.section}>
        <h3 style={styles.title}>{copy.cards}</h3>
        <div style={styles.cardGrid}>
          <button
            type="button"
            style={{
              ...styles.testCard,
              ...(cardNumber === DEMO_CARD_NUMBERS.eligible
                ? { borderColor: palette.accent, background: palette.accentSoft, boxShadow: "0 0 0 2px rgba(0, 118, 111, 0.12)" }
                : {}),
            }}
            data-testid="eligible-test-card"
            aria-pressed={cardNumber === DEMO_CARD_NUMBERS.eligible}
            onClick={() => setCardNumber(DEMO_CARD_NUMBERS.eligible)}
          >
            <span style={styles.number}>{maskDemoCardNumber(DEMO_CARD_NUMBERS.eligible)}</span>
            <span style={styles.badgeGood}>{copy.eligibleCard}</span>
            <span style={styles.help}>{cardNumber === DEMO_CARD_NUMBERS.eligible ? copy.selectedCard : copy.useCard}</span>
          </button>
          <button
            type="button"
            style={{
              ...styles.testCard,
              ...(cardNumber === DEMO_CARD_NUMBERS.notEligible
                ? { borderColor: palette.accent, background: palette.accentSoft, boxShadow: "0 0 0 2px rgba(0, 118, 111, 0.12)" }
                : {}),
            }}
            data-testid="ineligible-test-card"
            aria-pressed={cardNumber === DEMO_CARD_NUMBERS.notEligible}
            onClick={() => setCardNumber(DEMO_CARD_NUMBERS.notEligible)}
          >
            <span style={styles.number}>{maskDemoCardNumber(DEMO_CARD_NUMBERS.notEligible)}</span>
            <span style={styles.badgeBad}>{copy.ineligibleCard}</span>
            <span style={styles.help}>{cardNumber === DEMO_CARD_NUMBERS.notEligible ? copy.selectedCard : copy.useCard}</span>
          </button>
        </div>
        {cardNumber && selectedOffer ? (
          plan.cardValidation?.eligible
            ? <p style={styles.success}>{copy.eligibleCard}</p>
            : <p style={styles.error}>{plan.cardValidation?.valid ? copy.notEligible : copy.offerCardRequired}</p>
        ) : null}
      </div>

      <div style={styles.totals}>
        <div style={styles.row}><span>{copy.discount}</span><strong>-{money(plan.amounts?.offerDiscount || 0)}</strong></div>
        <div style={styles.row}><span>{copy.shareUsed}</span><strong>{points(plan.sharePointsUsed)}</strong></div>
        <div style={styles.row}><span>{copy.walletUsed}</span><strong>{money(plan.amounts?.walletAed || 0)}</strong></div>
        <div style={styles.strongRow}><span>{copy.cardRemainder}</span><span>{money(plan.amounts?.cardAed || 0)}</span></div>
      </div>
      {plan.valid
        ? <p style={styles.success}>{copy.ready}</p>
        : cardOfferErrorShown
          ? null
          : shareValidationErrorShown
            ? null
          : <p style={styles.error} role="alert">{reason}</p>}
      <div style={styles.actions}>
        <button
          type="button"
          style={{ ...styles.primary, opacity: plan.valid ? 1 : 0.5, cursor: plan.valid ? "pointer" : "not-allowed" }}
          disabled={!plan.valid}
          data-testid="review-dummy-payment"
          onClick={() => setPhase("review")}
        >
          {copy.review}
        </button>
      </div>
    </section>
  );
}
