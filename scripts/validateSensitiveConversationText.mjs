import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildHandoverPayload, sanitizeTranscriptText } from "../src/lib/handoverSummary.js";
import {
  buildTransportHandoff,
  createConversationJourney,
  relevantConversationHistory,
} from "../src/lib/conversationJourney.js";
import { normalizeElevenLabsMessageEvent } from "../src/lib/conversationMessage.js";
import { sanitizeSensitiveConversationText } from "../src/lib/sensitiveText.js";

const sensitiveCases = [
  ["OTP is 123456", "123456"],
  ["otp: 654321", "654321"],
  ["my PIN is 1234", "1234"],
  ["PIN 4321", "4321"],
  ["CVC=321", "321"],
  ["security code is 987", "987"],
  ["verification code: 908172", "908172"],
  ["one-time password was 111222", "111222"],
  ["OTP number is 333444", "333444"],
  ["my password is Sup3rSecret!", "Sup3rSecret!"],
  ['password: "two word secret"', "two word secret"],
  ["Passcode equals OpenSesame", "OpenSesame"],
  ["رمز التحقق هو ١٢٣٤٥٦", "١٢٣٤٥٦"],
  ["رمز التحقق: 123456", "123456"],
  ["رمز التحقق الخاص بي هو 445566", "445566"],
  ["رمز التأكيد ٦٥٤٣٢١", "٦٥٤٣٢١"],
  ["الرقم السري هو ١٢٣٤", "١٢٣٤"],
  ["كلمة المرور هي سري-123", "سري-123"],
  ['كلمة السر: "سر خاص"', "سر خاص"],
  ["كلمة المرور الخاصة بي هي SafeNoMore7", "SafeNoMore7"],
  ["رمز الدخول = دخول123", "دخول123"],
  ["My card is 4111 1111 1111 1111", "4111 1111 1111 1111"],
  [`password is ${"A".repeat(240)}7`, `${"A".repeat(240)}7`],
  [`OTP is ${"12 ".repeat(15)}34`, `${"12 ".repeat(15)}34`],
];

for (const [input, secret] of sensitiveCases) {
  const result = sanitizeSensitiveConversationText(input);
  assert.equal(result.sensitive, true, `the sensitive turn must be detected: ${input}`);
  assert.equal(result.safeText.includes(secret), false, `the secret must be removed: ${input}`);
  assert.match(result.safeText, /\[(?:payment number )?removed\]/i, `the redaction must remain explicit: ${input}`);
}

const ordinaryConversationCases = [
  "Toy Story 5 at 20:30 on 23/07/2026",
  "I need 3 tickets for 17 July at 18:00",
  "Book PIN 5 tomorrow at Mall of the Emirates",
  "The movie Password starts at 19:30",
  "OTP is playing at 20:30",
  "Booking reference WLR215D for screen 6",
  "فيلم كلمة المرور يعرض الساعة ٢٠:٣٠ يوم ٢٣ يوليو",
  "رمز التحقق من الحجز موجود في التطبيق",
];

for (const input of ordinaryConversationCases) {
  assert.deepEqual(
    sanitizeSensitiveConversationText(input),
    { safeText: input, sensitive: false },
    `ordinary movie, date, time, ticket, and reference text must remain unchanged: ${input}`,
  );
}

for (const event of [
  { source: "user", message: "OTP is 123456" },
  { source: "ai", message: "Your OTP is 123456" },
]) {
  const normalized = normalizeElevenLabsMessageEvent(event);
  const sanitized = sanitizeSensitiveConversationText(normalized.text);
  assert.equal(sanitized.sensitive, true, `${normalized.role} transport events must detect credentials`);
  assert.equal(sanitized.safeText.includes("123456"), false, `${normalized.role} transport events must remove credentials before display`);
}

const messages = sensitiveCases.map(([text], index) => ({
  id: `secret-${index}`,
  role: "user",
  text,
}));
const retainedHistory = relevantConversationHistory(messages, messages.length);
const serializedHistory = JSON.stringify(retainedHistory);
for (const [, secret] of sensitiveCases) {
  assert.equal(serializedHistory.includes(secret), false, `transport history must not contain ${secret}`);
}
assert.equal(retainedHistory.length, sensitiveCases.length, "redaction must retain every conversational turn");

