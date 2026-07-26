import React, { useState } from "react";
import { BadgePercent, CheckCircle2, CreditCard, ShieldCheck, WalletCards, XCircle } from "lucide-react";
import { C } from "../theme.js";
import {
  DEMO_CARD_NUMBERS,
  DEMO_CARD_OFFER_PERCENT,
  DEMO_SHARE_POINTS,
  DEMO_SHARE_POINTS_PER_AED,
  DEMO_WALLET_BALANCE,
  formatDemoCardNumber,
  normalizeDemoCardNumber,
  validateDemoCardOffer,
  validateDemoSharePoints,
  validateDemoWallet,
} from "../lib/demoPaymentGateway.js";

const COPY = {
  en: {
    title: "Test payment gateway",
    badge: "NO CHARGE",
    intro: "Validate a test offer or balance before saving this checkout summary. No payment, points redemption, or cinema reservation will be submitted.",
    methodsLabel: "Choose a test payment method",
    card: "Card offer",
    wallet: "VOX Wallet",
    share: "SHARE points",
    cardTitle: "Card offer validation",
    cardHelp: "Use only one of the published test numbers. Real card details are not accepted, transmitted, or stored.",
    eligibleCard: "Eligible test card",
    ineligibleCard: "Not eligible test card",
    cardInput: "Test card number",
    cardPlaceholder: "Enter a published test number",
    validateCard: "Validate card offer",
    incompleteCard: "Enter all 16 digits from one of the two published test cards.",
    unrecognizedCard: "This number is not a published test card. Real card details are ignored and are not stored.",
    eligibleCardResult: `Eligible for the ${DEMO_CARD_OFFER_PERCENT}% test card offer. The discount is validated only and has not been applied.`,
    ineligibleCardResult: "This test card is not eligible for the card offer.",
    walletTitle: "VOX Wallet balance validation",
    walletHelp: "The test wallet contains {balance}. Validation checks this checkout amount without deducting funds.",
    validateWallet: "Validate wallet balance",
    eligibleWallet: "The test VOX Wallet balance is sufficient. No funds have been deducted.",
    insufficientWallet: "The test VOX Wallet balance is not sufficient for this amount.",
    shareTitle: "SHARE points validation",
    shareHelp: "The test account contains {points} points. For this test, {rate} points equal AED 1.",
    shareRequired: "{points} points are required for this checkout amount.",
    validateShare: "Validate SHARE points",
    eligibleShare: "The test SHARE points balance is sufficient. No points have been redeemed.",
    insufficientShare: "The test SHARE points balance is not sufficient for this amount.",
    validationPassed: "Validation passed",
    validationFailed: "Validation not passed",
    continue: "Save validated checkout summary",
    continueHint: "No charge or reservation",
    chooseMethod: "Validate the selected method to continue.",
  },
  ar: {
    title: "بوابة دفع اختبارية",
    badge: "بدون خصم",
    intro: "تحقق من عرض أو رصيد اختباري قبل حفظ ملخص إتمام الحجز. لن يتم إرسال دفعة أو استبدال نقاط أو حجز إلى السينما.",
    methodsLabel: "اختر طريقة دفع اختبارية",
    card: "عرض البطاقة",
    wallet: "محفظة VOX",
    share: "نقاط SHARE",
    cardTitle: "التحقق من عرض البطاقة",
    cardHelp: "استخدم أحد رقمي الاختبار المنشورين فقط. لا يتم قبول أو إرسال أو تخزين بيانات بطاقة حقيقية.",
    eligibleCard: "بطاقة اختبار مؤهلة",
    ineligibleCard: "بطاقة اختبار غير مؤهلة",
    cardInput: "رقم بطاقة الاختبار",
    cardPlaceholder: "أدخل رقم اختبار منشوراً",
    validateCard: "تحقق من عرض البطاقة",
    incompleteCard: "أدخل الأرقام الستة عشر كاملة من إحدى بطاقتي الاختبار.",
    unrecognizedCard: "هذا الرقم ليس بطاقة اختبار منشورة. يتم تجاهل بيانات البطاقات الحقيقية ولا يتم تخزينها.",
    eligibleCardResult: `البطاقة مؤهلة لعرض اختباري بنسبة ${DEMO_CARD_OFFER_PERCENT}%. تم التحقق فقط ولم يتم تطبيق الخصم.`,
    ineligibleCardResult: "بطاقة الاختبار هذه غير مؤهلة لعرض البطاقة.",
    walletTitle: "التحقق من رصيد محفظة VOX",
    walletHelp: "تحتوي المحفظة الاختبارية على {balance}. يتحقق الاختبار من المبلغ دون خصم أي رصيد.",
    validateWallet: "تحقق من رصيد المحفظة",
    eligibleWallet: "رصيد محفظة VOX الاختبارية كافٍ. لم يتم خصم أي مبلغ.",
    insufficientWallet: "رصيد محفظة VOX الاختبارية غير كافٍ لهذا المبلغ.",
    shareTitle: "التحقق من نقاط SHARE",
    shareHelp: "يحتوي الحساب الاختباري على {points} نقطة. في هذا الاختبار، كل {rate} نقاط تساوي درهماً واحداً.",
    shareRequired: "يلزم {points} نقطة لمبلغ إتمام الحجز هذا.",
    validateShare: "تحقق من نقاط SHARE",
    eligibleShare: "رصيد نقاط SHARE الاختباري كافٍ. لم يتم استبدال أي نقاط.",
    insufficientShare: "رصيد نقاط SHARE الاختباري غير كافٍ لهذا المبلغ.",
    validationPassed: "نجح التحقق",
    validationFailed: "لم ينجح التحقق",
    continue: "حفظ ملخص إتمام الحجز بعد التحقق",
    continueHint: "بدون دفع أو حجز",
    chooseMethod: "تحقق من الطريقة المحددة للمتابعة.",
  },
};

