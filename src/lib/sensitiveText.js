export const SENSITIVE_VALUE_REMOVED = "[removed]";
export const PAYMENT_NUMBER_REMOVED = "[payment number removed]";

const DIGIT = "0-9\u0660-\u0669\u06f0-\u06f9";
const SEPARATED_SECRET_NUMBER = `[${DIGIT}](?:[ \\t.-]*[${DIGIT}]){2,31}`;
const QUOTED_OR_TOKEN_VALUE = String.raw`(?:"[^"\r\n]+"|'[^'\r\n]+'|“[^”\r\n]+”|‘[^’\r\n]+’|[^\s]+)`;

const ENGLISH_NUMERIC_LABEL = String.raw`(?:one[ -]*time[ \t]+(?:password|passcode|code)|(?:verification|authentication|confirmation|security)[ \t]+code|cvv|cvc|otp|pin)(?:[ \t]+(?:number|code))?`;
const ARABIC_NUMERIC_LABEL = String.raw`(?:رمز[ \t]+(?:التحقق|التأكيد|التاكيد|الأمان|الامان)|الرقم[ \t]+السري|رمز[ \t]+سري)`;
const ENGLISH_PASSWORD_LABEL = String.raw`(?:login[ \t]+password|password|passcode)`;
const ARABIC_PASSWORD_LABEL = String.raw`(?:كلم(?:ة|ه)[ \t]+(?:المرور|السر)|رمز[ \t]+الدخول)`;
const ARABIC_POSSESSIVE = String.raw`(?:[ \t]+الخاص(?:ة)?[ \t]+بي)?`;

const englishNumericSecretPattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${ENGLISH_NUMERIC_LABEL})(?![\\p{L}\\p{N}_])`
    + `(?:[ \\t]*[:=-][ \\t]*|[ \\t]+(?:(?:is|was|equals?)[ \\t]+)?)`
    + `(${SEPARATED_SECRET_NUMBER})(?![${DIGIT}])`,
  "giu",
);

const arabicNumericSecretPattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${ARABIC_NUMERIC_LABEL}${ARABIC_POSSESSIVE})(?![\\p{L}\\p{N}_])`
    + `(?:[ \\t]*[:=-][ \\t]*|[ \\t]+(?:(?:هو|هي|يساوي|تساوي)[ \\t]+)?)`
    + `(${SEPARATED_SECRET_NUMBER})(?![${DIGIT}])`,
  "gu",
);

const englishPasswordPattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${ENGLISH_PASSWORD_LABEL})(?![\\p{L}\\p{N}_])`
    + `(?:[ \\t]*[:=-][ \\t]*|[ \\t]+(?:is|was|equals?)[ \\t]+|[ \\t]+(?=["'“‘]))`
    + `(${QUOTED_OR_TOKEN_VALUE})`,
  "giu",
);

const arabicPasswordPattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${ARABIC_PASSWORD_LABEL}${ARABIC_POSSESSIVE})(?![\\p{L}\\p{N}_])`
    + `(?:[ \\t]*[:=-][ \\t]*|[ \\t]+(?:هو|هي|يساوي|تساوي)[ \\t]+|[ \\t]+(?=["'“‘]))`
    + `(${QUOTED_OR_TOKEN_VALUE})`,
  "gu",
);

const paymentNumberPattern = new RegExp(
  `(?<![${DIGIT}])(?:[${DIGIT}][ -]*){11,30}[${DIGIT}](?![${DIGIT}])`,
  "gu",
);

/**
 * Removes credentials and payment numbers before conversational text is
 * rendered, forwarded to a transport, or copied into a handoff transcript.
 * Labels are retained so the receiving agent can still understand the turn.
 */
export function sanitizeSensitiveConversationText(value) {
  let sensitive = false;
  let safeText = String(value ?? "");
  const redactLabelledValue = (_match, label) => {
    sensitive = true;
    return `${label} ${SENSITIVE_VALUE_REMOVED}`;
  };

  safeText = safeText
    .replace(englishNumericSecretPattern, redactLabelledValue)
    .replace(arabicNumericSecretPattern, redactLabelledValue)
    .replace(englishPasswordPattern, redactLabelledValue)
    .replace(arabicPasswordPattern, redactLabelledValue)
    .replace(paymentNumberPattern, () => {
      sensitive = true;
      return PAYMENT_NUMBER_REMOVED;
    });

  return { safeText, sensitive };
}
