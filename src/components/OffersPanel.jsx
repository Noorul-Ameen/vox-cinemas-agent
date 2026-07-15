import React from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, CreditCard, ExternalLink, HelpCircle, RefreshCw, Search, XCircle } from "lucide-react";
import { C } from "../theme.js";
import { getMediaUrl, getOfferMedia } from "../mediaData.js";
import { COMMON_OFFER_TERMS, OFFER_META, OFFERS } from "../offers/offersData.js";
import { ELIGIBILITY, evaluateOfferEligibility, searchOffers } from "../offers/offerResolver.js";

const COPY = {
  en: {
    title: "Bank offers",
    subtitle: "19 published VOX UAE offers",
    search: "Search bank or card",
    searchLabel: "Search bank offers",
    cardLabel: "Card to check",
    chooseCard: "Choose your exact card",
    noResults: "No matching bank or card was found.",
    eligible: "Listed as eligible",
    ineligible: "Not eligible",
    cardRequired: "Card required",
    commonTerm: "Member and online-booking rules apply.",
    guestTerm: "TouchPoints can be used by a VOX member or guest; online-booking rules still apply.",
    foodBenefit: "A secondary Candy Bar benefit may apply; review the full bank terms.",
    verified: "Reference checked",
    detailsNeeded: "Details needed to assess eligibility: {fields}.",
    exactCardNeeded: "Choose the exact card name so eligibility is not guessed.",
    fields: {
      bank: "issuing bank",
      card: "exact card",
      experience: "showtime experience",
      format: "2D/3D format",
      seatType: "seat category",
      membership: "VOX membership status",
      channel: "booking channel",
      ticketCount: "ticket count",
      orderTotal: "order total",
      monthlyTicketsUsed: "monthly offer usage",
      monthlySpend: "monthly retail spend",
      cinema: "cinema",
    },
    source: "Official offer page",
    back: "Go back",
    expand: "Show offer details",
    collapse: "Hide offer details",
  },
  ar: {
    title: "عروض البنوك",
    subtitle: "19 عرضاً منشوراً لدى ڤوكس الإمارات",
    search: "ابحث عن البنك أو البطاقة",
    searchLabel: "البحث في عروض البنوك",
    cardLabel: "البطاقة المطلوب التحقق منها",
    chooseCard: "اختر اسم بطاقتك بدقة",
    noResults: "لم يتم العثور على بنك أو بطاقة مطابقة.",
    eligible: "مدرجة ضمن البطاقات المؤهلة",
    ineligible: "غير مؤهلة",
    cardRequired: "يلزم تحديد البطاقة",
    commonTerm: "تسري شروط العضوية والحجز عبر الإنترنت.",
    guestTerm: "يمكن استخدام TouchPoints كعضو أو كضيف، مع استمرار شروط الحجز عبر الإنترنت.",
    foodBenefit: "قد تنطبق ميزة إضافية لدى الكاندي بار؛ راجع شروط البنك الكاملة.",
    verified: "تاريخ مراجعة المرجع",
    detailsNeeded: "نحتاج إلى هذه التفاصيل لتقييم الأهلية: {fields}.",
    exactCardNeeded: "اختر الاسم الدقيق للبطاقة حتى لا يتم تخمين الأهلية.",
    fields: {
      bank: "البنك المُصدر",
      card: "اسم البطاقة الدقيق",
      experience: "تجربة موعد العرض",
      format: "صيغة 2D أو 3D",
      seatType: "فئة المقعد",
      membership: "حالة عضوية VOX",
      channel: "قناة الحجز",
      ticketCount: "عدد التذاكر",
      orderTotal: "إجمالي الطلب",
      monthlyTicketsUsed: "الاستخدام الشهري للعرض",
      monthlySpend: "الإنفاق الشهري لدى البنك",
      cinema: "السينما",
    },
    source: "صفحة العرض الرسمية",
    back: "رجوع",
    expand: "عرض تفاصيل العرض",
    collapse: "إخفاء تفاصيل العرض",
  },
};

