import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "../i18n/I18nProvider.jsx";

export default function BookingQRCode({ booking, size = 132 }) {
  const { t } = useI18n();
  const ref = String(booking?.ref || "").trim();
  if (!ref || booking?.cancelled) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, borderTop: "1px dashed rgba(255,255,255,.15)", padding: "15px 20px" }}>
      <div data-qr-value={ref} aria-label={`${t("booking.qrHint")}: ${ref}`} style={{ display: "grid", placeItems: "center", borderRadius: 12, background: "#fff", padding: 9 }}>
        <QRCodeSVG value={ref} size={size} level="M" marginSize={0} title={`${t("booking.ref")} ${ref}`} />
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.48)" }}>{t("booking.qrHint")}</div>
    </div>
  );
}

