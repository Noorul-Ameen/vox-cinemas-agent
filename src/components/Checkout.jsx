import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, CreditCard, Lock, Plus, Smartphone } from "lucide-react";
import { C } from "../theme.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import {
  DEMO_CARD_STORAGE_KEY,
  formatDemoPan,
  isLuhnValid,
  isValidDemoExpiry,
  sanitizeStoredCardMetadata,
  toStoredCardMetadata,
} from "../checkoutSafety.js";

function loadCards() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_CARD_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(sanitizeStoredCardMetadata).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCards(cards) {
  try {
    const metadataOnly = cards.map(sanitizeStoredCardMetadata).filter(Boolean);
    localStorage.setItem(DEMO_CARD_STORAGE_KEY, JSON.stringify(metadataOnly));
  } catch {
    // The checkout remains usable when storage is unavailable.
  }
}

function resolveCheckoutMode(mode) {
  const explicitMode = String(mode || "").trim().toLowerCase();
  if (explicitMode === "live" || explicitMode === "demo") return explicitMode;
  // Vista configuration controls read data only. Checkout remains simulated unless
  // a future integration explicitly opts this component into another mode.
  return "demo";
}

function emptyCardForm() {
  return { pan: "", name: "", exp: "", cvv: "" };
}

export default function Checkout({ order, onPaid, onCancel, onRetry, mode }) {
  const { t, dir, formatCurrency } = useI18n();
  const checkoutMode = resolveCheckoutMode(mode);
  const seats = Array.isArray(order?.seats) ? order.seats : [];
  const [cards, setCards] = useState(loadCards);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyCardForm);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(null);
  const [done, setDone] = useState(false);
  const timersRef = useRef([]);
  const mountedRef = useRef(true);
  const paymentStartedRef = useRef(false);
  const completionSentRef = useRef(false);
  const sensitiveFormRef = useRef(form);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const clearSensitiveForm = (updateUi = true) => {
    const cleared = emptyCardForm();
    sensitiveFormRef.current = cleared;
    if (updateUi && mountedRef.current) setForm(cleared);
  };

  const updateFormField = (field, value) => {
    const next = { ...sensitiveFormRef.current, [field]: value };
    sensitiveFormRef.current = next;
    setForm(next);
  };

  useEffect(() => saveCards(cards), [cards]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      paymentStartedRef.current = true;
      clearTimers();
      clearSensitiveForm(false);
    };
  }, []);

  const cancelCheckout = () => {
    paymentStartedRef.current = true;
    clearTimers();
    clearSensitiveForm();
    setError("");
    onCancel?.();
  };

  const pay = (method, label) => {
    if (checkoutMode !== "demo" || paymentStartedRef.current) return;
    paymentStartedRef.current = true;
    setPaying(method);
    const checkoutId = order?.checkoutId;
    const authorizationTimer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setDone(true);
      const completionTimer = window.setTimeout(() => {
        if (!mountedRef.current || completionSentRef.current) return;
        completionSentRef.current = true;
        clearSensitiveForm();
        onPaid?.({ method, label, checkoutId });
      }, 700);
      timersRef.current.push(completionTimer);
    }, 1600);
    timersRef.current.push(authorizationTimer);
  };

  const addCard = () => {
    if (!isLuhnValid(form.pan)) return setError(t("checkout.cardInvalid"));
    if (!isValidDemoExpiry(form.exp)) return setError(t("checkout.expiryInvalid"));
    if (!/^\d{3,4}$/.test(form.cvv)) return setError(t("checkout.cvvInvalid"));
    if (!form.name.trim()) return setError(t("checkout.nameRequired"));

    // Only masked, token-like display metadata survives this synchronous handler.
    const metadata = toStoredCardMetadata(form, `demo-${Date.now()}`);
    setCards((current) => [...current, metadata]);
    setSelected(metadata.id);
    setAdding(false);
    setError("");
    clearSensitiveForm();
  };

  const header = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button type="button" aria-label={t("common.back")} onClick={cancelCheckout} style={backButton}>
          <ChevronLeft size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{t("checkout.title")}</div>
          <div style={{ overflow: "hidden", fontSize: 11, color: "rgba(255,255,255,.5)", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <bdi dir="auto">{order?.movieTitle}</bdi> · <span dir="ltr">{order?.showtime}</span> · {t("checkout.seatsLabel")} <span dir="ltr">{seats.join(", ")}</span>
          </div>
        </div>
      </div>
      <div style={summaryCard}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{t("checkout.seatCountOnly", { count: seats.length })} · <span dir="ltr">{order?.screen}</span></span>
        <span dir="ltr" style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{formatCurrency(order?.total || 0, order?.currency || "AED")}</span>
      </div>
    </>
  );

  if (checkoutMode === "live") {
    return (
      <div>
        {header}
        <div role="alert" style={unavailableCard}>
          <AlertTriangle size={26} color="#FFCF70" aria-hidden="true" />
          <div style={{ marginTop: 10, color: "#fff", fontSize: 15, fontWeight: 800 }}>{t("checkout.liveUnavailable")}</div>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,.62)", fontSize: 12, lineHeight: 1.5 }}>{t("checkout.liveUnavailableBody")}</p>
          {onRetry && <button type="button" onClick={onRetry} style={{ ...actionButton, marginTop: 12, background: C.purple }}>{t("error.retry")}</button>}
        </div>
      </div>
    );
  }

  if (paying) {
    const label = paying === "apple" ? t("checkout.applePay") : paying === "samsung" ? t("checkout.samsungPay") : t("checkout.cardPayment");
    return (
      <div style={{ display: "flex", minHeight: 320, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ marginBottom: 10, borderRadius: 999, background: "rgba(255,207,112,.14)", padding: "4px 9px", color: "#FFCF70", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>{t("checkout.testOnly")}</div>
        <div style={{ display: "flex", width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 20, background: done ? "rgba(87,199,154,.15)" : "rgba(228,220,240,.1)", marginBottom: 18 }}>
          {done ? <Check size={30} color={C.green} /> : <div style={spinner} />}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{done ? t("checkout.approved") : t("checkout.authorizing", { method: label })}</div>
        <div style={{ marginTop: 6, color: "rgba(255,255,255,.5)", fontSize: 12 }}>{done ? t("checkout.confirming") : t("checkout.demoAuth")}</div>
        <div dir="ltr" style={{ marginTop: 14, color: "#fff", fontSize: 22, fontWeight: 800 }}>{formatCurrency(order?.total || 0, order?.currency || "AED")}</div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div id="demo-checkout-notice" role="note" style={demoNotice}>
        <strong>{t("checkout.testOnly")}</strong> · {t("checkout.testNotice")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button type="button" aria-describedby="demo-checkout-notice" onClick={() => pay("apple", "Apple Pay (demo)")} style={{ ...walletButton, background: "#000", border: "1px solid rgba(255,255,255,.25)" }}>{t("checkout.applePay")}</button>
        <button type="button" aria-describedby="demo-checkout-notice" onClick={() => pay("samsung", "Samsung Pay (demo)")} style={{ ...walletButton, background: "#1428A0" }}><Smartphone size={15} aria-hidden="true" style={{ marginInlineEnd: 6 }} /> {t("checkout.samsungPay")}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 12px", color: "rgba(255,255,255,.35)", fontSize: 11 }}>
        <div style={divider} /> {t("checkout.orCard")} <div style={divider} />
      </div>

      {!adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!cards.length && <div role="status" style={emptyCard}>{t("checkout.noSavedCards")}</div>}
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelected(card.id)}
              aria-pressed={selected === card.id}
              style={{ ...storedCardButton, border: selected === card.id ? `1.5px solid ${C.magenta}` : "1px solid rgba(255,255,255,.12)", background: selected === card.id ? "rgba(182,24,108,.12)" : "rgba(255,255,255,.03)" }}
            >
              <CreditCard size={18} color={C.lavender} aria-hidden="true" />
              <div dir="ltr" style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{card.brand} •••• {card.last4}</div>
                <div style={{ overflow: "hidden", color: "rgba(255,255,255,.45)", fontSize: 11, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name} · {card.exp}</div>
              </div>
              {selected === card.id && <Check size={16} color={C.magenta} aria-hidden="true" />}
            </button>
          ))}
          <button type="button" onClick={() => { setAdding(true); setError(""); }} style={addCardButton}><Plus size={15} aria-hidden="true" /> {t("checkout.addCard")}</button>
        </div>
      )}

      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label><span style={fieldLabel}>{t("checkout.cardNumberLabel")}</span><input dir="ltr" autoComplete="off" aria-describedby="demo-checkout-notice" value={form.pan} onChange={(event) => updateFormField("pan", formatDemoPan(event.target.value))} placeholder={t("checkout.cardNumber")} style={inputStyle} inputMode="numeric" /></label>
          <label><span style={fieldLabel}>{t("checkout.cardNameLabel")}</span><input dir="ltr" autoComplete="off" value={form.name} onChange={(event) => updateFormField("name", event.target.value)} placeholder={t("checkout.cardName")} style={{ ...inputStyle, textAlign: "start" }} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label><span style={fieldLabel}>{t("checkout.expiryLabel")}</span><input dir="ltr" autoComplete="off" value={form.exp} onChange={(event) => updateFormField("exp", event.target.value.replace(/[^\d/]/g, "").slice(0, 5))} placeholder={t("checkout.expiry")} style={inputStyle} inputMode="numeric" /></label>
            <label><span style={fieldLabel}>{t("checkout.cvvLabel")}</span><input dir="ltr" autoComplete="off" value={form.cvv} onChange={(event) => updateFormField("cvv", event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("checkout.cvv")} style={inputStyle} inputMode="numeric" type="password" /></label>
          </div>
          {error && <div role="alert" aria-live="assertive" style={{ color: "#FF8C9C", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" onClick={() => { setAdding(false); setError(""); clearSensitiveForm(); }} style={{ ...actionButton, background: "rgba(255,255,255,.08)" }}>{t("common.cancel")}</button>
            <button type="button" onClick={addCard} style={{ ...actionButton, background: C.purple }}>{t("checkout.saveCard")}</button>
          </div>
        </div>
      )}

      {!adding && (
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            const card = cards.find((item) => item.id === selected);
            if (card) pay("card", `${card.brand} •••• ${card.last4} (demo)`);
          }}
          style={{ ...actionButton, display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, background: C.magenta, opacity: selected ? 1 : 0.4 }}
        >
          <Lock size={14} aria-hidden="true" /> {t("checkout.pay", { amount: formatCurrency(order?.total || 0, order?.currency || "AED") })}
        </button>
      )}

      <div style={{ marginTop: 10, color: "rgba(255,255,255,.35)", fontSize: 10, textAlign: "center" }}>{t("checkout.demoDisclaimer")}</div>
    </div>
  );
}

