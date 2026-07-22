# VOXi final validation report

Date: 22 July 2026, UAE

Local test URL: <http://127.0.0.1:4173/>

Hosted URL: <https://voxi-ai.pages.dev/>

Repository: <https://github.com/Noorul-Ameen/vox-cinemas-agent>

Current local snapshot: `20260722-730239f0d90074fb`

Current production asset: `/assets/index-B_jpqGCb.js`

Hosted status for this candidate: revalidation pending

## Executive status

The current local candidate passes the full repository validator, production build, and mounted-browser end-to-end replay. The tested browser journey covered availability truth guards, same-title language variants, Arabic mixed-script titles, filtered time ranges, nearest-time fallback, exact movie and showtime selection, FAQ restoration, cross-cinema isolation, seat edits, checkout total changes, device-only summary and QR, cancellation by movie title, nearby location alternatives, language no-results, detailed bank offers, and English and Arabic WebRTC connection. The browser recorded zero error-level console entries.

This candidate is not yet claimed as deployed on Cloudflare. Hosted asset parity and the critical hosted replay must be repeated after publication. Acoustic voice quality also remains a manual speak-and-listen test. Live ticket sales remain blocked by licensed provider APIs.

## Status summary

| Area | Status | Result |
| --- | --- | --- |
| Full validator | PASS LOCALLY | The complete aggregate suite passed against the current source and snapshot. |
| Production build | PASS LOCALLY | The final release build produced `/assets/index-B_jpqGCb.js` at 897,497 raw bytes, 252,450 gzip bytes, and 228,683 Brotli bytes. |
| Schedule snapshot | PASS LOCALLY | 11,126 sessions, 43 films, 22 cinemas, 341 shards, and coverage from 2026-07-22 through 2026-08-12. |
| Text discovery | PASS LOCALLY | Filtered time ranges and exact movie and showtime selection passed in the mounted browser. |
| Seat and checkout | PASS LOCALLY | One-turn removal, addition, and replacement updated seat count and checkout totals correctly. |
| FAQ continuity | PASS LOCALLY | The active booking state restored after the FAQ detour. |
| Summary and QR | PASS LOCALLY | The device-only summary and local-reference QR rendered with the required disclosure boundary. |
| Cancellation | PASS LOCALLY | Selecting a listed booking by movie title continued the cancellation journey. |
| English and Arabic | PASS LOCALLY | Bilingual interface and conversation routes passed, including Arabic word-time selection. |
| Bank offers | PASS LOCALLY | Detailed FAB content rendered with the offer interface. |
| WebRTC | PASS LOCALLY | The local browser established English and Arabic connections and recorded zero error-level console entries. |
| ElevenLabs contract | PASS | Contract `2026-07-22.2` remains published and dashboard-verified. |
| Hosted parity | PENDING | The current snapshot and asset have not yet been verified on Cloudflare. |
| Acoustic voice | MANUAL ACCEPTANCE REQUIRED | Automated testing did not speak into a microphone or judge audible English and Arabic output. |
| Live transactions | BLOCKED | Inventory, holds, payment, official ticketing, provider cancellation, and refunds require external APIs. |

## Current showtime snapshot

Snapshot version: `20260722-730239f0d90074fb`

- Coverage: 2026-07-22 through 2026-08-12.
- Deduplicated sessions: 11,126.
- Scheduled films: 43.
- VOX UAE cinemas: 22.
- Remaining sessions on 22 July at refresh time: 421.
- Sessions on 23 July: 1,397.
- Schedule shards: 341.
- Official movie-information records: 94.
- Verified runtimes: 93.
- Missing posters: 0.
- Experience-media records: 14.

The application uses versioned cinema and date data generated from official VOX UAE public-site sources. Snapshot mode does not provide live sold-out status, current seat inventory, seat holds, transaction pricing, or provider booking mutations.

## Automated evidence

### Full validation

Result: PASS

The aggregate suite covers:

- Extractor, freshness, counts, deduplication, source IDs, and media provenance.
- Snapshot generation, shards, runtime loading, and cinema-date coverage.
- Discovery preferences, filtered times, location availability, exact movie selection, exact showtime selection, and no-result behavior.
- Seat-derived ticket count, stale-state protection, quote updates, paused journey restoration, checkout continuity, and cancellation safety.
- English and Arabic, language switching, conversation modes, WebSocket text, WebRTC voice, startup recovery, and protected ElevenLabs configuration.
- FAQ, offers, handover redaction, booking persistence, programming-date selection, routing invariants, and customer-facing punctuation.

### Production build

Result: PASS

- Final release asset: `/assets/index-B_jpqGCb.js`.
- Raw JavaScript: 897,497 bytes.
- Gzip JavaScript: 252,450 bytes.
- Brotli JavaScript: 228,683 bytes.

## Local browser end-to-end evidence

The final mounted-browser run passed:

1. Asking about IMAX at Yas Mall without a date asked for the date and did not claim unverified availability.
2. Jana Nayagan returned Tamil and Hindi variants, while Toxic returned Kannada, Hindi, Tamil, and Malayalam variants.
3. Runtime questions for a multi-language title asked for the language version, and an explicit Hindi request returned the verified Hindi runtime.
4. Arabic questions containing a Latin movie title retained the intended movie context.
5. Family results at Mall of the Emirates tomorrow around 8 PM were filtered correctly.
6. A request without an exact time clearly offered the nearest suitable sessions.
7. Exact visible movie and showtime selection opened the correct seat map.
8. Selecting E1, E2, and E3 produced three tickets and an AED 126 checkout total.
9. A parking FAQ hid checkout without discarding it, named Mall of the Emirates, and exposed Return to checkout.
10. A Yas Mall experience question during the Mall of the Emirates checkout did not leak the active cinema's movie or session data.
11. Replacing E1 with E4 produced E2, E3, and E4 at the unchanged AED 126 total.
12. The device-only booking summary and local-reference QR rendered for reference `WLP06WX` with truthful transaction disclosures.
13. Cancellation continued by the listed movie title and updated only the on-device record without a refund claim.
14. A Hatta request explained that no VOX cinema is present and offered nearby UAE alternatives.
15. A French movie request with `anything is fine` produced a language no-result and did not become a title mismatch.
16. The offers view exposed 21 promotions across 20 issuer groups and rendered detailed FAB information.
17. English and Arabic WebRTC connections both established successfully.
18. Retained discovery headings, nearest-time notices, no-result errors, and showtime notices switched between English and Arabic without losing the selected cinema, filters, movie, or sessions.
19. Re-selecting the active language did not invalidate an in-flight turn, and cached lazy-chunk failures had a full-reload recovery path.
20. The exact final asset replay ended with zero error-level console entries. Information and warning entries were expected transport lifecycle messages.

Visual evidence:

- [Final local booking render](./evidence/screenshots/final-local-booking-render-2026-07-22.png)

Run log:

- [Final local validation log](./evidence/logs/final-local-validation-2026-07-22.md)

## What works

- Text starts without microphone permission.
- Progressive discovery keeps cinema, date, time, genre, language, experience, movie, and audience criteria already supplied by the guest.
- Requested time ranges constrain the visible results.
- Exact visible movie and showtime choices route deterministically.
- Movie, cinema, date, or session changes invalidate incompatible downstream seat and quote state.
- One selected seat equals one ticket, with no separate quantity control.
- A single turn can remove, add, or replace selected seats.
- Seat changes update ticket count, pricing, fees, and checkout total.
- Checkout can be paused for an FAQ and restored without restarting discovery.
- Device-local booking summary, reference QR, history, and cancellation are clearly disclosed as local preview behavior.
- A listed movie title continues cancellation instead of starting a new movie search.
- English and Arabic use one shared journey state.
- Arabic word-time input resolves against the visible sessions.
- Detailed FAB offer content is available through the same conversation interface.
- The protected WebRTC connection, `serverLocation: "eu-residency"`, tool names, `select_seats`, fuzzy movie resolver, fuzzy session resolver, and 420 px layout remain unchanged.
- Customer-facing text is validated against prohibited Unicode dash characters.

## Partially working

- WebRTC connection succeeds locally, but recognition accuracy and audible TTS quality still require a human to speak and listen in English and Arabic.
- The current candidate passes locally, but Cloudflare has not yet been checked for the same asset, snapshot, headers, browser behavior, and console result.
- Schedule freshness depends on the daily refresh workflow and successful promotion of the validated snapshot.
- Nearby cinema guidance uses repository mappings rather than live GPS or travel-time data.
- Bank-offer accuracy is limited by the detail published on official source pages. Missing terms are not invented.

## Blocked or not implemented

- Live seat inventory and seat holds.
- Authoritative transaction pricing, fees, and taxes.
- Applied bank-offer redemption.
- Payment authorization or capture.
- Provider-confirmed booking and official admission QR.
- Cross-device booking lookup.
- Provider cancellation and refund processing.
- Live customer-care handover.

## ElevenLabs status

Target agent: `agent_0001kx3xc0b4f6s8dqy9qnejm4qr`

Published contract: `2026-07-22.2`

Prompt SHA-256: `8d6747a745286f6b3e8b6acef83762f267eab0649cbb8504b6dc1d9f5d8ae0b8`

The current repository retains:

- First message `{{voxi_session_opening}}`.
- English and Arabic explicit language routing.
- WebRTC voice and WebSocket text.
- `serverLocation: "eu-residency"`.
- Existing client-tool names and wait-for-response behavior.
- `select_seats` authorization and validation.
- Shared text and voice journey state.

No new dashboard prompt edit is required for this local candidate. After deployment, reconnect both English and Arabic transports on the hosted origin. Acoustic acceptance still requires real speech and audible output.

## Required API and knowledge changes

Live transaction readiness requires:

- Licensed VOX session, seat inventory, and hold APIs.
- Authoritative quote, fee, tax, and offer-application services.
- Secure payment and provider booking confirmation.
- Official ticket and QR issuance.
- Booking lookup, provider cancellation, and refund APIs.
- A confirmed care-platform handover connector.

Long-term content accuracy requires:

- Preferably a VOX-owned structured schedule feed.
- Monitoring for refresh, validation, and deployment failures.
- A structured offer feed with card tiers, limits, locations, experiences, expiry, exclusions, and canonical terms URLs.
- Content ownership for expired, blank, or conflicting source pages.

## Hosted release gate

Before calling this candidate fully deployed, verify on <https://voxi-ai.pages.dev/>:

1. Record the final rebuilt asset name, then confirm the page serves that exact asset.
2. Snapshot `20260722-730239f0d90074fb` is available and used.
3. The critical local journeys reproduce on Cloudflare.
4. English and Arabic text and WebRTC transport connect.
5. The 420 px layout and final booking render remain visually correct.
6. Browser back and forward navigation remain on the same current asset.
7. A fresh tab has zero unexpected browser errors.

## Final production-readiness status

Local candidate: **PASS.**

Hosted candidate: **PENDING DEPLOYMENT PARITY AND END-TO-END REVALIDATION.**

Acoustic voice: **PENDING MANUAL ENGLISH AND ARABIC ACCEPTANCE.**

Live ticket sales: **BLOCKED BY LICENSED PROVIDER APIS.**
