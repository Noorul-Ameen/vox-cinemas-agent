import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const media = fs.readFileSync(new URL("../src/components/RichMedia.jsx", import.meta.url), "utf8");

assert.equal((app.match(/role="log"/g) || []).length, 1, "the widget must have one transcript log");
assert.match(app, /<main ref=\{scrollRef\}[^>]*aria-label=\{t\("app\.conversation"\)\}/, "messages and stage UI must share the main scroll window");
assert.doesNotMatch(app, /maxHeight:\s*200/, "the old detached 200px transcript must be removed");
assert.match(app, /stage\.view === "faq"/, "FAQ results must render as the current inline stage");
assert.match(app, /<DateStrip\b/, "the extracted date range must render inline");
assert.match(app, /<TicketQuantityControl\b/, "ticket quantity must stay visible beside seat selection");
assert.match(app, /voxi:new-conversation/);
assert.match(app, /voxi:logout/);
assert.match(app, /CONVERSATION_IDLE_MS/);
assert.match(app, /if \(reason === "timeout"\) \{\s*clearConversationState\(reason\);\s*\} else if \(cancelResolver\.current/, "only the deliberate app inactivity timeout should clear local UI state on disconnect");
assert.match(app, /dismissPendingCancellation\("transport_disconnected"\)/, "a dead transport must resolve any still-pending cancellation confirmation");
assert.match(app, /posterUrl:\s*movie\?\.posterUrl/, "completed orders must retain their poster URL");
assert.match(media, /getMoviePosterUrl\(booking\)/, "booking confirmation must resolve a poster with fallback support");
const cancellationTool = app.slice(app.indexOf("show_booking_for_cancellation: async"), app.indexOf("show_offers: async"));
assert.match(cancellationTool, /const demoOnly =/, "cancellation must distinguish prototype records before discussing a refund route");
assert.match(cancellationTool, /phase:\s*"final_confirmation"[\s\S]*refundRoute:\s*null[\s\S]*demoOnly:\s*true/, "prototype removal must bypass VOX Wallet selection");
assert.match(cancellationTool, /This will not contact VOX or issue a refund/, "prototype removal copy must not promise a real cancellation or refund");
assert.match(cancellationTool, /Cancellation eligibility could not be verified/, "unverified live cancellation eligibility must fail closed");
assert.match(app, /refundRoute:\s*isDemoSimulation\s*\?\s*null\s*:\s*"VOX Wallet"/, "prototype cancellation records must not claim a VOX Wallet refund route");
assert.doesNotMatch(app, /Ø§Ø®ØªØ±Øª/, "Arabic cinema selection transcript must not contain mojibake");

console.log("Validated unified inline rendering, guided controls, disconnect preservation, lifecycle resets, and confirmation poster wiring.");
