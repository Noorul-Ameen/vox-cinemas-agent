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
assert.match(app, /posterUrl:\s*movie\?\.posterUrl/, "completed orders must retain their poster URL");
assert.match(media, /getMoviePosterUrl\(booking\)/, "booking confirmation must resolve a poster with fallback support");

console.log("Validated unified inline rendering, guided controls, lifecycle resets, and confirmation poster wiring.");
