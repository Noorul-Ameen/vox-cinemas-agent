import React, { useState, useEffect } from "react";
import { CreditCard, Plus, Check, Lock, ChevronLeft, Smartphone } from "lucide-react";
import { C } from "../theme.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

/**
 * Demo checkout — simulates the payment step entirely on-device.
 * - Stored cards persist in localStorage ("vox_cards")
 * - Add-new-card with basic validation (test card: 4111 1111 1111 1111)
 * - Apple Pay / Samsung Pay buttons show a simulated authorization sheet
 * - No card data ever goes to the agent or any server (PCI-correct demo design)
 */

const DEFAULT_CARDS = [
  { id: "c1", brand: "VISA", last4: "4242", name: "Noorul A", exp: "09/27" },
  { id: "c2", brand: "MC", last4: "5100", name: "Noorul A", exp: "01/28" },
];

function loadCards() {
  try { return JSON.parse(localStorage.getItem("vox_cards")) || DEFAULT_CARDS; }
  catch { return DEFAULT_CARDS; }
}
function saveCards(cards) {
  try { localStorage.setItem("vox_cards", JSON.stringify(cards)); } catch {}
}

const luhnOk = (num) => {
  const d = num.replace(/\D/g, ""); if (d.length < 13) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
};
const brandOf = (num) => num.startsWith("4") ? "VISA" : /^5[1-5]/.test(num) ? "MC" : /^3[47]/.test(num) ? "AMEX" : "CARD";

