import { relevantConversationHistory } from "./conversationJourney.js";

export const VOXI_FIRST_MESSAGES = {
  en: "Hi, welcome to VOX Cinemas. I’m Voxi, your AI assistant. How can I help you today?",
  ar: "أهلاً بك في ڤوكس سينما. أنا Voxi، مساعدك الذكي. كيف أقدر أساعدك اليوم؟",
};

// This compact runtime prompt adapts the supplied VOXI reference to the
// client tools that are actually registered by this widget. Tool names are
// intentionally kept verbatim so the dashboard and client stay compatible.
export { VOXI_AGENT_PROMPT } from "./voxiPrompt.js";

export function buildVoxiContext({ locale, cinema, scheduleDate, stage, selectedSeats, requestedSeatTarget = null, discoveryPreferences = {}, offer = null, journey, messages }) {
  const language = locale === "ar" ? "Arabic" : "English";
  const movie = stage?.movie?.title || stage?.order?.movieTitle || stage?.booking?.movieTitle || "none selected";
  const movieRating = stage?.movie?.rating || stage?.order?.movieRating || stage?.booking?.movieRating || journey?.movie?.rating || "not supplied";
  const activeBooking = stage?.booking || (stage?.view === "booking" ? journey : null);
  const sessionValue = stage?.session || (stage?.order ? {
    date: stage.order.date,
    time: stage.order.showtime,
    exp: stage.order.experience,
    screen: stage.order.screen,
  } : activeBooking ? {
    date: activeBooking.date || journey?.session?.date,
    time: activeBooking.showtime || journey?.session?.time,
    exp: activeBooking.experience || journey?.session?.experience,
    screen: activeBooking.screen || journey?.session?.screen,
  } : journey?.session);
  const session = sessionValue
    ? `${sessionValue.date || scheduleDate || "date pending"} ${sessionValue.time || "time pending"} ${sessionValue.exp || sessionValue.experience || ""} ${sessionValue.screen || ""}`.trim()
    : "none selected";
  const context = journey || {};
  const history = relevantConversationHistory(messages, 6);
  const rawBookingStatus = context.bookingStatus
    || stage?.booking?.bookingStatus
    || (stage?.booking?.cancelled ? "cancelled" : stage?.booking ? "confirmed" : "not confirmed");
  const normalizedBookingStatus = String(rawBookingStatus || "").toLowerCase();
  const bookingStatus = normalizedBookingStatus.includes("demo")
    || ["summary_saved", "locally_stored"].includes(normalizedBookingStatus)
    ? "saved on this device"
    : rawBookingStatus;
  const rawRefundStatus = context.refundStatus || stage?.booking?.refundStatus || "not applicable";
  const refundStatus = rawRefundStatus === "not_processed_demo" ? "not processed" : rawRefundStatus;
  const offerState = offer?.offer ? {
    id: offer.offer.id,
    bank: offer.offer.bank?.en,
    card: offer.cardProfile?.name?.en || null,
    eligibility: offer.status || null,
    contextFingerprint: offer.contextFingerprint || offer.context?.fingerprint || null,
  } : null;
  return [
    `The guest explicitly selected ${language} as the active language.`,
    `The product scope is VOX Cinemas UAE.`,
    `Logical Voxi session ID: ${context.sessionId || "not assigned"}; current ElevenLabs transport conversation ID: ${context.transportConversationId || "not connected"}.`,
    `Current cinema: ${cinema?.name || context.cinema?.name || stage?.order?.cinemaName || stage?.booking?.cinemaName || "not selected; ask the guest to choose a VOX Cinemas UAE location before listing films"}.`,
    `Current published schedule date: ${scheduleDate || "not available"}.`,
    `Current journey: ${stage?.view || "empty"}; movie: ${movie}; movie age rating: ${movieRating}; session: ${session}; selected seats: ${(selectedSeats || []).join(", ") || "none"}; actual ticket count from selected seats: ${(selectedSeats || []).length || "none"}; requested seat target: ${requestedSeatTarget || "none"}.`,
    `Retained discovery criteria: cinema ${discoveryPreferences.cinemaName || "not supplied"}; city ${discoveryPreferences.city || "not supplied"}; date ${discoveryPreferences.date || "not supplied"}; preferred time ${discoveryPreferences.preferredTime || discoveryPreferences.timeBand || "not supplied"}; genre ${discoveryPreferences.genre || "not supplied"}; language ${discoveryPreferences.language || "not supplied"}; experience ${discoveryPreferences.experience || "not supplied"}; movie ${discoveryPreferences.movieTitle || "not supplied"}; audience ${discoveryPreferences.audience || "not supplied"}; open choice accepted ${discoveryPreferences.openChoice === true ? "yes" : "no"}; recommendation clarification ${discoveryPreferences.recommendationIntent || "none"}.`,
    `Current bank offer context: ${offerState ? JSON.stringify(offerState) : "none selected"}. Treat it as guidance only and never claim it was applied.`,
    `Structured progress: intent ${context.intent || "not yet known"}; actual ticket quantity ${context.ticketQuantity || "not selected"}; ticket type ${context.ticketType || "not selected"}; experience ${context.experience || "not selected"}; booking progress ${context.bookingProgress || stage?.view || "start"}; booking reference ${context.bookingRef || stage?.booking?.ref || "not confirmed"}; booking status ${bookingStatus}; refund route ${context.refundRoute || stage?.booking?.refundRoute || "not applicable"}; refund status ${refundStatus}; refund reference ${context.refundReference || stage?.booking?.refundReference || "not issued"}.`,
    `Recent relevant conversation history: ${history.length ? JSON.stringify(history) : "none"}.`,
    `Continue the active task in ${language}, keep the response short, and do not repeat the welcome message.`,
  ].join(" ");
}
