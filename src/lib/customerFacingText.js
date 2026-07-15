const FORBIDDEN_DASHES = new RegExp(
  `[${String.fromCodePoint(0x2013)}${String.fromCodePoint(0x2014)}]`,
  "gu",
);

export function normalizeCustomerFacingText(value) {
  return String(value ?? "").replace(FORBIDDEN_DASHES, "-");
}

export function normalizeCustomerFacingFields(value, fields = []) {
  if (!value || typeof value !== "object") return value;
  const normalized = { ...value };
  for (const field of fields) {
    if (typeof normalized[field] === "string") {
      normalized[field] = normalizeCustomerFacingText(normalized[field]);
    }
  }
  return normalized;
}

export function hasForbiddenCustomerFacingDash(value) {
  FORBIDDEN_DASHES.lastIndex = 0;
  return FORBIDDEN_DASHES.test(String(value ?? ""));
}