export default function Checkout({ order, onPaid, onCancel }) {
  const { t, dir, formatCurrency } = useI18n();
  const [cards, setCards] = useState(loadCards);
  const [selected, setSelected] = useState(cards[0]?.id || null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ num: "", name: "", exp: "", cvv: "" });
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(null); // null | "card" | "apple" | "samsung"
  const [done, setDone] = useState(false);
  const timersRef = React.useRef([]);

  useEffect(() => saveCards(cards), [cards]);
  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const pay = (method, label) => {
    setPaying(method);
    const checkoutId = order.checkoutId;
    const authorizationTimer = window.setTimeout(() => {
      setDone(true);
      const completionTimer = window.setTimeout(() => onPaid({ method, label, checkoutId }), 700);
      timersRef.current.push(completionTimer);
    }, 1600);
    timersRef.current.push(authorizationTimer);
  };

  const addCard = () => {
    const num = form.num.replace(/\s/g, "");
    if (!luhnOk(num)) return setErr(t("checkout.cardInvalid"));
    if (!/^\d{2}\/\d{2}$/.test(form.exp)) return setErr(t("checkout.expiryInvalid"));
    if (!/^\d{3,4}$/.test(form.cvv)) return setErr(t("checkout.cvvInvalid"));
    if (!form.name.trim()) return setErr(t("checkout.nameRequired"));
    const card = { id: "c" + Date.now(), brand: brandOf(num), last4: num.slice(-4), name: form.name.trim(), exp: form.exp };
    const next = [...cards, card];
    setCards(next); setSelected(card.id); setAdding(false); setErr("");
    setForm({ num: "", name: "", exp: "", cvv: "" });
  };

  const fmtNum = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

  // ---- paying / done overlay (simulated wallet or card auth sheet) ----------
  if (paying) {
    const label = paying === "apple" ? t("checkout.applePay") : paying === "samsung" ? t("checkout.samsungPay") : t("checkout.cardPayment");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "rgba(87,199,154,.15)" : "rgba(228,220,240,.1)", marginBottom: 18 }}>
          {done ? <Check size={30} color={C.green} /> :
            <div style={{ width: 26, height: 26, border: "3px solid rgba(255,255,255,.2)", borderTopColor: C.lavender, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{done ? t("checkout.approved") : t("checkout.authorizing", { method: label })}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.5)" }}>
          {done ? t("checkout.confirming") : t("checkout.demoAuth")}
        </div>
        <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: "#fff" }}>{formatCurrency(order.total, order.currency || "AED")}</div>
      </div>
    );
  }

  // ---- main checkout ---------------------------------------------------------
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button aria-label={t("common.back")} onClick={onCancel} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", padding: 4 }}><ChevronLeft size={18} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} /></button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{t("checkout.title")}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{order.movieTitle} · <span dir="ltr">{order.showtime}</span> · {t("checkout.seatsLabel")} <span dir="ltr">{order.seats.join(", ")}</span></div>
        </div>
      </div>

      {/* Order summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.25)", padding: "12px 14px", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{t("checkout.seatCountOnly", { count: order.seats.length })} · <span dir="ltr">{order.screen}</span></span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{formatCurrency(order.total, order.currency || "AED")}</span>
      </div>

      {/* Express wallets (simulated) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button onClick={() => pay("apple", "Apple Pay")} style={{ ...walletBtn, background: "#000", border: "1px solid rgba(255,255,255,.25)" }}>
          {t("checkout.applePay")}
        </button>
        <button onClick={() => pay("samsung", "Samsung Pay")} style={{ ...walletBtn, background: "#1428A0" }}>
          <Smartphone size={15} style={{ marginInlineEnd: 6 }} /> {t("checkout.samsungPay")}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 12px", color: "rgba(255,255,255,.35)", fontSize: 11 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.12)" }} /> {t("checkout.orCard")} <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.12)" }} />
      </div>

      {/* Stored cards */}
      {!adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cards.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)} aria-pressed={selected === c.id}
              style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "start",
                border: selected === c.id ? `1.5px solid ${C.magenta}` : "1px solid rgba(255,255,255,.12)",
                background: selected === c.id ? "rgba(182,24,108,.12)" : "rgba(255,255,255,.03)" }}>
              <CreditCard size={18} color={C.lavender} />
              <div dir="ltr" style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.brand} •••• {c.last4}</div>
                <div style={{ overflow: "hidden", fontSize: 11, color: "rgba(255,255,255,.45)", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name} · {c.exp}</div>
              </div>
              {selected === c.id && <Check size={16} color={C.magenta} />}
            </button>
          ))}
          <button onClick={() => { setAdding(true); setErr(""); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, padding: "11px", cursor: "pointer", border: "1px dashed rgba(255,255,255,.25)", background: "none", color: "rgba(255,255,255,.6)", fontSize: 13 }}>
            <Plus size={15} /> {t("checkout.addCard")}
          </button>
        </div>
      )}

      {/* Add new card form */}
      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label><span style={fieldLabel}>{t("checkout.cardNumberLabel")}</span><input dir="ltr" value={form.num} onChange={(e) => setForm({ ...form, num: fmtNum(e.target.value) })} placeholder={t("checkout.cardNumber")} style={inp} inputMode="numeric" /></label>
          <label><span style={fieldLabel}>{t("checkout.cardNameLabel")}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("checkout.cardName")} style={{ ...inp, textAlign: "start" }} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label><span style={fieldLabel}>{t("checkout.expiryLabel")}</span><input dir="ltr" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value.replace(/[^\d/]/g, "").slice(0, 5) })} placeholder={t("checkout.expiry")} style={inp} inputMode="numeric" /></label>
            <label><span style={fieldLabel}>{t("checkout.cvvLabel")}</span><input dir="ltr" value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder={t("checkout.cvv")} style={inp} inputMode="numeric" type="password" /></label>
          </div>
          {err && <div role="alert" aria-live="assertive" style={{ fontSize: 12, color: "#D9556B" }}>{err}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => { setAdding(false); setErr(""); }} style={{ ...actionBtn, background: "rgba(255,255,255,.08)" }}>{t("common.cancel")}</button>
            <button onClick={addCard} style={{ ...actionBtn, background: C.purple }}>{t("checkout.saveCard")}</button>
          </div>
        </div>
      )}

      {/* Pay button */}
      {!adding && (
        <button disabled={!selected} onClick={() => { const c = cards.find(x => x.id === selected); pay("card", `${c.brand} •••• ${c.last4}`); }}
          style={{ ...actionBtn, width: "100%", marginTop: 14, background: C.magenta, opacity: selected ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Lock size={14} /> {t("checkout.pay", { amount: formatCurrency(order.total, order.currency || "AED") })}
        </button>
      )}

      <div style={{ marginTop: 10, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,.35)" }}>
        {t("checkout.demoDisclaimer")}
      </div>
    </div>
  );
}

const walletBtn = { display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: "12px", cursor: "pointer", border: "none", color: "#fff", fontSize: 14, fontWeight: 700 };
const inp = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "11px 13px", color: "#fff", fontSize: 13, width: "100%", boxSizing: "border-box" };
const fieldLabel = { display: "block", margin: "0 2px 4px", color: "rgba(255,255,255,.5)", fontSize: 10, fontWeight: 700 };
const actionBtn = { borderRadius: 10, padding: "12px", cursor: "pointer", border: "none", color: "#fff", fontSize: 14, fontWeight: 700 };