const backButton = { border: "none", background: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", padding: 4 };
const summaryCard = { display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, background: "rgba(0,0,0,.25)", padding: "12px 14px", marginBottom: 12 };
const demoNotice = { border: "1px solid rgba(255,207,112,.28)", borderRadius: 10, background: "rgba(255,207,112,.08)", padding: "9px 11px", marginBottom: 12, color: "rgba(255,255,255,.72)", fontSize: 10, lineHeight: 1.45 };
const unavailableCard = { border: "1px solid rgba(255,207,112,.25)", borderRadius: 14, background: "rgba(255,207,112,.07)", padding: 20, textAlign: "center" };
const spinner = { width: 26, height: 26, border: "3px solid rgba(255,255,255,.2)", borderTopColor: C.lavender, borderRadius: "50%", animation: "spin 0.9s linear infinite" };
const walletButton = { display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 12, padding: 12, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 };
const divider = { flex: 1, height: 1, background: "rgba(255,255,255,.12)" };
const emptyCard = { border: "1px dashed rgba(255,255,255,.15)", borderRadius: 11, padding: 12, color: "rgba(255,255,255,.5)", fontSize: 11, textAlign: "center" };
const storedCardButton = { display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "start" };
const addCardButton = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px dashed rgba(255,255,255,.25)", borderRadius: 12, background: "none", padding: 11, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 13 };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, background: "rgba(255,255,255,.06)", padding: "11px 13px", color: "#fff", fontSize: 13 };
const fieldLabel = { display: "block", margin: "0 2px 4px", color: "rgba(255,255,255,.5)", fontSize: 10, fontWeight: 700 };
const actionButton = { border: "none", borderRadius: 10, padding: 12, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 };
