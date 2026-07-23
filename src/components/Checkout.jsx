import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronLeft } from "lucide-react";
import { C } from "../theme.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

function resolveCheckoutMode(mode) {
  const explicitMode = String(mode || "").trim().toLowerCase();
  if (explicitMode === "live" || explicitMode === "demo") return explicitMode;
  // Vista configuration controls read data only. Checkout remains simulated unless
  // a future integration explicitly opts this component into another mode.
  return "demo";
}

export default function Checkout({ order, onComplete, onCancel, onRetry, onReviewStateChange, mode }) {
  const { t, dir, formatCurrency } = useI18n();
  const checkoutMode = resolveCheckoutMode(mode);
  const seats = Array.isArray(order?.seats) ? order.seats : [];
  const currency = order?.currency || "AED";
  const subtotal = order?.subtotal != null && Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : null;
  const feeTotal = order?.feeTotal != null && Number.isFinite(Number(order.feeTotal)) ? Number(order.feeTotal) : null;
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);
  const mountedRef = useRef(true);
  const reviewStartedRef = useRef(false);
  const completionSentRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      reviewStartedRef.current = true;
      onReviewStateChange?.(false);
      clearTimers();
    };
  }, [onReviewStateChange]);

  const cancelCheckout = () => {
    reviewStartedRef.current = true;
    onReviewStateChange?.(false);
    clearTimers();
    onCancel?.();
  };

  const saveSummary = () => {
    if (checkoutMode !== "demo" || reviewStartedRef.current) return;
    reviewStartedRef.current = true;
    onReviewStateChange?.(true);
    setSaving(true);
    const checkoutId = order?.checkoutId;
    const prepareTimer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setDone(true);
      const completionTimer = window.setTimeout(() => {
        if (!mountedRef.current || completionSentRef.current) return;
        completionSentRef.current = true;
        onComplete?.({ checkoutId });
      }, 350);
      timersRef.current.push(completionTimer);
    }, 450);
    timersRef.current.push(prepareTimer);
  };

  const header = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button type="button" aria-label={t("checkout.editSeats")} onClick={cancelCheckout} style={backButton}>
          <ChevronLeft size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
          <span>{t("checkout.editSeats")}</span>
        </button>
        <div style={{ minWidth: 0 }}>
          <h2 id="checkout-heading" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{t("checkout.title")}</h2>
          <div style={{ overflow: "hidden", fontSize: 11, color: C.muted, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <bdi dir="auto">{order?.movieTitle}</bdi> · <span dir="ltr">{order?.showtime}</span> · {t("checkout.seatsLabel")} <span dir="ltr">{seats.join(", ")}</span>
          </div>
        </div>
      </div>
      <div style={summaryCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, color: C.muted }}>{t(seats.length === 1 ? "checkout.oneSeatCount" : "checkout.manySeatCount", { count: seats.length })} · <span dir="ltr">{order?.screen}</span></span>
          <span dir="ltr" style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{formatCurrency(order?.total || 0, currency)}</span>
        </div>
        {subtotal != null && <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", marginTop: 9, borderTop: `1px solid ${C.border}`, paddingTop: 8, color: C.muted, fontSize: 10 }}>
          <span>{t("checkout.subtotal")}</span><span dir="ltr">{formatCurrency(subtotal, currency)}</span>
          {feeTotal != null && <><span>{t("checkout.fees")}</span><span dir="ltr">{formatCurrency(feeTotal, currency)}</span></>}
          <strong style={{ color: C.text }}>{t("checkout.total")}</strong><strong dir="ltr" style={{ color: C.text }}>{formatCurrency(order?.total || 0, currency)}</strong>
        </div>}
      </div>
    </>
  );

  if (checkoutMode === "live") {
    return (
      <section aria-labelledby="checkout-heading">
        {header}
        <div role="alert" style={unavailableCard}>
          <AlertTriangle size={26} color={C.warning} aria-hidden="true" />
          <div style={{ marginTop: 10, color: C.text, fontSize: 15, fontWeight: 800 }}>{t("checkout.liveUnavailable")}</div>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{t("checkout.liveUnavailableBody")}</p>
          {onRetry && <button type="button" onClick={onRetry} style={{ ...actionButton, marginTop: 12, background: C.primary }}>{t("error.retry")}</button>}
        </div>
      </section>
    );
  }

  if (saving) {
    return (
      <section aria-labelledby="checkout-heading" style={{ display: "flex", minHeight: 320, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <h2 id="checkout-heading" style={visuallyHidden}>{t("checkout.title")}</h2>
        <div style={{ marginBottom: 10, borderRadius: 999, background: C.warningSoft, padding: "4px 9px", color: C.warning, fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>{t("checkout.testOnly")}</div>
        <div style={{ display: "flex", width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 20, background: done ? C.successSoft : C.primarySoft, marginBottom: 18 }}>
          {done ? <Check size={30} color={C.green} /> : <div style={spinner} />}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>{done ? t("checkout.approved") : t("checkout.authorizing")}</div>
        <div style={{ marginTop: 6, color: C.muted, fontSize: 12 }}>{done ? t("checkout.confirming") : t("checkout.demoAuth")}</div>
        <div dir="ltr" style={{ marginTop: 14, color: C.text, fontSize: 22, fontWeight: 800 }}>{formatCurrency(order?.total || 0, order?.currency || "AED")}</div>
      </section>
    );
  }

  return (
    <section aria-labelledby="checkout-heading">
      {header}
      <div id="checkout-safety-notice" role="note" style={demoNotice}>
        <strong>{t("checkout.testOnly")}</strong> · {t("checkout.testNotice")}
      </div>

      <button
        type="button"
        aria-describedby="checkout-safety-notice"
        onClick={saveSummary}
        style={saveSummaryButton}
      >
        <span style={{ minWidth: 0, flex: 1, textAlign: "start" }}>
          <span style={{ display: "block", color: C.onPrimary, fontSize: 13, fontWeight: 800 }}>{t("checkout.saveSummary")}</span>
          <span style={{ display: "block", marginTop: 2, color: C.onPrimary, fontSize: 10, opacity: 0.9 }}>{t("checkout.saveSummaryHint")}</span>
        </span>
        <span dir="ltr" style={{ display: "inline-flex", flexShrink: 0, alignItems: "center", gap: 5, color: C.onPrimary, fontSize: 11, fontWeight: 800 }}>
          {formatCurrency(order?.total || 0, order?.currency || "AED")}
        </span>
      </button>

      <div style={{ marginTop: 10, color: C.muted, fontSize: 10, textAlign: "center" }}>{t("checkout.demoDisclaimer")}</div>
    </section>
  );
}

const backButton = { display: "inline-flex", minHeight: 44, flexShrink: 0, alignItems: "center", gap: 3, border: "none", background: "none", color: C.primary, cursor: "pointer", padding: "4px 2px", fontSize: 11, fontWeight: 700 };
const summaryCard = { border: `1px solid ${C.border}`, borderRadius: 12, background: C.surfaceAlt, padding: "12px 14px", marginBottom: 12 };
const demoNotice = { border: `1px solid ${C.warning}`, borderRadius: 10, background: C.warningSoft, padding: "9px 11px", marginBottom: 12, color: C.text, fontSize: 10, lineHeight: 1.45 };
const unavailableCard = { border: `1px solid ${C.warning}`, borderRadius: 14, background: C.warningSoft, padding: 20, textAlign: "center" };
const spinner = { width: 26, height: 26, border: `3px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.9s linear infinite" };
const saveSummaryButton = { display: "flex", width: "100%", minHeight: 58, alignItems: "center", gap: 12, border: "none", borderRadius: 12, background: C.primary, padding: "11px 14px", cursor: "pointer" };
const actionButton = { border: "none", borderRadius: 10, padding: 12, color: C.onPrimary, cursor: "pointer", fontSize: 14, fontWeight: 700 };
const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap" };