const METHODS = [
  { id: "card", icon: CreditCard },
  { id: "wallet", icon: WalletCards },
  { id: "share", icon: BadgePercent },
];

function interpolate(value, variables) {
  return Object.entries(variables).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)),
    value,
  );
}

export default function DemoPaymentGateway({
  amount,
  currency = "AED",
  dir = "ltr",
  formatCurrency,
  onApprove,
}) {
  const locale = dir === "rtl" ? "ar" : "en";
  const copy = COPY[locale];
  const [method, setMethod] = useState("card");
  const [cardNumber, setCardNumber] = useState("");
  const [result, setResult] = useState(null);
  const money = (value) => formatCurrency?.(value, currency) || `${currency} ${Number(value || 0).toFixed(2)}`;

  const selectMethod = (nextMethod) => {
    setMethod(nextMethod);
    setResult(null);
  };

  const useTestCard = (number) => {
    setCardNumber(number);
    setResult(validateDemoCardOffer(number));
  };

  const validateSelectedMethod = () => {
    if (method === "card") setResult(validateDemoCardOffer(cardNumber));
    if (method === "wallet") setResult(validateDemoWallet(amount));
    if (method === "share") setResult(validateDemoSharePoints(amount));
  };

  const resultMessage = (() => {
    if (!result) return copy.chooseMethod;
    if (result.method === "card") {
      if (result.status === "eligible") return copy.eligibleCardResult;
      if (result.status === "not_eligible") return copy.ineligibleCardResult;
      if (result.status === "unrecognized") return copy.unrecognizedCard;
      return copy.incompleteCard;
    }
    if (result.method === "wallet") return result.eligible ? copy.eligibleWallet : copy.insufficientWallet;
    return result.eligible ? copy.eligibleShare : copy.insufficientShare;
  })();

  return (
    <div data-testid="demo-payment-gateway" style={gatewayCard}>
      <div style={gatewayHeading}>
        <span style={shieldIcon}><ShieldCheck size={18} aria-hidden="true" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 900 }}>{copy.title}</h3>
          <div style={{ marginTop: 2, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{copy.intro}</div>
        </div>
        <span style={noChargeBadge}>{copy.badge}</span>
      </div>

      <div role="group" aria-label={copy.methodsLabel} style={methodGrid}>
        {METHODS.map(({ id, icon: Icon }) => {
          const active = method === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => selectMethod(id)}
              style={{ ...methodButton, ...(active ? activeMethodButton : null) }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{copy[id]}</span>
            </button>
          );
        })}
      </div>

      {method === "card" && (
        <div style={methodPanel}>
          <div style={methodTitle}>{copy.cardTitle}</div>
          <div style={methodHelp}>{copy.cardHelp}</div>
          <div style={testCardGrid}>
            <button type="button" onClick={() => useTestCard(DEMO_CARD_NUMBERS.eligible)} style={testCardButton}>
              <span>{copy.eligibleCard}</span>
              <strong dir="ltr">{formatDemoCardNumber(DEMO_CARD_NUMBERS.eligible)}</strong>
            </button>
            <button type="button" onClick={() => useTestCard(DEMO_CARD_NUMBERS.notEligible)} style={testCardButton}>
              <span>{copy.ineligibleCard}</span>
              <strong dir="ltr">{formatDemoCardNumber(DEMO_CARD_NUMBERS.notEligible)}</strong>
            </button>
          </div>
          <label style={inputLabel}>
            <span>{copy.cardInput}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={19}
              aria-label={copy.cardInput}
              placeholder={copy.cardPlaceholder}
              value={formatDemoCardNumber(cardNumber)}
              onChange={(event) => {
                setCardNumber(normalizeDemoCardNumber(event.target.value));
                setResult(null);
              }}
              style={cardInput}
              dir="ltr"
            />
          </label>
          <button type="button" onClick={validateSelectedMethod} style={validateButton}>{copy.validateCard}</button>
        </div>
      )}

      {method === "wallet" && (
        <div style={methodPanel}>
          <div style={methodTitle}>{copy.walletTitle}</div>
          <div style={methodHelp}>{interpolate(copy.walletHelp, { balance: money(DEMO_WALLET_BALANCE) })}</div>
          <div style={balanceRow}>
            <span>{copy.wallet}</span>
            <strong dir="ltr">{money(DEMO_WALLET_BALANCE)}</strong>
          </div>
          <button type="button" onClick={validateSelectedMethod} style={validateButton}>{copy.validateWallet}</button>
        </div>
      )}

      {method === "share" && (
        <div style={methodPanel}>
          <div style={methodTitle}>{copy.shareTitle}</div>
          <div style={methodHelp}>{interpolate(copy.shareHelp, { points: DEMO_SHARE_POINTS.toLocaleString(locale === "ar" ? "ar-AE" : "en-AE"), rate: DEMO_SHARE_POINTS_PER_AED })}</div>
          <div style={balanceRow}>
            <span>{interpolate(copy.shareRequired, { points: Math.ceil(Number(amount || 0) * DEMO_SHARE_POINTS_PER_AED).toLocaleString(locale === "ar" ? "ar-AE" : "en-AE") })}</span>
            <strong>{DEMO_SHARE_POINTS.toLocaleString(locale === "ar" ? "ar-AE" : "en-AE")}</strong>
          </div>
          <button type="button" onClick={validateSelectedMethod} style={validateButton}>{copy.validateShare}</button>
        </div>
      )}

      <div role="status" aria-live="polite" style={{ ...validationResult, ...(result?.eligible ? eligibleResult : result ? failedResult : null) }}>
        {result?.eligible ? <CheckCircle2 size={18} aria-hidden="true" /> : result ? <XCircle size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
        <div>
          <strong style={{ display: "block", fontSize: 11 }}>{result?.eligible ? copy.validationPassed : result ? copy.validationFailed : copy.title}</strong>
          <span style={{ display: "block", marginTop: 2, fontSize: 10, lineHeight: 1.4 }}>{resultMessage}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!result?.eligible}
        aria-disabled={!result?.eligible}
        onClick={() => result?.eligible && onApprove?.()}
        style={{ ...continueButton, ...(!result?.eligible ? disabledButton : null) }}
      >
        <span>
          <strong style={{ display: "block" }}>{copy.continue}</strong>
          <small style={{ display: "block", marginTop: 2, opacity: 0.88 }}>{copy.continueHint}</small>
        </span>
        <strong dir="ltr">{money(amount)}</strong>
      </button>
    </div>
  );
}

