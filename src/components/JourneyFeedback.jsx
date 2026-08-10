import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { C } from "../theme.js";

const FEEDBACK_STORAGE_KEY = "voxi_journey_feedback_v1";

function feedbackKey(bookingRef, outcome) {
  return `${String(bookingRef || "unknown").trim().toUpperCase()}:${String(outcome || "booking")}`;
}

function readSubmitted(key) {
  try {
    if (typeof window === "undefined") return false;
    const entries = JSON.parse(window.localStorage.getItem(FEEDBACK_STORAGE_KEY) || "[]");
    return Array.isArray(entries) && entries.some((entry) => entry?.key === key);
  } catch {
    return false;
  }
}

export default function JourneyFeedback({ bookingRef, outcome = "booking" }) {
  const { t, locale, dir } = useI18n();
  const key = feedbackKey(bookingRef, outcome);
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitted, setSubmitted] = React.useState(() => readSubmitted(key));

  React.useEffect(() => {
    setRating(0);
    setComment("");
    setSubmitted(readSubmitted(key));
  }, [key]);

  const submit = (event) => {
    event.preventDefault();
    if (!rating) return;
    const record = {
      key,
      bookingRef: String(bookingRef || ""),
      outcome,
      rating,
      comment: comment.trim().slice(0, 500),
      locale,
      submittedAt: new Date().toISOString(),
    };
    try {
      const stored = JSON.parse(window.localStorage.getItem(FEEDBACK_STORAGE_KEY) || "[]");
      const entries = Array.isArray(stored) ? stored.filter((entry) => entry?.key !== key) : [];
      window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...entries.slice(-49), record]));
    } catch {
      // Feedback confirmation remains available when browser storage is blocked.
    }
    setSubmitted(true);
  };

  return (
    <section aria-labelledby={`feedback-${key}`} dir={dir} style={{ maxWidth: 420, margin: "14px auto 0", border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, padding: 14 }}>
      <h3 id={`feedback-${key}`} style={{ margin: 0, color: C.text, fontSize: 14 }}>{t("feedback.title")}</h3>
      {submitted ? (
        <p role="status" style={{ margin: "8px 0 0", color: C.green, fontSize: 12 }}>{t("feedback.thanks")}</p>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 9 }}>
          <p style={{ margin: 0, color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{t("feedback.prompt")}</p>
          <div role="radiogroup" aria-label={t("feedback.rating")} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={t("feedback.rate", { value })} onClick={() => setRating(value)} style={{ minHeight: 38, border: `1px solid ${rating === value ? C.primary : C.border}`, borderRadius: 9, background: rating === value ? C.primarySoft : C.surfaceAlt, color: C.text, font: "inherit", fontWeight: 800, cursor: "pointer" }}>
                {value}
              </button>
            ))}
          </div>
          <label style={{ display: "grid", gap: 5, color: C.text, fontSize: 11, fontWeight: 700 }}>
            <span>{t("feedback.comment")}</span>
            <textarea value={comment} maxLength={500} rows={3} onChange={(event) => setComment(event.target.value)} placeholder={t("feedback.placeholder")} style={{ resize: "vertical", border: `1px solid ${C.border}`, borderRadius: 9, background: C.surfaceAlt, padding: 9, color: C.text, font: "inherit" }} />
          </label>
          <button type="submit" disabled={!rating} style={{ minHeight: 40, border: 0, borderRadius: 999, background: C.primary, color: C.onPrimary, padding: "0 16px", font: "inherit", fontWeight: 800, opacity: rating ? 1 : 0.5, cursor: rating ? "pointer" : "not-allowed" }}>
            {t("feedback.submit")}
          </button>
        </form>
      )}
    </section>
  );
}
