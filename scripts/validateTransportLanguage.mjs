import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agentLanguageForLocale, conversationSessionOverrides } from "../src/lib/transportLanguage.js";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

assert.equal(agentLanguageForLocale("ar"), "ar");
assert.equal(agentLanguageForLocale("en"), "en");
assert.equal(agentLanguageForLocale("unsupported"), "en");
assert.deepEqual(conversationSessionOverrides("ar"), { agent: { language: "ar" } });
assert.deepEqual(conversationSessionOverrides("en", { textOnly: true }), {
  agent: { language: "en" },
  conversation: { textOnly: true },
});
assert.equal((app.match(/overrides:\s*conversationSessionOverrides\(activeLocale/g) || []).length, 2, "text and voice must both initialize ElevenLabs with the selected agent language");
assert.match(app, /restartActiveTransportForLanguage[\s\S]*activeMode === "voice"[\s\S]*startVoiceSession\(\)[\s\S]*startTextSession\(\)/, "an active language change must restart the same transport mode");
assert.match(app, /The transport restarted as a continuation[\s\S]*buildVoxiContext\([\s\S]*messages:\s*messagesRef\.current/, "the language continuation must preserve canonical journey and recent-turn context");

console.log("Validated transport-level English and Arabic overrides plus same-mode continuation restart.");