const gatewayCard = { border: `1px solid ${C.border}`, borderRadius: 14, background: C.surfaceAlt, padding: 12 };
const gatewayHeading = { display: "flex", alignItems: "flex-start", gap: 9 };
const shieldIcon = { display: "inline-flex", width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 10, background: C.primarySoft, color: C.primary };
const noChargeBadge = { flexShrink: 0, borderRadius: 999, background: C.warningSoft, padding: "4px 7px", color: C.warning, fontSize: 8, fontWeight: 900, letterSpacing: ".06em" };
const methodGrid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: 12 };
const methodButton = { display: "flex", minWidth: 0, minHeight: 48, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: "6px 4px", color: C.muted, cursor: "pointer", fontSize: 9, fontWeight: 800 };
const activeMethodButton = { borderColor: C.primary, background: C.primarySoft, color: C.primary };
const methodPanel = { marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 11, background: C.surface, padding: 10 };
const methodTitle = { color: C.text, fontSize: 12, fontWeight: 900 };
const methodHelp = { marginTop: 3, color: C.muted, fontSize: 9, lineHeight: 1.45 };
const testCardGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 9 };
const testCardButton = { display: "flex", minWidth: 0, minHeight: 58, flexDirection: "column", justifyContent: "space-between", gap: 5, border: `1px solid ${C.border}`, borderRadius: 9, background: C.surfaceAlt, padding: 8, color: C.text, cursor: "pointer", textAlign: "start", fontSize: 8 };
const inputLabel = { display: "grid", gap: 4, marginTop: 9, color: C.text, fontSize: 9, fontWeight: 800 };
const cardInput = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface, padding: "10px 11px", color: C.text, outlineColor: C.primary, fontSize: 13, letterSpacing: ".04em" };
const validateButton = { width: "100%", minHeight: 42, marginTop: 8, border: `1px solid ${C.primary}`, borderRadius: 9, background: C.primarySoft, color: C.primary, cursor: "pointer", fontSize: 11, fontWeight: 900 };
const balanceRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 9, borderRadius: 9, background: C.surfaceAlt, padding: "9px 10px", color: C.text, fontSize: 10 };
const validationResult = { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: 9, color: C.muted };
const eligibleResult = { borderColor: C.green, background: C.successSoft, color: C.green };
const failedResult = { borderColor: C.warning, background: C.warningSoft, color: C.text };
const continueButton = { display: "flex", width: "100%", minHeight: 54, alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10, border: "none", borderRadius: 11, background: C.primary, padding: "10px 12px", color: C.onPrimary, cursor: "pointer", textAlign: "start", fontSize: 11 };
const disabledButton = { background: C.border, color: C.muted, cursor: "not-allowed" };