const journey = createConversationJourney("redaction-test");
const transportHandoff = buildTransportHandoff(journey, messages);
for (const [, secret] of sensitiveCases) {
  assert.equal(transportHandoff.includes(secret), false, `transport handoff must not contain ${secret}`);
}

for (const [input, secret] of sensitiveCases) {
  const sanitizedTranscript = sanitizeTranscriptText(input);
  assert.equal(sanitizedTranscript.includes(secret), false, `human handoff transcript text must not contain ${secret}`);
}

const handoverPayload = buildHandoverPayload({
  conversationId: "redaction-test",
  messages,
});
const serializedPayload = JSON.stringify(handoverPayload);
assert.equal(
  handoverPayload.integration.transcriptSanitization,
  "bilingual-credential-redaction.v2",
  "handoff metadata must identify the bilingual credential sanitizer",
);
for (const [, secret] of sensitiveCases) {
  assert.equal(serializedPayload.includes(secret), false, `human handoff payload must not contain ${secret}`);
}

const boundarySecret = `${"x".repeat(590)} OTP is 123456`;
const boundarySanitized = sanitizeTranscriptText(boundarySecret, 600);
assert.doesNotMatch(boundarySanitized, /OTP is 1/, "handoff truncation must happen after redaction so a boundary secret cannot leak partially");

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(
  appSource,
  /import \{ sanitizeSensitiveConversationText \} from "\.\/lib\/sensitiveText\.js";/,
  "typed and transcribed guest turns must use the centralized sanitizer",
);
const typedFlow = appSource.slice(
  appSource.indexOf("const sendText = useCallback"),
  appSource.indexOf("const sendUiTurn =", appSource.indexOf("const sendText = useCallback")),
);
assert.match(
  typedFlow,
  /const sanitized = sanitizeSensitiveConversationText\(rawValue\);\s*const value = sanitized\.safeText\.trim\(\);/,
  "typed text must be sanitized before routing or transport delivery",
);
assert.doesNotMatch(
  typedFlow,
  /conversation\.sendUserMessage\(rawValue\)/,
  "raw typed text must never be sent to ElevenLabs",
);
const transportArguments = [...typedFlow.matchAll(/conversation\.sendUserMessage\(([^)]+)\)/g)]
  .map((match) => match[1].trim());
assert.ok(transportArguments.length > 0, "the validator must inspect typed ElevenLabs deliveries");
assert.ok(
  transportArguments.every((argument) => ["value", "agentFacingValue"].includes(argument)),
  `typed ElevenLabs deliveries must use only sanitized values, received: ${transportArguments.join(", ")}`,
);
assert.match(
  typedFlow,
  /const agentFacingValue = normalizeCinemaAsrForAgent\(value, details\.cinema\)/,
  "any cinema normalization sent to ElevenLabs must be derived from sanitized text",
);
const inboundTransportFlow = appSource.slice(
  appSource.indexOf("onMessage: async (message) =>"),
  appSource.indexOf("onError:", appSource.indexOf("onMessage: async (message) =>")),
);
assert.match(
  inboundTransportFlow,
  /const \{ role, text: eventText \} = normalizedMessage;\s*const sanitized = sanitizeSensitiveConversationText\(eventText\);\s*const safeMessage = sanitized\.safeText;/,
  "every normalized ElevenLabs event must be sanitized before role-specific routing",
);
assert.doesNotMatch(
  inboundTransportFlow,
  /role === "user"\s*\?\s*sanitizeSensitiveConversationText/,
  "agent replies must pass through the same credential sanitizer as user transcripts",
);
assert.match(
  inboundTransportFlow,
  /resolveLanguageSignal\(\{\s*role,\s*text: safeMessage,/,
  "language routing must receive only sanitized inbound transport text",
);
assert.doesNotMatch(
  inboundTransportFlow,
  /say\([^,]+,\s*eventText\)/,
  "raw inbound transport text must never reach the visible transcript",
);
assert.match(
  inboundTransportFlow,
  /if \(role === "user"\)[\s\S]*if \(sanitized\.sensitive\) say\("system"/,
  "the credential warning must remain limited to the guest's own sensitive turn",
);

console.log(`Validated ${sensitiveCases.length} sensitive English and Arabic forms across typed transport, transport continuation, and human handoff, with ${ordinaryConversationCases.length} non-sensitive booking controls.`);
