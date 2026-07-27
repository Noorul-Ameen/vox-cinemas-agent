import React from "react";
import { Sparkles } from "lucide-react";
import { C } from "../theme.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { formatDiscoveryTimePreference } from "../lib/discoveryPreferences.js";

export default function DiscoveryPrompt({ question, preferences = {}, dateLabel = "", dateStrip = null }) {
  const { locale } = useI18n();
  const formattedDate = (() => {
    if (!preferences.date) return null;
    const date = new Date(`${preferences.date}T12:00:00+04:00`);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
        timeZone: "Asia/Dubai",
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return null;
    }
  })();
  const visibleValues = [
    preferences.cinemaName,
    preferences.city && !preferences.cinemaName ? preferences.city : null,
    formattedDate,
    formatDiscoveryTimePreference(preferences, { locale }),
    preferences.movieTitle,
    preferences.genre,
    preferences.language,
    preferences.experience,
    preferences.audience === "kids_family" ? (locale === "ar" ? "أطفال وعائلات" : "Kids & family") : null,
    preferences.audience === "teen" ? (locale === "ar" ? "مراهقون" : "Teenagers") : null,
    preferences.viewerAge != null ? (locale === "ar" ? `العمر ${preferences.viewerAge}` : `Age ${preferences.viewerAge}`) : null,
    preferences.openChoice === true ? (locale === "ar" ? "أي فيلم مناسب" : "Any suitable movie") : null,
    preferences.recommendationIntent === "educational" ? (locale === "ar" ? "طلب تعليمي يحتاج توضيحاً" : "Educational preference needs clarification") : null,
  ].filter(Boolean);
  return (
    <section role="status" aria-live="polite" style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.surface, boxShadow: `0 8px 22px ${C.shadow}`, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.brand }}><Sparkles size={16} /><strong dir="auto" style={{ color: C.text, fontSize: 14 }}>{question}</strong></div>
      {!!visibleValues.length && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {visibleValues.map((value, index) => <span key={`${value}-${index}`} dir="auto" style={{ borderRadius: 999, background: C.primarySoft, padding: "4px 8px", color: C.primary, fontSize: 10 }}>{value}</span>)}
      </div>}
      {dateStrip && <div style={{ marginTop: 13 }}>
        <div dir="auto" style={{ marginBottom: 7, color: C.muted, fontSize: 10, fontWeight: 700 }}>{dateLabel}</div>
        {dateStrip}
      </div>}
    </section>
  );
}
