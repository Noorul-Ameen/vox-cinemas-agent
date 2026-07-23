import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { OFFER_META, OFFERS } from "../src/offers/offersData.js";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

function visibleText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

const qualifiedFabContext = Object.freeze({
  channel: "online",
  cinemaName: "City Centre Mirdif",
  experience: "Regular 2D",
  isMember: true,
  monthlySpend: 10_000,
  monthlyTicketsUsed: 0,
  orderTotal: 100,
  ticketCount: 2,
});

try {
  const { OffersPanel } = await server.ssrLoadModule("/src/components/OffersPanel.jsx");
  const renderPanel = (props) => renderToStaticMarkup(React.createElement(OffersPanel, {
    context: qualifiedFabContext,
    initialOfferId: "fab-share",
    initialProfileId: "fab-share-credit",
    initialQuery: "FAB",
    ...props,
  }));

  const freshHtml = renderPanel({ knowledgeAsOf: "2026-08-16" });
  const freshText = visibleText(freshHtml);
  assert.match(freshText, /First Abu Dhabi Bank/);
  assert.match(freshText, /Buy one ticket, get one free/);
  assert.match(freshText, /Listed as eligible/);
  assert.match(freshText, /Eligible experiences/);
  assert.match(freshText, /Card to check/);
  assert.match(freshText, /Common terms/);

  const staleHtml = renderPanel({ knowledgeAsOf: "2026-08-17" });
  const staleText = visibleText(staleHtml);
  assert.match(staleText, /First Abu Dhabi Bank/);
  assert.match(staleText, /FAB SHARE/);
  assert.match(staleText, new RegExp(`Last verified: ${OFFER_META.verifiedDate}`));
  assert.match(staleText, /official current terms/i);
  assert.match(staleText, /Confirm the card and current offer in the official VOX website or app checkout/i);
  assert.match(staleHtml, new RegExp(`href="${OFFER_META.sourceUrl}"`));
  assert.match(staleHtml, /href="https:\/\/uae\.voxcinemas\.com\/offers\/bank-deals\/fab-buy-one-ticket-get-one-free\/terms-conditions"/);
  assert.doesNotMatch(staleText, /Buy one ticket, get one free/);
  assert.doesNotMatch(staleText, /Listed as eligible|Not eligible/);
  assert.doesNotMatch(staleText, /Ticket benefit|Eligible experiences/);
  assert.doesNotMatch(staleText, /Card to check|Common terms/);
  assert.doesNotMatch(staleText, /Regular 2D/);

  const staleCatalogText = visibleText(renderPanel({
    initialOfferId: "sharjah-islamic-bank",
    initialProfileId: "sib-checkout-verification",
    initialQuery: "",
    knowledgeAsOf: "2026-08-17",
  }));
  for (const offer of OFFERS) {
    assert.equal(
      staleCatalogText.includes(offer.headline.en),
      false,
      `${offer.id}: stale catalog must not render the stored benefit headline`,
    );
  }
  assert.doesNotMatch(staleCatalogText, /SIB eligible card|Sharjah Islamic Bank eligible card/i);
  assert.match(staleCatalogText, /No exact card list is published/);

  const invalidHtml = renderPanel({ knowledgeAsOf: "2026-07-16" });
  const invalidText = visibleText(invalidHtml);
  assert.match(invalidText, /verification date is unavailable or invalid/i);
  assert.match(invalidText, /official VOX website or app checkout/i);
  assert.doesNotMatch(invalidText, /Buy one ticket, get one free|Listed as eligible|Not eligible/);

  const staleArabicText = visibleText(renderPanel({ knowledgeAsOf: "2026-08-17", locale: "ar" }));
  assert.match(staleArabicText, /بنك أبوظبي الأول/u);
  assert.match(staleArabicText, /الشروط الرسمية الحالية/u);
  assert.match(staleArabicText, /صفحة الدفع الرسمية في موقع VOX أو تطبيقه/u);
  assert.doesNotMatch(staleArabicText, /اشترِ تذكرة واحصل على الثانية مجاناً/u);

  console.log("Validated fresh, stale, invalid-date, and Arabic bank-offer panel disclosure behavior.");
} finally {
  await server.close();
}