const STATUS_STYLE = {
  [ELIGIBILITY.ELIGIBLE]: { color: C.green, background: C.successSoft, Icon: BadgeCheck },
  [ELIGIBILITY.INELIGIBLE]: { color: C.danger, background: C.dangerSoft, Icon: XCircle },
  [ELIGIBILITY.CARD_REQUIRED]: { color: C.primary, background: C.primarySoft, Icon: HelpCircle },
};

function localized(value, language) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[language] || value.en || "";
}

function Status({ result, copy, language }) {
  const view = STATUS_STYLE[result.status] || STATUS_STYLE[ELIGIBILITY.CARD_REQUIRED];
  const label = result.status === ELIGIBILITY.ELIGIBLE
    ? copy.eligible
    : result.status === ELIGIBILITY.INELIGIBLE
      ? copy.ineligible
      : language === "ar" ? "نحتاج تفاصيل إضافية" : "More details needed";
  const missingFields = (result.missingFields || []).map((field) => copy.fields[field] || field);
  const detailsReason = missingFields.length
    ? copy.detailsNeeded.replace("{fields}", missingFields.join(language === "ar" ? "، " : ", "))
    : copy.exactCardNeeded;
  const reason = language === "ar"
    ? result.status === ELIGIBILITY.ELIGIBLE
      ? "هذه البطاقة مدرجة ضمن الفئات المؤهلة للسياق المحدد."
      : result.status === ELIGIBILITY.INELIGIBLE
        ? "لا تتحقق جميع شروط هذا العرض في السياق المحدد؛ راجع الشروط أو أكد الأهلية عند الدفع."
        : detailsReason
    : result.reason;
  const advisory = language === "ar" && result.advisory
    ? "يتم التأكيد النهائي للأهلية عند إتمام الحجز لدى ڤوكس."
    : result.advisory;
  return (
    <div role="status" aria-live="polite" style={{ borderRadius: 10, background: view.background, padding: "9px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: view.color, fontSize: 12, fontWeight: 800 }}>
        <view.Icon size={15} aria-hidden="true" /> {label}
      </div>
      <div style={{ marginTop: 4, color: C.text, fontSize: 11, lineHeight: 1.45 }}>{reason}</div>
      {advisory && <div style={{ marginTop: 4, color: C.muted, fontSize: 10, lineHeight: 1.4 }}>{advisory}</div>}
    </div>
  );
}

function OfferMedia({ media }) {
  const imageUrl = getMediaUrl(media);
  const [imgOk, setImgOk] = React.useState(!!imageUrl);

  React.useEffect(() => setImgOk(!!imageUrl), [imageUrl]);

  return (
    <span aria-hidden="true" style={{ display: "grid", width: 30, height: 30, flexShrink: 0, overflow: "hidden", placeItems: "center", borderRadius: 8, background: C.primarySoft, color: C.primary }}>
      {imgOk && imageUrl
        ? <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setImgOk(false)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : <CreditCard size={15} />}
    </span>
  );
}

function OfferRow({ offer, expanded, onToggle, selectedProfileId, onProfileChange, language, copy, context }) {
  const isRtl = language === "ar";
  const profile = offer.profiles.find((item) => item.id === selectedProfileId) || null;
  const result = evaluateOfferEligibility(offer, profile, context);
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  return (
    <article style={{ overflow: "hidden", borderRadius: 13, border: `1px solid ${expanded ? C.primary : C.border}`, background: C.surface }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`offer-details-${offer.id}`}
        aria-label={`${expanded ? copy.collapse : copy.expand}: ${localized(offer.bank, language)}`}
        style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, border: 0, background: "transparent", padding: "11px 12px", color: C.text, textAlign: isRtl ? "right" : "left", cursor: "pointer" }}
      >
        <OfferMedia media={getOfferMedia(offer)} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", overflow: "hidden", color: C.text, fontSize: 13, fontWeight: 800, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{localized(offer.bank, language)}</span>
          <span style={{ display: "block", marginTop: 2, overflow: "hidden", color: C.muted, fontSize: 10, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{localized(offer.headline, language)}</span>
        </span>
        <Arrow size={16} aria-hidden="true" color={C.muted} style={{ transform: expanded ? "rotate(90deg)" : undefined, transition: "transform .15s ease" }} />
      </button>

      {expanded && (
        <div id={`offer-details-${offer.id}`} style={{ borderTop: `1px solid ${C.border}`, padding: "11px 12px 12px" }}>
          <p style={{ margin: "0 0 10px", color: C.text, fontSize: 11, lineHeight: 1.5 }}>{localized(offer.summary, language)}</p>

          {!offer.profiles.some((item) => item.noCardRequired) && (
            <label style={{ display: "block", marginBottom: 9 }}>
              <span style={{ display: "block", marginBottom: 5, color: C.muted, fontSize: 10, fontWeight: 700 }}>{copy.cardLabel}</span>
              <select
                value={selectedProfileId || ""}
                onChange={(event) => onProfileChange(event.target.value)}
                style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 9, outlineOffset: 2, background: C.surface, padding: "8px 9px", color: C.text, fontSize: 11 }}
              >
                <option value="">{copy.chooseCard}</option>
                {offer.profiles.map((item) => <option key={item.id} value={item.id}>{localized(item.name, language)}</option>)}
              </select>
            </label>
          )}

          <Status result={result} copy={copy} language={language} />
          {offer.notes && <p style={{ margin: "8px 1px 0", color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{localized(offer.notes, language)}</p>}
          {offer.foodBenefit && <p style={{ margin: "8px 1px 0", color: C.muted, fontSize: 10, lineHeight: 1.45 }}>{language === "ar" ? copy.foodBenefit : offer.foodBenefit}</p>}
        </div>
      )}
    </article>
  );
}

export function OffersPanel({
  locale = "en",
  context = {},
  cinemaName = "",
  experience = "",
  onBack,
  initialQuery = "",
  initialOfferId = "",
  initialProfileId = "",
  onSelectionChange,
  error,
  onRetry,
}) {
  const language = String(locale).toLowerCase().startsWith("ar") ? "ar" : "en";
  const copy = COPY[language];
  const isRtl = language === "ar";
  const [query, setQuery] = React.useState(initialQuery);
  const firstMatch = React.useMemo(() => searchOffers(initialQuery)[0], [initialQuery]);
  const [expandedId, setExpandedId] = React.useState(initialOfferId || (initialQuery ? firstMatch?.id || "" : ""));
  const [profiles, setProfiles] = React.useState(() => initialOfferId && initialProfileId ? { [initialOfferId]: initialProfileId } : {});
  const visibleOffers = React.useMemo(() => searchOffers(query), [query]);
  const resolvedContext = { ...context, cinemaName: cinemaName || context.cinemaName, experience: experience || context.experience };
  const touchpointsOnly = visibleOffers.length === 1 && visibleOffers[0]?.id === "adcb-touchpoints";

  React.useEffect(() => {
    setQuery(initialQuery);
    const nextOfferId = initialOfferId || (initialQuery ? firstMatch?.id || "" : "");
    setExpandedId(nextOfferId);
    setProfiles(initialOfferId && initialProfileId ? { [initialOfferId]: initialProfileId } : {});
  }, [firstMatch?.id, initialOfferId, initialProfileId, initialQuery]);

  return (
    <section dir={isRtl ? "rtl" : "ltr"} aria-labelledby="offers-heading" style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label={copy.back} style={iconButton}>
            {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
        <span aria-hidden="true" style={{ display: "grid", width: 34, height: 34, placeItems: "center", borderRadius: 9, background: C.primarySoft, color: C.primary }}><CreditCard size={17} /></span>
        <div>
          <h2 id="offers-heading" style={{ margin: 0, color: C.text, fontSize: 16, lineHeight: 1.2 }}>{copy.title}</h2>
          <div style={{ marginTop: 2, color: C.muted, fontSize: 10 }}>{copy.subtitle}</div>
        </div>
      </header>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, border: `1px solid ${C.border}`, borderRadius: 11, background: C.surface, padding: "8px 10px" }}>
        <Search size={15} aria-hidden="true" color={C.muted} />
        <span style={srOnly}>{copy.searchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          style={{ minWidth: 0, flex: 1, border: 0, outline: 0, background: "transparent", color: C.text, fontSize: 12, textAlign: isRtl ? "right" : "left" }}
        />
      </label>

      <p style={{ margin: "0 1px 10px", color: C.muted, fontSize: 10 }}>{touchpointsOnly ? copy.guestTerm : copy.commonTerm}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {!error && visibleOffers.map((offer) => (
          <OfferRow
            key={offer.id}
            offer={offer}
            expanded={expandedId === offer.id}
            onToggle={() => {
              const isOpening = expandedId !== offer.id;
              setExpandedId((current) => current === offer.id ? "" : offer.id);
              if (isOpening) {
                const profile = offer.profiles.find((item) => item.id === profiles[offer.id])
                  || offer.profiles.find((item) => item.noCardRequired)
                  || null;
                if (profile) onSelectionChange?.(evaluateOfferEligibility(offer, profile, resolvedContext));
              }
            }}
            selectedProfileId={profiles[offer.id] || ""}
            onProfileChange={(profileId) => {
              setProfiles((current) => ({ ...current, [offer.id]: profileId }));
              const profile = offer.profiles.find((item) => item.id === profileId) || null;
              onSelectionChange?.(evaluateOfferEligibility(offer, profile, resolvedContext));
            }}
            language={language}
            copy={copy}
            context={resolvedContext}
          />
        ))}
        {error && <div role="alert" style={{ border: `1px dashed ${C.warning}`, borderRadius: 11, background: C.warningSoft, padding: 18, color: C.text, fontSize: 11, textAlign: "center" }}>
          <div>{language === "ar" ? "تعذر تحميل عروض البطاقات." : "Card offers could not be loaded."}</div>
          {onRetry && <button type="button" onClick={onRetry} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, border: 0, borderRadius: 8, background: C.primary, padding: "7px 10px", color: C.onPrimary, cursor: "pointer", fontSize: 10 }}><RefreshCw size={12} aria-hidden="true" />{language === "ar" ? "حاول مرة أخرى" : "Try again"}</button>}
        </div>}
        {!error && !visibleOffers.length && <div role="status" style={{ border: `1px dashed ${C.border}`, borderRadius: 11, background: C.surfaceAlt, padding: 18, color: C.muted, fontSize: 11, textAlign: "center" }}>{copy.noResults}</div>}
      </div>

      <footer style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, color: C.muted, fontSize: 9, lineHeight: 1.5 }}>
        <div>{localized(OFFER_META.disclaimer, language)}</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 5 }}>
          <span>{copy.verified}: <time dateTime={OFFER_META.verifiedDate}>{OFFER_META.verifiedDate}</time></span>
          <a href={OFFER_META.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: C.primary }}>{copy.source}<ExternalLink size={10} aria-hidden="true" /></a>
        </div>
        <details style={{ marginTop: 5 }}>
          <summary style={{ cursor: "pointer" }}>{language === "ar" ? "الشروط العامة" : "Common terms"}</summary>
          <ul style={{ margin: "5px 0 0", paddingInlineStart: 17 }}>
            {(touchpointsOnly ? COMMON_OFFER_TERMS[language].slice(1) : COMMON_OFFER_TERMS[language]).map((term) => <li key={term} style={{ marginTop: 3 }}>{term}</li>)}
          </ul>
        </details>
      </footer>
    </section>
  );
}

const iconButton = { display: "grid", width: 32, height: 32, flexShrink: 0, placeItems: "center", border: `1px solid ${C.border}`, borderRadius: 8, outlineOffset: 2, background: C.surfaceAlt, color: C.primary, cursor: "pointer" };
const srOnly = { position: "absolute", width: 1, height: 1, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap" };

export default OffersPanel;
