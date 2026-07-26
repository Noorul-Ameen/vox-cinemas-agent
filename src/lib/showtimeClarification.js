export function showtimeClarification({
  candidates = [],
  sessions = [],
  locale = "en",
  voice = false,
} = {}) {
  const options = (candidates.length ? candidates : sessions)
    .map((session) => `${session.time} ${session.exp || session.experience || "STANDARD"}`)
    .join(", ");
  const multiple = candidates.length > 1;

  if (voice) {
    return `Showtimes remain visible: ${options}. Ask for one exact displayed time${multiple ? " and experience" : ""}; do not redisplay or restart discovery.`;
  }
  if (locale === "ar") {
    return multiple
      ? `اختر الوقت والتجربة بالضبط: ${options}.`
      : `بقيت مواعيد العرض ظاهرة: ${options}. اكتب وقتاً واحداً بالضبط.`;
  }
  return multiple
    ? `Choose the exact time and experience: ${options}.`
    : `The current options remain visible: ${options}. Type one exact time.`;
}
