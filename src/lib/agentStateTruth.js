const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

const seatEditRefusal = (value) => /\b(?:can(?:not|'t)|unable to)\b[\s\S]{0,80}\b(?:change|edit|add|remove)\b[\s\S]{0,80}\bseats?\b|\b(?:new|another) booking\b[\s\S]{0,80}\b(?:change|edit|add|remove|seat)\b|(?:لا يمكن|لا أستطيع|لا استطيع)[\s\S]{0,80}(?:تغيير|تعديل|إضافة|اضافة|حذف)[\s\S]{0,80}(?:المقاعد|مقعد)/iu.test(value);

const bookingConfirmationClaim = (value) => {
  if (/\b(?:not|isn't|is not|has not been)\s+confirmed\b|\bnot confirmed yet\b|(?:لم يتم|غير)\s+تأكيد\s+الحجز/iu.test(value)) return false;
  return /\b(?:booking|reservation)\b[\s\S]{0,140}\b(?:is\s+|has been\s+|was\s+)?(?:confirmed|completed|successful)\b|\b(?:confirmed|completed|successful)\b[\s\S]{0,100}\b(?:booking|reservation)\b|(?:تم تأكيد|تأكد|اكتمل)[\s\S]{0,80}(?:الحجز|حجزك)/iu.test(value);
};

const paymentCompletionClaim = (value) => /\bpayment\b[\s\S]{0,80}\b(?:was|is|has been)?\s*(?:charged|processed|completed|successful|approved)\b|\b(?:charged|processed|completed)\b[\s\S]{0,80}\bpayment\b|(?:تم|اكتملت)[\s\S]{0,50}(?:عملية الدفع|الدفع بنجاح)/iu.test(value);
const referenceCreationClaim = (value) => /\b(?:booking reference|reservation reference|reference number|qr code)\b[\s\S]{0,80}\b(?:is|created|generated|ready)\b|(?:مرجع الحجز|رقم الحجز|رمز QR)[\s\S]{0,80}(?:جاهز|تم إنشاؤه|هو)/iu.test(value);
const admissionReadyClaim = (value) => /\b(?:tickets?|admission|reservation)\b[\s\S]{0,60}\b(?:is|are)\s+ready\b|\b(?:use|scan|show)\b[\s\S]{0,50}\bqr(?:\s+code)?\b[\s\S]{0,70}\b(?:admission|entry|enter|cinema)\b|(?:التذكرة|التذاكر|الدخول|الحجز)[\s\S]{0,60}(?:جاهز|جاهزة|جاهزة للدخول)|(?:استخدم|امسح|اعرض)[\s\S]{0,50}(?:رمز QR)[\s\S]{0,60}(?:للدخول|السينما)/iu.test(value);
const seatMapDisplayClaim = (value) => /\b(?:displayed|shown|opened)\b[\s\S]{0,90}\bseat map\b|\bseat map\b[\s\S]{0,90}\b(?:displayed|shown|open|on (?:the )?screen)\b|(?:عرضت|فتحت|تظهر)[\s\S]{0,80}(?:خريطة المقاعد)/iu.test(value);
const bookingSummaryDisplayClaim = (value) => /\b(?:displayed|shown|created|opened)\b[\s\S]{0,90}\bbooking summary\b|\bbooking summary\b[\s\S]{0,90}\b(?:displayed|shown|created|open|on (?:the )?screen)\b|(?:عرضت|أنشأت|انشأت|فتحت)[\s\S]{0,80}(?:ملخص الحجز)/iu.test(value);
const checkoutInstructionClaim = (value) => /\b(?:complete|finish|continue)\b[\s\S]{0,60}\b(?:your\s+|the\s+)?booking\b[\s\S]{0,60}\b(?:screen|checkout)\b|(?:أكمل|اكمل|تابع)[\s\S]{0,50}(?:الحجز|حجزك)[\s\S]{0,50}(?:الشاشة|الدفع)/iu.test(value);
const checkoutDisplayClaim = (value) => /\bcheckout\b[\s\S]{0,70}\b(?:displayed|shown|open|on (?:the )?screen)\b|\b(?:displayed|shown|opened)\b[\s\S]{0,70}\bcheckout\b|(?:شاشة الدفع|الدفع)[\s\S]{0,60}(?:مفتوحة|ظاهرة|معروضة)/iu.test(value);
const referenceOnlyCancellationPrompt = (value) => /\b(?:need|provide|enter|give|have)\b[\s\S]{0,55}\b(?:booking\s+)?(?:reference|ref(?:erence)?\s+number)\b|\bwhat(?:'s| is)\s+(?:the|your)\s+(?:booking\s+)?(?:reference|ref(?:erence)?\s+number)\b|\bdo you have (?:it|the reference)\b|(?:احتاج|أحتاج|أدخل|ادخل|زودني|اعطني|هل لديك|ما هو|ما هي)[\s\S]{0,55}(?:مرجع الحجز|رقم الحجز|المرجع)/iu.test(value);

function orderSeatLabels(stage, pendingOrder) {
  const order = pendingOrder || stage?.order || {};
  return Array.isArray(order.seats) ? order.seats.map((seat) => clean(seat).toUpperCase()).filter(Boolean) : [];
}

function mismatchedCheckoutFacts(value, stage, pendingOrder) {
  const expectedSeats = orderSeatLabels(stage, pendingOrder);
  const claimsSeats = /\b(?:selected|chosen|your)\s+seats?\b|(?:المقاعد\s+(?:المحددة|المختارة)|مقاعدك)/iu.test(value);
  if (claimsSeats && expectedSeats.length) {
    const claimedSeats = [...value.matchAll(/\b([A-Z]\d{1,2})\b/giu)].map((match) => match[1].toUpperCase());
    if (claimedSeats.length && (claimedSeats.length !== expectedSeats.length || claimedSeats.some((seat) => !expectedSeats.includes(seat)))) return true;
  }

  const expectedTotal = Number((pendingOrder || stage?.order)?.total);
  const amountMatch = value.match(/(?:AED\s*([0-9]+(?:\.[0-9]{1,2})?)|([0-9]+(?:\.[0-9]{1,2})?)\s*AED)\b/iu);
  const claimedTotal = Number(amountMatch?.[1] || amountMatch?.[2]);
  return Number.isFinite(expectedTotal) && Number.isFinite(claimedTotal) && Math.abs(expectedTotal - claimedTotal) > 0.009;
}

function checkoutGuidance(stage, pendingOrder, locale) {
  const order = pendingOrder || stage?.order || {};
  const seats = Array.isArray(order.seats) ? order.seats.filter(Boolean) : [];
  if (locale === "ar") {
    return `${seats.length ? `المقاعد المحددة ${seats.join("، ")} ظاهرة في شاشة الدفع. ` : "المقاعد المحددة ظاهرة في شاشة الدفع. "}أكمل خطوة الدفع على الشاشة، أو اختر تعديل المقاعد لتغييرها. لم يتم تأكيد الحجز بعد.`;
  }
  return `${seats.length ? `Your selected seats ${seats.join(", ")} are shown in checkout. ` : "Your selected seats are shown in checkout. "}Complete the on-screen payment step, or choose Edit seats to change them. The booking is not confirmed yet.`;
}

function seatMapGuidance(locale) {
  return locale === "ar"
    ? "خريطة المقاعد مفتوحة ويمكنك تعديل اختيارك. اختر المقاعد التي تريدها، ثم أكدها للعودة إلى الدفع. لم يتم تأكيد الحجز بعد."
    : "The seat map is open and your seats are editable. Select the seats you want, then confirm them to return to checkout. The booking is not confirmed yet.";
}

function savedSummaryGuidance(booking, locale) {
  const title = clean(booking?.movieTitle);
  const ref = clean(booking?.ref);
  if (locale === "ar") {
    return `تم حفظ ملخص الحجز${title ? ` لفيلم ${title}` : ""} على هذا الجهاز${ref ? ` بالمرجع ${ref}` : ""}. لم يتم تحصيل أي دفعة أو إرسال حجز إلى السينما.`;
  }
  return `Your booking summary${title ? ` for ${title}` : ""} is saved on this device${ref ? ` with reference ${ref}` : ""}. No payment was charged and no cinema reservation was submitted.`;
}

function cancelledSummaryGuidance(booking, locale) {
  const title = clean(booking?.movieTitle);
  const ref = clean(booking?.ref);
  if (locale === "ar") {
    return `تم وضع علامة ملغي على ملخص الحجز${title ? ` لفيلم ${title}` : ""} على هذا الجهاز${ref ? ` بالمرجع ${ref}` : ""}. لم تتم معالجة استرداد أي مبلغ أو إرسال إلغاء إلى السينما.`;
  }
  return `The booking summary${title ? ` for ${title}` : ""}${ref ? ` with reference ${ref}` : ""} is marked cancelled on this device. No refund was processed and no cancellation was sent to the cinema.`;
}

function preservedCheckoutGuidance(pendingOrder, locale) {
  const seats = Array.isArray(pendingOrder?.seats) ? pendingOrder.seats.filter(Boolean) : [];
  if (locale === "ar") {
    return `تم حفظ خطوة الدفع غير المكتملة${seats.length ? ` للمقاعد ${seats.join("، ")}` : ""}، لكنها غير معروضة الآن. اطلب العودة إلى الدفع لعرضها، أو اطلب تعديل المقاعد. لم يتم تأكيد الحجز بعد.`;
  }
  return `Your unpaid checkout${seats.length ? ` for seats ${seats.join(", ")}` : ""} is preserved but is not currently shown. Ask to return to checkout to display it, or ask to edit seats. The booking is not confirmed yet.`;
}

function historyGuidance(locale) {
  return locale === "ar"
    ? "ملخصات حجوزاتك المحفوظة على هذا الجهاز ظاهرة الآن. اختر حجزاً لعرض التفاصيل، أو استخدم زر إلغاء الحجز الخاص به."
    : "Your current on-device booking summaries are shown. Select one to view its details, or use its Cancel booking button.";
}

const normalizeMatchText = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}:]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

function visibleMovieTitles(stage) {
  if (stage?.view !== "movies" || !Array.isArray(stage?.movies)) return [];
  return [...new Set(stage.movies
    .map((movie) => clean(movie?.title || movie?.name))
    .filter(Boolean))];
}

function overloadedMovieListing(value, stage) {
  const titles = visibleMovieTitles(stage);
  if (titles.length < 2) return false;
  const normalizedValue = ` ${normalizeMatchText(value)} `;
  const mentionedTitles = titles.filter((title) => {
    const normalizedTitle = normalizeMatchText(title);
    return normalizedTitle && normalizedValue.includes(` ${normalizedTitle} `);
  });
  if (mentionedTitles.length > 5) return true;

  const timeMentions = String(value || "").match(/\b(?:(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)|(?:[01]?\d|2[0-3]):[0-5]\d)\b/giu) || [];
  // A many-time answer with one named title can be a legitimate detail reply.
  // Zero or multiple named titles while the movie grid is visible means the
  // agent is narrating the grid instead of asking for one movie choice.
  return timeMentions.length >= 6 && mentionedTitles.length !== 1;
}

function conciseMovieChoiceGuidance(stage, locale) {
  const titles = visibleMovieTitles(stage);
  const shownTitles = titles.slice(0, 5);
  const titleList = shownTitles.join(locale === "ar" ? "، " : ", ");
  if (locale === "ar") {
    return `تظهر الآن ${titles.length} من خيارات الأفلام.${titleList ? ` من العناوين الظاهرة: ${titleList}.` : ""} أي فيلم تود اختياره؟`;
  }
  return `${titles.length} movie ${titles.length === 1 ? "option is" : "options are"} shown.${titleList ? ` Visible titles include ${titleList}.` : ""} Which movie would you like?`;
}

function discoveryStepGuidance(stage, locale) {
  const view = stage?.view;
  if (view === "discovery") {
    const supplied = clean(stage?.question || stage?.error);
    if (supplied) return supplied;
    const missing = stage?.missing?.[0];
    if (locale === "ar") {
      if (missing === "cinema") return "اختر موقع VOX Cinemas UAE للمتابعة.";
      if (missing === "date") return "اختر تاريخاً للمتابعة.";
      return "أجب عن سؤال تفضيلات الفيلم الظاهر للمتابعة.";
    }
    if (missing === "cinema") return "Choose a VOX Cinemas UAE location to continue.";
    if (missing === "date") return "Choose a date to continue.";
    return "Answer the displayed movie preference question to continue.";
  }

  if (view === "movies") {
    const movies = Array.isArray(stage?.movies) ? stage.movies.filter(Boolean) : [];
    if (!movies.length) {
      const supplied = clean(stage?.error || stage?.notice);
      if (supplied) return supplied;
      return locale === "ar"
        ? "لا توجد خيارات أفلام ظاهرة الآن. غيّر أحد التفضيلات أو حاول مرة أخرى."
        : "No movie options are currently shown. Change one preference or try again.";
    }
    if (locale === "ar") return `تظهر الآن ${movies.length} من خيارات الأفلام. اختر فيلماً من الخيارات الظاهرة للمتابعة.`;
    return `${movies.length} movie ${movies.length === 1 ? "option is" : "options are"} shown. Choose one of the displayed movies to continue.`;
  }

  if (view === "showtimes") {
    const sessions = Array.isArray(stage?.sessions) ? stage.sessions.filter(Boolean) : [];
    const title = clean(stage?.movie?.title);
    if (!sessions.length) {
      const supplied = clean(stage?.error || stage?.notice);
      if (supplied) return supplied;
      return locale === "ar"
        ? `لا توجد مواعيد عرض ظاهرة الآن${title ? ` لفيلم ${title}` : ""}. اختر فيلماً أو تاريخاً آخر.`
        : `No showtime options are currently shown${title ? ` for ${title}` : ""}. Choose another movie or date.`;
    }
    if (locale === "ar") return `تظهر الآن ${sessions.length} من مواعيد العرض${title ? ` لفيلم ${title}` : ""}. اختر موعد عرض ظاهراً للمتابعة.`;
    return `${sessions.length} showtime ${sessions.length === 1 ? "option is" : "options are"} shown${title ? ` for ${title}` : ""}. Choose one displayed showtime to continue.`;
  }

  return null;
}

function wrongDiscoveryQuestion(value, stage) {
  if (stage?.view !== "discovery" || !stage?.missing?.[0] || !stage.question) return false;
  const asksCinema = /\b(?:which|what)\b[\s\S]{0,30}\b(?:cinema|location)\b|\bwhere\b[\s\S]{0,30}\b(?:watch|cinema|location)\b|(?:أي|اي|ما)\s+(?:سينما|موقع)|وين[\s\S]{0,20}(?:سينما|موقع)/iu.test(value);
  const asksDate = /\b(?:which|what)\s+(?:date|day)\b|\bwhen\b[\s\S]{0,30}\b(?:go|visit|watch)\b|(?:ما|أي|اي)\s+(?:التاريخ|تاريخ|يوم)|متى/iu.test(value);
  const asksPreference = /\b(?:which|what)\s+(?:movie|film|time|showtime|genre|language|experience)\b|\bwhat would you prefer\b|\bwhat are you in the mood for\b|(?:أي|اي|ما)\s+(?:فيلم|وقت|موعد|نوع|لغة|تجربة)|ماذا تفضل/iu.test(value);
  if (stage.missing[0] === "cinema") return asksDate || asksPreference;
  if (stage.missing[0] === "date") return asksCinema || asksPreference;
  if (stage.missing[0] === "preference") return asksCinema || asksDate;
  return false;
}

function staleProgressionQuestion(value, stage, pendingOrder, locale) {
  const asksMovie = /\b(?:what|which)\s+(?:movie|film)\b|\bwhat\b[\s\S]{0,35}\b(?:like|want)\s+to\s+(?:watch|see)\b|(?:أي|اي|ما)\s+(?:فيلم|الفيلم)|ماذا\s+(?:تريد|تفضل)[\s\S]{0,25}(?:تشاهد|مشاهدة)/iu.test(value);
  const asksShowtime = /\b(?:what|which)\s+(?:showtime|time|session)\b|\bwhen\b[\s\S]{0,30}\b(?:watch|see|go)\b|(?:أي|اي|ما)\s+(?:وقت|موعد|عرض)|متى[\s\S]{0,25}(?:العرض|تشاهد)/iu.test(value);
  if (stage?.view === "showtimes" && asksMovie) {
    const title = clean(stage.movie?.title);
    return locale === "ar"
      ? `${title ? `تم اختيار ${title}. ` : "تم اختيار الفيلم. "}اختر أحد مواعيد العرض الظاهرة.`
      : `${title ? `${title} is selected. ` : "The movie is selected. "}Choose one of the displayed showtimes.`;
  }
  if (stage?.view === "seatmap" && (asksMovie || asksShowtime)) return seatMapGuidance(locale);
  if (stage?.view === "checkout" && (asksMovie || asksShowtime)) return checkoutGuidance(stage, pendingOrder, locale);
  return null;
}

export function guardAgentStateClaim(text, { stage = {}, pendingOrder = null, locale = "en" } = {}) {
  const value = clean(text);
  if (!value) return value;

  if (overloadedMovieListing(value, stage)) return conciseMovieChoiceGuidance(stage, locale);

  if (wrongDiscoveryQuestion(value, stage)) return clean(stage.question);
  const progressionCorrection = staleProgressionQuestion(value, stage, pendingOrder, locale);
  if (progressionCorrection) return progressionCorrection;

  if (stage?.view === "history"
    && stage?.purpose === "cancellation_target_selection"
    && Array.isArray(stage.candidateRefs)
    && stage.candidateRefs.length
    && referenceOnlyCancellationPrompt(value)) {
    return locale === "ar"
      ? "اختر أحد الحجوزات الحالية الظاهرة باسم الفيلم أو بمرجع الحجز."
      : "Choose one of the current bookings shown, by movie title or booking reference.";
  }

  const visibleCheckout = stage?.view === "checkout";
  const preservedCheckout = !visibleCheckout && Boolean(pendingOrder?.checkoutId);
  const editableCheckout = visibleCheckout || preservedCheckout;
  const editableSeatMap = stage?.view === "seatmap";
  if (seatEditRefusal(value) && editableCheckout) {
    if (preservedCheckout) return preservedCheckoutGuidance(pendingOrder, locale);
    return locale === "ar"
      ? "يمكنك تغيير المقاعد قبل إكمال الدفع. اختر تعديل المقاعد على الشاشة، أو قل تعديل المقاعد."
      : "You can change seats before completing checkout. Choose Edit seats on screen, or say edit seats.";
  }
  if (seatEditRefusal(value) && editableSeatMap) return seatMapGuidance(locale);

  if (editableCheckout && mismatchedCheckoutFacts(value, stage, pendingOrder)) {
    return visibleCheckout ? checkoutGuidance(stage, pendingOrder, locale) : preservedCheckoutGuidance(pendingOrder, locale);
  }

  if (seatMapDisplayClaim(value) && stage?.view !== "seatmap") {
    if (visibleCheckout) return checkoutGuidance(stage, pendingOrder, locale);
    if (preservedCheckout) return preservedCheckoutGuidance(pendingOrder, locale);
    if (stage?.view === "showtimes") {
      return locale === "ar"
        ? "اختر موعد عرض محدداً من الخيارات الظاهرة لفتح خريطة المقاعد."
        : "Choose one exact displayed showtime to open the seat map.";
    }
    return clean(stage?.question || stage?.error) || (locale === "ar"
      ? "خريطة المقاعد غير معروضة بعد."
      : "The seat map is not displayed yet.");
  }


  if (checkoutDisplayClaim(value) && stage?.view !== "checkout") {
    if (preservedCheckout) return preservedCheckoutGuidance(pendingOrder, locale);
    if (editableSeatMap) return seatMapGuidance(locale);
    const booking = stage?.booking || null;
    if (booking?.cancelled || String(booking?.bookingStatus || "").startsWith("cancelled")) {
      return cancelledSummaryGuidance(booking, locale);
    }
    if (booking) return savedSummaryGuidance(booking, locale);
    return clean(stage?.question || stage?.error) || (locale === "ar"
      ? "شاشة الدفع غير معروضة بعد. تابع من الخطوة الظاهرة على الشاشة."
      : "Checkout is not displayed yet. Continue from the step shown on screen.");
  }

  const transactionClaim = bookingConfirmationClaim(value)
    || paymentCompletionClaim(value)
    || referenceCreationClaim(value)
    || admissionReadyClaim(value)
    || bookingSummaryDisplayClaim(value)
    || checkoutInstructionClaim(value);
  if (!transactionClaim) return value;
  if (stage?.view === "history") return historyGuidance(locale);
  if (visibleCheckout) return checkoutGuidance(stage, pendingOrder, locale);
  if (preservedCheckout) return preservedCheckoutGuidance(pendingOrder, locale);
  if (editableSeatMap) return seatMapGuidance(locale);

  const booking = stage?.booking || null;
  const isCancelledSummary = Boolean(booking && (
    booking.cancelled === true
    || String(booking.bookingStatus || "").startsWith("cancelled")
  ));
  if (isCancelledSummary) return cancelledSummaryGuidance(booking, locale);
  const isSavedSummary = Boolean(booking && (
    booking.verified !== true
    || booking.demo === true
    || booking.paymentStatus === "simulated_not_charged"
    || booking.bookingStatus === "confirmed_demo"
    || booking.bookingStatus === "summary_saved"
  ));
  if (isSavedSummary) return savedSummaryGuidance(booking, locale);
  const visibleDiscoveryStep = discoveryStepGuidance(stage, locale);
  if (visibleDiscoveryStep) return visibleDiscoveryStep;
  if (stage?.view !== "booking") {
    return clean(stage?.question || stage?.error) || (locale === "ar"
      ? "لم يتم تأكيد الحجز بعد. تابع من الخطوة الظاهرة على الشاشة."
      : "The booking is not confirmed yet. Continue from the step shown on screen.");
  }
  return value;
}
