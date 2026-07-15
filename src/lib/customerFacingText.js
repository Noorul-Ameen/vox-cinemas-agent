const FORBIDDEN_DASHES = new RegExp(
  `[${String.fromCodePoint(0x2013)}${String.fromCodePoint(0x2014)}]`,
  "gu",
);

export function normalizeCustomerFacingText(value) {
  return String(value ?? "").replace(FORBIDDEN_DASHES, "-");
}

export function hasForbiddenCustomerFacingDash(value) {
  FORBIDDEN_DASHES.lastIndex = 0;
  return FORBIDDEN_DASHES.test(String(value ?? ""));
}
