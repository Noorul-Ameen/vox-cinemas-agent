export function uaeCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function remapDemoDate(displayDate, today, sourceDates) {
  const dates = Array.isArray(sourceDates) ? sourceDates : [];
  if (!dates.length) return displayDate;
  if (dates.includes(displayDate)) return displayDate;
  const dayMs = 24 * 60 * 60 * 1000;
  const offset = Math.round((Date.parse(`${displayDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs);
  const todayIndex = dates.indexOf(today);
  const baseIndex = todayIndex >= 0 ? todayIndex : 0;
  const index = (((baseIndex + offset) % dates.length) + dates.length) % dates.length;
  return dates[index];
}

