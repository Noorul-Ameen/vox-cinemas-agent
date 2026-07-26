const AMBIGUOUS_BARE_BOOKING = /^(?:book|choose|select|pick|watch)\s+(?:it|one|a movie|the movie)(?:\s+please)?[.!?,]*$/iu;
const AMBIGUOUS_BARE_BOOKING_AR = /^(?:\u0627\u062d\u062c\u0632(?:\u0647|\u0647\u0627)?|\u0627\u062e\u062a\u0631(?:\u0647|\u0647\u0627)?)(?:\s+\u0645\u0646\s+\u0641\u0636\u0644\u0643)?[.!?\u060c]*$/u;

export function isAmbiguousBareBookingTurn(input) {
  const value = String(input || "").trim();
  return Boolean(value && (AMBIGUOUS_BARE_BOOKING.test(value) || AMBIGUOUS_BARE_BOOKING_AR.test(value)));
}
