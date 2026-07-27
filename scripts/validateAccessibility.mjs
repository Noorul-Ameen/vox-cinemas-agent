import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const richMedia = await readFile(new URL("../src/components/RichMedia.jsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const checkout = await readFile(new URL("../src/components/Checkout.jsx", import.meta.url), "utf8");
const handover = await readFile(new URL("../src/components/HandoverPanel.jsx", import.meta.url), "utf8");

assert.match(
  richMedia,
  /<input type="search" dir="auto" aria-label=\{t\("cinema\.search"\)\}/,
  "Cinema search must expose an explicit localized accessible name.",
);

assert.match(
  richMedia,
  /<h2 id=\{headingId\}[^>]*>\{title\}<\/h2>/,
  "Rich stage headers must use level-two semantic headings.",
);

for (const stage of ["cinemas", "movies", "showtimes", "seats", "booking"]) {
  assert.match(
    richMedia,
    new RegExp(`<section role="region" aria-labelledby=\\{STAGE_HEADING_IDS\\.${stage}\\}(?:\\s[^>]*)?>`),
    `${stage} must render as a named region.`,
  );
  assert.match(
    richMedia,
    new RegExp(`<Header headingId=\\{STAGE_HEADING_IDS\\.${stage}\\}`),
    `${stage} must connect its region name to its visible heading.`,
  );
}

assert.match(
  richMedia,
  /<section role="region" aria-labelledby=\{STAGE_HEADING_IDS\.movies\} aria-busy=\{loading\}>/,
  "Movie loading must expose its busy state on the named results region.",
);

assert.match(
  richMedia,
  /data-voxi-seat-scroll[^>]*overflowX: "auto"/,
  "The seat grid must contain narrow-screen overflow within its own viewport.",
);
assert.match(
  richMedia,
  /height: 24, width: 24, flex: "0 0 24px"/,
  "Every seat control must provide a 24 by 24 CSS pixel target.",
);
assert.doesNotMatch(
  richMedia,
  /height: "clamp\(18px,\s*5\.2vw,\s*22px\)"/,
  "The undersized legacy seat target must not return.",
);

assert.match(
  app,
  /data-voxi-stage-announcement[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/,
  "App must keep a polite atomic live region for stage changes.",
);
assert.match(
  app,
  /requestAnimationFrame\(\(\) => setStageAnnouncement\(stageAnnouncementText\)\)/,
  "Stage announcements must update after the persistent live region is mounted.",
);
assert.doesNotMatch(
  app.slice(app.indexOf("data-voxi-stage-announcement"), app.indexOf("{transportEnabled")),
  /tabIndex|\.focus\(/,
  "The stage announcer must not steal focus.",
);

assert.match(
  checkout,
  /<h2 id="checkout-heading"[^>]*>\{(?:t\("checkout\.title"\)|copy\.title)\}<\/h2>/,
  "Checkout must expose its visible title as a level-two heading.",
);
assert.match(
  checkout,
  /<section[^>]*aria-labelledby="checkout-heading"[^>]*>/,
  "Checkout must render inside a named section.",
);
assert.match(
  handover,
  /<section[\s\S]*aria-labelledby="handover-heading"[\s\S]*<h2 id="handover-heading"/,
  "Customer Care handover must render as a section named by its visible heading.",
);

console.log("Validated named cinema search, semantic rich, checkout and handover stages, 24px seat targets, contained narrow-screen overflow, and polite stage announcements.");
