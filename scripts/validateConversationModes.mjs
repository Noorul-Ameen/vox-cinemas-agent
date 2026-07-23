import assert from "node:assert/strict";
import fs from "node:fs";
import { STRINGS } from "../src/i18n/strings.js";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const localeBootstrap = fs.readFileSync(new URL("../public/locale-bootstrap.js", import.meta.url), "utf8");
const cloudflareHeaders = fs.readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
const strings = fs.readFileSync(new URL("../src/i18n/strings.js", import.meta.url), "utf8");

function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${label} start marker must exist`);
  assert.notEqual(end, -1, `${label} end marker must exist`);
  assert.ok(end > start, `${label} markers must be ordered`);
  return source.slice(start, end);
}

const textStartup = sliceBetween(app, "const startTextSession", "const startVoiceSession", "text startup");
assert.match(textStartup, /connectionType:\s*["']websocket["']/, "text chat must explicitly use WebSocket");
assert.match(textStartup, /textOnly:\s*true/, "text chat must explicitly enable the SDK text-only path");
assert.match(textStartup, /overrides:\s*conversationSessionOverrides\(activeLocale,\s*\{\s*textOnly:\s*true\s*\}\)/, "text chat must request the server-side text-only and selected-language overrides");
assert.doesNotMatch(textStartup, /getUserMedia/, "text chat must never request microphone permission");

const voiceStartup = sliceBetween(app, "const startVoiceSession", "const endVoiceSession", "voice startup");
assert.match(voiceStartup, /connectionType:\s*["']webrtc["']/, "the protected voice connection must remain WebRTC");
assert.match(voiceStartup, /requireMicrophoneCapture\(navigator\.mediaDevices\)[\s\S]*mediaDevices\.getUserMedia\(\{\s*audio:\s*true\s*\}\)/, "voice startup must remain explicitly permission-gated and handle unsupported browsers");
assert.match(voiceStartup, /agentId:\s*import\.meta\.env\.VITE_AGENT_ID/, "voice startup must retain the configured public agent ID");
assert.match(voiceStartup, /overrides:\s*conversationSessionOverrides\(activeLocale\)/, "voice startup must initialize ElevenLabs with the selected language");

const typedMessageFlow = sliceBetween(app, "const sendText", "const sendUiTurn", "typed message flow");
assert.doesNotMatch(typedMessageFlow, /sessionModeRef\.current\s*===\s*["']voice["']\)\s*return/, "typing must not be disabled during an active voice session");
assert.doesNotMatch(typedMessageFlow, /deterministicUiStageGuardRef\.current\s*=\s*null/, "a new typed turn must not drop progression protection before async classification can identify an FAQ");
assert.match(typedMessageFlow, /const ready = sessionModeRef\.current \? true : await startTextSession/, "an existing voice session must be reused for typed messages");
assert.match(typedMessageFlow, /const agentFacingValue = normalizeCinemaAsrForAgent\(value, details\.cinema\)[\s\S]*conversation\.sendUserMessage\(agentFacingValue\)/, "typed messages must be safely normalized and sent through the active voice or text conversation");
assert.match(typedMessageFlow, /if \(discoveryRouteResult && stageRef\.current\.view !== ["']loading["']\)[\s\S]*deterministicUiStageGuardRef\.current\s*=\s*\{[\s\S]*view:\s*stageRef\.current\.view/, "a locally routed typed discovery result must be protected from a delayed model display tool");
const textComposer = sliceBetween(app, '<section aria-label={t("app.conversation")}', "</section>", "text composer");
assert.match(textComposer, /<input\b[\s\S]*?onKeyDown=\{\(event\) => event\.key === ["']Enter["'][\s\S]*?sendText\(\)/, "the text composer must remain rendered and submit while voice is active");

assert.ok((strings.match(/"app\.title":\s*"Voxi"/g) || []).length >= 2, "both language dictionaries must use the Voxi product name");
assert.ok((strings.match(/"app\.brand":\s*"VOX Cinemas UAE"/g) || []).length >= 2, "both language dictionaries must retain VOX Cinemas UAE branding");
assert.match(app, /t\("app\.title"\)/, "the header must render the Voxi product name");
assert.match(app, /t\("app\.brand"\)/, "the header must render VOX Cinemas UAE branding");
assert.doesNotMatch(app, /DEFAULT_CINEMA|item\.id\s*===\s*["']0002["']/, "the UAE product must not silently default to Mall of the Emirates");
assert.match(app, /const \[releaseRecovery\] = useState\(takeReleaseJourneyRecovery\)/, "release recovery must be consumed once at startup");
assert.match(app, /if \(!raw \|\| raw\.length > RELEASE_JOURNEY_RECOVERY_MAX_BYTES\) return null/, "a clean launch must have no release recovery state and oversized recovery data must fail closed");
assert.match(app, /const \[cinema, setCinema\] = useState\(releaseRecovery\?\.cinema \|\| null\)/, "a clean launch must begin without a selected cinema while a release rollover can restore the active cinema");
assert.match(app, /shown:\s*["']cinema picker["']/, "movie discovery without a cinema must display the UAE cinema picker");
assert.match(app, /deterministicUiStageGuardRef\.current\s*=\s*\{\s*view:\s*["']showtimes["']/, "a movie-card click must guard the rendered showtime step from delayed model tools");
assert.match(app, /deterministicUiStageGuardRef\.current\s*=\s*\{\s*view:\s*["']seatmap["']/, "a showtime click must guard the rendered seat map from delayed model tools");
assert.ok((app.match(/preserveDeterministicUiStageForTool\(["']show_(?:movie_selection|showtimes|seat_map)["']\)/g) || []).length === 3, "all earlier-stage display tools must respect deterministic UI progression");
assert.doesNotMatch(app, /Date\.now\(\)\s*-\s*guard\.advancedAt\s*>/, "deterministic UI protection must last until the next user turn or real stage change, not an arbitrary timer");

assert.doesNotMatch(app, /\\u0*600[^\n]*\\u0*6ff/i, "Arabic-script detection must not auto-switch the interface language");
const messageHandler = sliceBetween(app, "onMessage:", "onError:", "conversation message handler");
assert.match(messageHandler, /resolveLanguageSignal/, "message language changes must pass through the explicit confirmation state machine");
assert.doesNotMatch(messageHandler, /deterministicUiStageGuardRef\.current\s*=\s*null/, "a new voice turn must not drop progression protection before async classification can identify an FAQ");
assert.doesNotMatch(messageHandler, /isArabic|arabicScript|\\p\{Script=Arabic\}/iu, "incoming language must not switch from a raw script detector");

assert.match(app, /function LanguageSelector\s*\(/, "an explicit language selector must be rendered");
assert.match(app, /<LanguageSelector\b[^>]*onSelect=\{changeLanguage\}/, "the header language selector must call the explicit language handler");
assert.match(app, /code:\s*["']en["']/, "the language selector must expose English");
assert.match(app, /code:\s*["']ar["']/, "the language selector must expose Arabic");
assert.match(app, /item\.code\s*===\s*["']en["']\s*\?\s*["']English["']\s*:/, "the English/Arabic selector must have an explicit English accessible label");

for (const locale of ["en", "ar"]) {
  const customerError = STRINGS[locale]?.["app.textStartError"];
  assert.equal(typeof customerError, "string", `${locale} must define app.textStartError`);
  assert.ok(customerError.trim(), `${locale} app.textStartError must not be empty`);
  assert.doesNotMatch(customerError, /mic(?:rophone)?|VITE_AGENT_ID|\u0645\u064a\u0643\u0631\u0648\u0641\u0648\u0646/iu, `${locale} text-start errors must not mention microphone setup or internal configuration`);
}
assert.match(textStartup, /t\("app\.textStartError"\)/, "text startup must use the customer-facing text error");

const title = index.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
assert.ok(title, "index.html must define a document title");
assert.doesNotMatch(title, /ElevenLabs|Concierge/i, "the customer-facing document title must not expose vendor or legacy Concierge branding");
const localeBootstrapTag = '<script src="/locale-bootstrap.js"></script>';
assert.ok(index.includes(localeBootstrapTag), "index.html must load the same-origin locale bootstrap");
assert.ok(
  index.indexOf(localeBootstrapTag) < index.indexOf("</head>"),
  "the locale bootstrap must run synchronously in the document head before the startup shell is painted",
);
const inlineExecutableScripts = [...index.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)]
  .filter(([, attributes, body]) => !/\bsrc\s*=/iu.test(attributes) && body.trim());
assert.equal(inlineExecutableScripts.length, 0, "strict production CSP requires index.html to contain no executable inline scripts");
assert.match(localeBootstrap, /localStorage\.getItem\("vox_locale"\) === "ar" \? "ar" : "en"/, "the external bootstrap must preserve the stored locale fallback");
assert.match(localeBootstrap, /document\.documentElement\.lang = locale/, "the external bootstrap must set the initial document language");
assert.match(localeBootstrap, /document\.documentElement\.dir = locale === "ar" \? "rtl" : "ltr"/, "the external bootstrap must set the initial document direction");
const contentSecurityPolicy = cloudflareHeaders.match(/Content-Security-Policy:\s*([^\r\n]+)/iu)?.[1] || "";
assert.match(contentSecurityPolicy, /script-src\s+'self'\s+blob:/iu, "Cloudflare CSP must allow only same-origin application scripts and required blob workers");
assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*'unsafe-inline'/iu, "Cloudflare script policy must not require unsafe inline execution");

console.log("Validated text-first WebSocket chat, protected WebRTC voice, explicit language selection, Voxi branding, and customer-safe errors.");
