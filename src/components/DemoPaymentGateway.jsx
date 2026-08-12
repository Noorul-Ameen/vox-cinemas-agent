import { useMemo, useState } from "react";
import { OFFERS } from "../offers/offersData.js";
import {
  DEMO_CARD_NUMBERS,
  DEMO_SHARE_AED_VALUE,
  DEMO_SHARE_POINTS,
  DEMO_SHARE_POINTS_PER_AED,
  DEMO_WALLET_BALANCE,
  PAYMENT_METHODS,
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
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [useShare, setUseShare] = useState(false);
  const [sharePoints, setSharePoints] = useState(String(DEMO_SHARE_POINTS));
  const [useWallet, setUseWallet] = useState(false);
  const [walletAed, setWalletAed] = useState(String(DEMO_WALLET_BALANCE));

  const copy = ar ? {
    paymentMethod: "طريقة الدفع",
    paymentMethodPlaceholder: "اختر طريقة الدفع",
    samsungPay: "Samsung Pay",
    applePay: "Apple Pay",
    cardMethod: "بطاقة",
    methodHelp: "اختر طريقة دفع للمبلغ المتبقي بعد نقاط SHARE ومحفظة VOX.",
    offersCardOnly: "عروض البطاقات متاحة فقط عند اختيار البطاقة.",
    balancesCoverTotal: "تغطي نقاط SHARE ومحفظة VOX المبلغ بالكامل، لذلك لا يلزم اختيار طريقة دفع إضافية.",
    paymentMethodUsed: "طريقة الدفع",
    externalRemainder: "المبلغ عبر طريقة الدفع",
    pointsRedeemedExplicit: "نقاط SHARE المستخدمة",
    notice: "دفع آمن. اختر العرض وطريقة تقسيم المبلغ ثم راجع التفاصيل قبل المعالجة.",
    configure: "إعداد الدفع",
    offer: "عرض البطاقة",
    noOffer: "بدون عرض بطاقة",
    offerHelp: "اختر أي عرض منشور للتحقق من الأهلية وقيمة الخصم.",
    cards: "بطاقة الدفع",
    cardPlaceholder: "اختر بطاقة",
    eligibleCard: "مؤهلة للعرض المحدد",
    ineligibleCard: "غير مؤهلة للعرض المحدد",
    cardAvailable: "متاحة للدفع",
    useCard: "استخدام هذه البطاقة",
    selectedCard: "البطاقة المحددة",
    cvv: "رمز CVV",
    cvvHelp: "أدخل رمز CVV المكوّن من 3 أرقام للبطاقة المحددة.",
    cvvRequired: "أدخل رمز CVV للبطاقة المحددة.",
    cvvInvalid: "يجب أن يتكون رمز CVV من 3 أرقام.",
    combined: "الدفع المدمج",
    combinedHelp: "استخدم نقاط SHARE ومحفظة VOX معاً، وادفع أي مبلغ متبقٍ بالبطاقة المحددة. يمكنك إلغاء أي مصدر دفع قبل المراجعة.",
    share: "استخدام نقاط SHARE",
    shareAvailable: `رصيد SHARE المتاح: ${DEMO_SHARE_POINTS.toLocaleString("ar-AE")} نقاط بقيمة ${DEMO_SHARE_AED_VALUE.toLocaleString("ar-AE")} د.إ`,
    shareAmount: "نقاط SHARE المراد استخدامها",
    sharePointUnit: "نقطة",
    shareBalanceExceeded: `رصيدك المتاح ${DEMO_SHARE_POINTS.toLocaleString("ar-AE")} نقاط SHARE. أدخل ${DEMO_SHARE_POINTS.toLocaleString("ar-AE")} نقاط أو أقل.`,
    shareWholePoints: "أدخل عدداً صحيحاً من نقاط SHARE.",
    wallet: "استخدام محفظة VOX",
    walletAvailable: `رصيد المحفظة ${DEMO_WALLET_BALANCE} د.إ`,
    walletAmount: "قيمة المحفظة بالدرهم",
    pointsRedeemed: "النقاط المستخدمة",
    pointsEquivalent: "قيمة النقاط بالدرهم",
    remainingPayment: "المبلغ المتبقي للدفع",
    cardRemainder: "المتبقي على البطاقة",
    review: "مراجعة الدفع",
    final: "ملخص الدفع النهائي",
    original: "الإجمالي الأصلي",
    discount: "خصم العرض",
    payable: "الإجمالي بعد العرض",
    shareUsed: "نقاط SHARE",
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
    noCardRequired: "لا يلزم اختيار بطاقة أو إدخال رمز CVV لأن نقاط SHARE ومحفظة VOX تغطيان المبلغ بالكامل.",
    unsupported: "لا يمكن تطبيق هذا العرض.",
    offerBalancesRequireFullPrice: "لا يمكن دمج نقاط SHARE أو محفظة VOX مع هذا العرض لأن جميع التذاكر مشمولة بالعرض. أزل الأرصدة أو اختر الحجز بدون عرض بطاقة.",
    offerBalancesLimit: (count, amount) => `يمكن استخدام نقاط SHARE ومحفظة VOX فقط مقابل قيمة التذاكر بالسعر الكامل: ${count}، بحد أقصى ${amount}.`,
    reviewHelp: "راجع جميع التفاصيل قبل معالجة الدفع.",
  } : {
    paymentMethod: "Payment method",
    paymentMethodPlaceholder: "Select a payment method",
    samsungPay: "Samsung Pay",
    applePay: "Apple Pay",
    cardMethod: "Card",
    methodHelp: "Choose a payment method for the balance remaining after SHARE points and VOX Wallet.",
    offersCardOnly: "Card offers are available only when Card is selected.",
    balancesCoverTotal: "SHARE points and VOX Wallet cover the full amount, so no additional payment method is required.",
    paymentMethodUsed: "Payment method",
    externalRemainder: "Payment method remainder",
    pointsRedeemedExplicit: "SHARE points redeemed",
    notice: "Secure checkout. Choose an offer and funding split, then review the details before processing.",
    configure: "Configure payment",
    offer: "Card offer",
    noOffer: "No card offer",
    offerHelp: "Choose any published offer to validate eligibility and adjustment.",
    cards: "Payment card",
    cardPlaceholder: "Select a card",
    eligibleCard: "Eligible for the selected offer",
    ineligibleCard: "Not eligible for the selected offer",
    cardAvailable: "Available for payment",
    useCard: "Use this card",
    selectedCard: "Selected card",
    cvv: "Card CVV",
    cvvHelp: "Enter the 3-digit CVV for the selected card.",
    cvvRequired: "Enter the CVV for the selected card.",
    cvvInvalid: "CVV must contain 3 digits.",
    combined: "Combined payment",
    combinedHelp: "Use SHARE points and VOX Wallet together, then pay any remaining amount with the selected payment method. Either balance can be declined before review.",
    share: "Use SHARE points",
    shareAvailable: `Available SHARE balance: ${DEMO_SHARE_POINTS.toLocaleString("en-AE")} points worth AED ${DEMO_SHARE_AED_VALUE.toLocaleString("en-AE")}`,
    shareAmount: "SHARE points to redeem",
    sharePointUnit: "SHARE points",
    shareBalanceExceeded: `You have ${DEMO_SHARE_POINTS.toLocaleString("en-AE")} SHARE points available. Enter ${DEMO_SHARE_POINTS.toLocaleString("en-AE")} points or fewer.`,
    shareWholePoints: "Enter a whole number of SHARE points.",
    wallet: "Use VOX Wallet",
    walletAvailable: `Wallet balance AED ${DEMO_WALLET_BALANCE}`,
    walletAmount: "Wallet value in AED",
    pointsRedeemed: "Points redeemed",
    pointsEquivalent: "Equivalent AED discount",
    remainingPayment: "Remaining amount to be paid",
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
    noCardRequired: "No payment method, card, or CVV is required because SHARE points and VOX Wallet cover the full amount.",
    unsupported: "This offer cannot be applied.",
    offerBalancesRequireFullPrice: "SHARE Points and VOX Wallet cannot be combined with this card offer because every ticket is covered by the offer. Remove the balances or choose no card offer.",
    offerBalancesLimit: (count, amount) => `SHARE Points and VOX Wallet can be used only against the ${count} full-price ${count === 1 ? "ticket" : "tickets"}, up to ${amount}.`,
    reviewHelp: "Review all details before processing the payment.",
  };

  const selectedOffer = useMemo(
    () => OFFERS.find((offer) => offer.id === offerId) || null,
    [offerId],
  );
  const fundingPreview = useMemo(() => createDemoPaymentPlan({
    amount,
    ticketCount,
    paymentMethod: "",
    sharePoints: useShare ? sharePoints : 0,
    walletAed: useWallet ? walletAed : 0,
  }), [amount, ticketCount, useShare, sharePoints, useWallet, walletAed]);
  const externalPaymentRequired = Number(fundingPreview.amounts?.externalAed || 0) > 0;
  const activeOffer = externalPaymentRequired && paymentMethod === PAYMENT_METHODS.card ? selectedOffer : null;
  const plan = useMemo(() => createDemoPaymentPlan({
    amount,
    ticketCount,
    offer: activeOffer,
    paymentMethod: externalPaymentRequired ? paymentMethod : PAYMENT_METHODS.balances,
    cardNumber,
    cvv,
    sharePoints: useShare ? sharePoints : 0,
    walletAed: useWallet ? walletAed : 0,
  }), [amount, ticketCount, activeOffer, paymentMethod, externalPaymentRequired, cardNumber, cvv, useShare, sharePoints, useWallet, walletAed]);

  const money = (value) => {
    if (typeof formatCurrency === "function") return formatCurrency(value, currency);
    return new Intl.NumberFormat(ar ? "ar-AE" : "en-AE", { style: "currency", currency }).format(Number(value) || 0);
  };
  const reason = {
    invalid_amount: copy.invalidAmount,
    offer_requires_two_tickets: copy.twoTickets,
    offer_card_required: copy.offerCardRequired,
    offer_card_not_eligible: copy.notEligible,
    offer_requires_card_payment: copy.offersCardOnly,
    payment_method_required: copy.paymentMethodPlaceholder,
    card_required: copy.cardRequired,
    cvv_required: copy.cvvRequired,
    cvv_invalid: copy.cvvInvalid,
    share_points_exceed_balance: copy.shareBalanceExceeded,
    share_points_invalid: copy.shareWholePoints,
    offer_balances_require_full_price_ticket: copy.offerBalancesRequireFullPrice,
    offer_balances_exceed_full_price_amount: copy.offerBalancesLimit(plan.storedValuePolicy?.fullPriceTicketCount || 0, money(plan.storedValuePolicy?.limitAed || 0)),
    unsupported_offer: copy.unsupported,
    funding_mismatch: copy.unsupported,
  }[plan.reason] || "";
  const cardOfferErrorShown = Boolean(cardNumber && activeOffer && !plan.cardValidation?.eligible);
  const shareValidationErrorShown = Boolean(useShare && plan.shareValidation && !plan.shareValidation.valid);
  const cardControlsRequired = Boolean(plan.requirements?.card);
  const cardSelectionNeedsCvv = Boolean(cardNumber && plan.requirements?.cvv);
  const cvvErrorShown = Boolean(cardSelectionNeedsCvv && cvv && !plan.cvvValidation?.valid);
  const selectedOfferLabel = activeOffer
    ? `${localValue(activeOffer.bank, language)} - ${localValue(activeOffer.headline, language)}`
    : copy.noOffer;
  const paymentMethodLabel = {
    [PAYMENT_METHODS.samsungPay]: copy.samsungPay,
    [PAYMENT_METHODS.applePay]: copy.applePay,
    [PAYMENT_METHODS.card]: copy.cardMethod,
  }[plan.paymentMethod] || "";
  const points = (value) => `${Math.max(0, Number(value) || 0).toLocaleString(ar ? "ar-AE" : "en-AE")} ${ar ? "نقطة SHARE" : copy.sharePointUnit}`;

  if (phase === "review") {
    return (
      <section style={styles.shell} dir={dir} data-testid="dummy-payment-review">
        <div style={styles.notice}>{copy.notice}</div>
        <div style={styles.section}>
          <h3 style={styles.title}>{copy.final}</h3>
          {activeOffer ? <div style={styles.offer}>
            <strong>{selectedOfferLabel}</strong>
            <span style={styles.help}>{localValue(activeOffer.summary, language)}</span>
          </div> : null}
          <div style={styles.totals}>
            <div style={styles.row}><span>{copy.original}</span><strong>{money(plan.amounts.originalTotal)}</strong></div>
            <div style={styles.row}><span>{copy.discount}</span><strong>-{money(plan.amounts.offerDiscount)}</strong></div>
            <div style={styles.strongRow}><span>{copy.payable}</span><span>{money(plan.amounts.payableTotal)}</span></div>
            <div style={styles.row}><span>{copy.pointsRedeemedExplicit}</span><strong>{points(plan.sharePointsUsed)}</strong></div>
            <div style={styles.row}><span>{copy.pointsEquivalent}</span><strong>-{money(plan.amounts.shareAed)}</strong></div>
            <div style={styles.strongRow}><span>{copy.remainingPayment}</span><span>{money(plan.amounts.remainingAfterPointsAed)}</span></div>
            <div style={styles.row}><span>{copy.walletUsed}</span><strong>{money(plan.amounts.walletAed)}</strong></div>
            {plan.amounts.externalAed > 0 ? (
              <div style={styles.row} data-testid="review-external-payment-summary"><span>{paymentMethodLabel}{plan.cardLast4 ? ` •••• ${plan.cardLast4}` : ""}</span><strong>{money(plan.amounts.externalAed)}</strong></div>
            ) : null}
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
        <h3 style={styles.title}>{copy.paymentMethod}</h3>
        {externalPaymentRequired ? (
          <>
            <label style={styles.label}>
              <span>{copy.paymentMethod}</span>
              <select
                style={styles.select}
                value={paymentMethod}
                aria-label={copy.paymentMethod}
                data-testid="payment-method-select"
                onChange={(event) => {
                  const nextMethod = event.target.value;
                  setPaymentMethod(nextMethod);
                  if (nextMethod !== PAYMENT_METHODS.card) {
                    setOfferId("");
                    setCardNumber("");
                    setCvv("");
                  }
                }}
              >
                <option value="">{copy.paymentMethodPlaceholder}</option>
                <option value={PAYMENT_METHODS.samsungPay}>{copy.samsungPay}</option>
                <option value={PAYMENT_METHODS.applePay}>{copy.applePay}</option>
                <option value={PAYMENT_METHODS.card}>{copy.cardMethod}</option>
              </select>
            </label>
            <p style={styles.help}>{paymentMethod && paymentMethod !== PAYMENT_METHODS.card ? copy.offersCardOnly : copy.methodHelp}</p>
            {paymentMethod === PAYMENT_METHODS.card ? (
              <>
                <label style={styles.label}>
                  <span>{copy.offer}</span>
                  <select style={styles.select} value={offerId} aria-label={copy.offer} onChange={(event) => setOfferId(event.target.value)}>
                    <option value="">{copy.noOffer}</option>
                    {OFFERS.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {localValue(offer.bank, language)} - {localValue(offer.headline, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <p style={styles.help}>{copy.offerHelp}</p>
                {activeOffer ? (
                  <div style={styles.offer} data-testid="selected-offer-summary">
                    <strong>{selectedOfferLabel}</strong>
                    <span style={styles.help}>{localValue(activeOffer.summary, language)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : <p style={styles.success} role="status">{copy.balancesCoverTotal}</p>}
      </div>

      <div
        style={{ ...styles.section, borderColor: "#9bcfc9", background: palette.accentSoft }}
        data-testid="combined-payment-options"
      >
        <h3 style={styles.title}>{copy.combined}</h3>
        <p style={styles.help}>{copy.combinedHelp}</p>
        {activeOffer ? (
          <p style={plan.storedValuePolicy?.fullPriceTicketCount > 0 ? styles.help : styles.error} role="status">
            {plan.storedValuePolicy?.fullPriceTicketCount > 0
              ? copy.offerBalancesLimit(plan.storedValuePolicy.fullPriceTicketCount, money(plan.storedValuePolicy.limitAed))
              : copy.offerBalancesRequireFullPrice}
          </p>
        ) : null}
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
            <span style={styles.amountBadge}>{points(plan.sharePointsUsed)} = {money(plan.amounts?.shareAed || 0)}</span>
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

      {externalPaymentRequired && paymentMethod === PAYMENT_METHODS.card ? <div style={styles.section}>
        <h3 style={styles.title}>{copy.cards}</h3>
        {cardControlsRequired ? (
          <>
            <label style={styles.label}>
              <span>{copy.cards}</span>
              <select
                style={styles.select}
                value={cardNumber}
                aria-label={copy.cards}
                data-testid="payment-card-select"
                onChange={(event) => {
                  setCardNumber(event.target.value);
                  setCvv("");
                }}
              >
                <option value="">{copy.cardPlaceholder}</option>
                <option value={DEMO_CARD_NUMBERS.eligible}>{maskDemoCardNumber(DEMO_CARD_NUMBERS.eligible)}</option>
                <option value={DEMO_CARD_NUMBERS.notEligible}>{maskDemoCardNumber(DEMO_CARD_NUMBERS.notEligible)}</option>
              </select>
            </label>
            {cardNumber && selectedOffer ? (
              plan.cardValidation?.eligible
                ? <p style={styles.success}>{copy.eligibleCard}</p>
                : <p style={styles.error}>{plan.cardValidation?.valid ? copy.notEligible : copy.offerCardRequired}</p>
            ) : cardNumber ? <p style={styles.success}>{copy.cardAvailable}</p> : null}
            {cardSelectionNeedsCvv ? (
              <label style={styles.label}>
                <span>{copy.cvv}</span>
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={3}
                  value={cvv}
                  aria-label={copy.cvv}
                  aria-invalid={cvvErrorShown}
                  onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 3))}
                />
                <span style={styles.help}>{copy.cvvHelp}</span>
              </label>
            ) : null}
            {cvvErrorShown ? <p style={styles.error} role="alert">{copy.cvvInvalid}</p> : null}
          </>
        ) : (
          <p style={styles.success} role="status">{copy.noCardRequired}</p>
        )}
      </div> : null}

      <div style={styles.totals}>
        <div style={styles.row}><span>{copy.discount}</span><strong>-{money(plan.amounts?.offerDiscount || 0)}</strong></div>
        <div style={styles.row}><span>{copy.pointsRedeemedExplicit}</span><strong>{points(plan.sharePointsUsed)}</strong></div>
        <div style={styles.row}><span>{copy.pointsEquivalent}</span><strong>-{money(plan.amounts?.shareAed || 0)}</strong></div>
        <div style={styles.row}><span>{copy.walletUsed}</span><strong>{money(plan.amounts?.walletAed || 0)}</strong></div>
        <div style={styles.strongRow}><span>{copy.remainingPayment}</span><span>{money(plan.amounts?.remainingAfterPointsAed || 0)}</span></div>
        {externalPaymentRequired ? (
          <div style={styles.row} data-testid="external-payment-summary"><span>{paymentMethodLabel || copy.externalRemainder}</span><strong>{money(plan.amounts?.externalAed || 0)}</strong></div>
        ) : null}
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
